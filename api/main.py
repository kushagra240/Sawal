"""Sawal REST API. Implements OpenAPI contract routes with in-memory persistence."""

from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from threading import Lock
import time
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator

from core.engine import MAX_QUESTIONS, TAU, answer_session, create_session
from core.llm import ensure_open_weight_model
from core.world import seed_world


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate only the model family at startup. Provider credentials are checked
    # lazily when a live call is actually requested, keeping offline tests/network-free.
    ensure_open_weight_model()
    yield


app = FastAPI(
    title="Sawal API",
    version="1.0.0",
    description="Effect-based ask-or-act rehearsal API conforming to OpenAPI 3.1.0 contract.",
    lifespan=lifespan,
)

raw_origins = os.getenv("SAWAL_CORS_ORIGINS") or os.getenv("CORS_ORIGINS") or "http://localhost:3000,http://127.0.0.1:3000"
allowed_origins = [x.strip() for x in raw_origins.split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

world = seed_world()
sessions: dict[str, dict] = {}
user_preferences: dict[str, object] = {
    "preferred_dining_time": "19:30",
    "dietary_preference": "vegetarian",
    "primary_manager_name": "Priya Sharma",
}
benchmark_runs: dict[str, dict] = {}
request_times: dict[str, deque] = defaultdict(deque)
rate_lock = Lock()


@app.exception_handler(HTTPException)
async def http_error_response(request: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "HTTP_ERROR", "message": str(exc.detail)}
    code = detail.get("code", "HTTP_ERROR")
    message = detail.get("message", "Request failed")
    details = detail.get("details", {})
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": code,
            "message": message,
            "details": details,
            "error": {"code": code, "message": message, "details": details},
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error_response(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "code": "UNPROCESSABLE_ENTITY",
            "message": "Request validation failed",
            "details": {"errors": exc.errors()},
            "error": {"code": "UNPROCESSABLE_ENTITY", "message": "Request validation failed", "details": {"errors": exc.errors()}},
        },
    )


class CreateSessionRequest(BaseModel):
    request_text: str = Field(min_length=3, max_length=1000)
    llm_mode: Literal["live", "record", "replay", "auto"] | None = None


class AnswerRequest(BaseModel):
    question_id: str = Field(min_length=1, max_length=100)
    option_id: str | None = None
    free_text: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def require_answer(self):
        if not self.option_id and not self.free_text:
            raise ValueError("Provide option_id or free_text.")
        return self


class UpdatePreferencesRequest(BaseModel):
    preferences: dict[str, object]


class CreateBenchmarkRunRequest(BaseModel):
    tau_values: list[float] | None = None
    models: list[str] | None = None
    tasks_count: int | None = None


def _rate_limit(request: Request) -> None:
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with rate_lock:
        entries = request_times[key]
        while entries and now - entries[0] >= 60:
            entries.popleft()
        if len(entries) >= 60:
            raise HTTPException(429, detail={"code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests. Retry in a minute."})
        entries.append(now)


def _public(session: dict) -> dict:
    return {key: value for key, value in session.items() if not key.startswith("_")}


router = APIRouter()


@router.get("/health")
def health():
    raw_mode = os.getenv("SAWAL_LLM_MODE", os.getenv("LLM_MODE", "auto")).lower()
    mode = raw_mode if raw_mode in {"live", "record", "replay", "auto"} else "auto"
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "version": app.version,
        "storage_backend": "memory",
        "llm_mode": mode,
        "llm_provider": os.getenv("LLM_PROVIDER", "gemini"),
    }


