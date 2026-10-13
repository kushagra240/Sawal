"""Sawal P0 REST API. Sessions and demo world are intentionally in-memory."""

from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
import json
import os
import time

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator

from core.engine import MAX_QUESTIONS, TAU, answer_session, create_session
from core.llm import ensure_open_weight_model
from core.world import seed_world

app = FastAPI(title="Sawal API", version="1.0.0", description="Effect-based ask-or-act demo harness")
allowed_origins = [x.strip() for x in os.getenv("SAWAL_CORS_ORIGINS", "http://localhost:3000").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, allow_methods=["GET", "POST"], allow_headers=["*"])

world = seed_world()
sessions: dict[str, dict] = {}
request_times: dict[str, deque] = defaultdict(deque)
rate_lock = Lock()


@app.on_event("startup")
def check_model_allowlist():
    ensure_open_weight_model()


@app.exception_handler(HTTPException)
async def http_error_response(request: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "HTTP_ERROR", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content={"error": {"code": detail.get("code", "HTTP_ERROR"), "message": detail.get("message", "Request failed")}})


@app.exception_handler(RequestValidationError)
async def validation_error_response(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"error": {"code": "UNPROCESSABLE_ENTITY", "message": "Request validation failed", "details": {"errors": exc.errors()}}})


class CreateSessionRequest(BaseModel):
    request_text: str = Field(min_length=3, max_length=1000)


class AnswerRequest(BaseModel):
    question_id: str = Field(min_length=1, max_length=100)
    option_id: str | None = None
    free_text: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def require_answer(self):
        if not self.option_id and not self.free_text:
            raise ValueError("Provide option_id or free_text.")
        return self


def _rate_limit(request: Request) -> None:
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with rate_lock:
        entries = request_times[key]
        while entries and now - entries[0] >= 60:
            entries.popleft()
        if len(entries) >= 15:
            raise HTTPException(429, detail={"code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests. Retry in a minute."})
        entries.append(now)


def _public(session: dict) -> dict:
    return {key: value for key, value in session.items() if not key.startswith("_")}


@app.get("/v1/health")
def health():
    mode = os.getenv("SAWAL_LLM_MODE", "mock").lower()
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat(), "version": app.version, "storage_backend": "memory", "llm_mode": mode}


@app.get("/v1/config")
def config():
    return {"environment": os.getenv("ENVIRONMENT", "development"), "allow_guest_demo": True, "decision_tau": TAU, "max_questions": MAX_QUESTIONS, "num_interpretations": 5, "gemma_model_id": os.getenv("SAWAL_MODEL", "gemma4:e2b"), "llm_mode": os.getenv("SAWAL_LLM_MODE", "mock"), "reversibility_weights": {"email.send": 1.0, "restaurants.book": 0.7, "calendar.create_event": 0.4, "expenses.log": 0.3, "email.draft": 0.1}}


@app.post("/v1/sessions", status_code=201)
def create(request_body: CreateSessionRequest, request: Request, response: Response):
    _rate_limit(request)
    session = create_session(request_body.request_text, world)
    sessions[session["id"]] = session
    return _public(session)


@app.get("/v1/sessions")
def list_sessions(cursor: str | None = None, limit: int = Query(default=20, ge=1, le=100)):
    items = sorted(sessions.values(), key=lambda x: x["created_at"], reverse=True)
    if cursor:
        items = [item for item in items if item["created_at"] < cursor and item["id"] != cursor]
    page = items[:limit]
    return {"items": [_public(item) for item in page], "next_cursor": page[-1]["created_at"] if len(items) > limit and page else None}


@app.get("/v1/sessions/{session_id}")
def get_session(session_id: str):
    session = sessions.get(session_id)
    if not session: raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Session not found"})
    return _public(session)


@app.post("/v1/sessions/{session_id}/answer")
def answer(session_id: str, request_body: AnswerRequest):
    session = sessions.get(session_id)
    if not session: raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Session not found"})
    try:
        return _public(answer_session(session, world, request_body.question_id, request_body.option_id, request_body.free_text))
    except ValueError as exc:
        message = str(exc)
        status = 409 if "not waiting" in message else 422
        raise HTTPException(status, detail={"code": "CONFLICT" if status == 409 else "UNPROCESSABLE_ENTITY", "message": message}) from exc


@app.get("/v1/world")
def get_world():
    return world


@app.post("/v1/world/reset")
def reset_world():
    global world
    world = seed_world()
    return world


@app.get("/v1/benchmark/summary")
def benchmark_summary():
    path = Path(__file__).resolve().parents[1] / "benchmark" / "results" / "latest_summary.json"
    if path.is_file():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"status": "not_run", "message": "No benchmark results yet. Run `python -m benchmark.runner` to calculate measured metrics.", "tasks_count": 0, "points": []}