@router.get("/config")
def config():
    raw_mode = os.getenv("SAWAL_LLM_MODE", os.getenv("LLM_MODE", "auto")).lower()
    mode = raw_mode if raw_mode in {"live", "record", "replay", "auto"} else "auto"
    return {
        "environment": os.getenv("ENVIRONMENT", "development"),
        "allow_guest_demo": True,
        "decision_tau": TAU,
        "max_questions": MAX_QUESTIONS,
        "num_interpretations": int(os.getenv("NUM_INTERPRETATIONS", "5")),
        "gemma_model_id": ensure_open_weight_model(),
        "llm_mode": mode,
        "llm_provider": os.getenv("LLM_PROVIDER", "gemini"),
        "reversibility_weights": {
            "email.send": 1.0,
            "restaurants.book": 0.7,
            "calendar.create_event": 0.4,
            "expenses.log": 0.3,
            "email.draft": 0.1,
        },
    }


@router.get("/me")
def get_me():
    return {
        "user_id": "guest_user",
        "display_name": "Teammate User (Guest Demo)",
        "preferences": user_preferences,
        "created_at": "2026-10-13T10:00:00Z",
    }


@router.put("/me/preferences")
def update_preferences(req: UpdatePreferencesRequest):
    global user_preferences
    user_preferences.update(req.preferences)
    return {
        "user_id": "guest_user",
        "display_name": "Teammate User (Guest Demo)",
        "preferences": user_preferences,
        "created_at": "2026-10-13T10:00:00Z",
    }


@router.post("/sessions", status_code=201)
def create(request_body: CreateSessionRequest, request: Request, response: Response):
    _rate_limit(request)
    session = create_session(request_body.request_text, world, llm_mode=request_body.llm_mode)
    sessions[session["id"]] = session
    return _public(session)


@router.get("/sessions")
def list_sessions(cursor: str | None = None, limit: int = Query(default=20, ge=1, le=100)):
    items = sorted(sessions.values(), key=lambda x: x["created_at"], reverse=True)
    if cursor:
        items = [item for item in items if item["created_at"] < cursor and item["id"] != cursor]
    page = items[:limit]
    return {
        "items": [_public(item) for item in page],
        "next_cursor": page[-1]["created_at"] if len(items) > limit and page else None,
        "has_more": len(items) > limit,
    }


@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Session not found"})
    return _public(session)


@router.post("/sessions/{session_id}/answer")
def answer(session_id: str, request_body: AnswerRequest):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Session not found"})
    try:
        return _public(answer_session(session, world, request_body.question_id, request_body.option_id, request_body.free_text))
    except ValueError as exc:
        message = str(exc)
        status = 409 if "not waiting" in message else 422
        raise HTTPException(status, detail={"code": "CONFLICT" if status == 409 else "UNPROCESSABLE_ENTITY", "message": message}) from exc


@router.get("/world")
def get_world():
    return world


@router.post("/world/reset")
def reset_world():
    global world
    world = seed_world()
    return world


@router.get("/benchmark/summary")
def benchmark_summary():
    path = Path(__file__).resolve().parents[1] / "benchmark" / "results" / "latest_summary.json"
    if path.is_file():
        return json.loads(path.read_text(encoding="utf-8"))
    from benchmark.runner import evaluate
    summary = evaluate()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


@router.post("/benchmark/runs", status_code=202)
def create_benchmark_run(req: CreateBenchmarkRunRequest | None = None):
    from benchmark.runner import evaluate
    summary = evaluate()
    run_id = str(uuid4())
    run_obj = {
        "id": run_id,
        "status": "completed",
        "config": {
            "tau_values": (req.tau_values if req and req.tau_values else [0.0, 0.1, 0.25, 0.5, 0.75, 1.0]),
            "models": (req.models if req and req.models else [ensure_open_weight_model()]),
            "tasks_count": summary["tasks_count"],
        },
        "summary": summary,
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "completed_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    benchmark_runs[run_id] = run_obj
    return run_obj


@router.get("/benchmark/runs/{run_id}")
def get_benchmark_run(run_id: str):
    run_obj = benchmark_runs.get(run_id)
    if not run_obj:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Benchmark run not found"})
    return run_obj


app.include_router(router, prefix="/v1")
app.include_router(router)
