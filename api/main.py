"""Sawal REST API. Implements OpenAPI contract routes with in-memory persistence."""

from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from threading import Lock
import time
from uuid import uuid4

from fastapi import APIRouter, FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field, model_validator

from core.config import load_environment
from core.engine import MAX_QUESTIONS, TAU, answer_session, create_session
from core.llm import ensure_open_weight_model
from core.live import LiveExecutionService
from core.oauth import GoogleOAuthManager, OAuthConfigurationError, OAuthStateError
from core.providers import ProviderError
from core.storage import AgentStore
from core.world import clone_world, seed_world

load_environment()


@asynccontextmanager
async def lifespan(app: FastAPI):
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
agent_store = AgentStore()
live_service = LiveExecutionService(agent_store)
oauth_manager = GoogleOAuthManager(agent_store)


def _user_id(request: Request) -> str:
    if request.client and request.client.host == "testclient":
        return request.cookies.get("sawal_user_id", "guest_user")
    return request.cookies.get("sawal_user_id", "guest_user")


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
    llm_mode: str | None = None
    tool_mode: str = Field(default="mock", pattern="^(mock|live)$")


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


class ConfirmActionRequest(BaseModel):
    action_id: str = Field(min_length=1)
    idempotency_key: str = Field(min_length=16)


class CancelActionRequest(BaseModel):
    action_id: str = Field(min_length=1)


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


# Router definitions
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
        "gemma_model_id": os.getenv("GEMMA_MODEL_ID", os.getenv("SAWAL_MODEL", "gemma-4-26b-a4b-it")),
        "llm_mode": mode,
        "reversibility_weights": {
            "email.send": 1.0,
            "restaurants.book": 0.7,
            "calendar.create_event": 0.4,
            "expenses.log": 0.3,
            "email.draft": 0.1,
        },
    }


@router.get("/me")
def get_me(request: Request):
    return {
        "user_id": _user_id(request),
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
    user_id = _user_id(request)
    execution_world = world
    if request_body.tool_mode == "live":
        execution_world = clone_world(world)
        execution_world = live_service.enrich_world_contacts(user_id, request_body.request_text, execution_world)
    session = create_session(request_body.request_text, execution_world, llm_mode=request_body.llm_mode)
    session["user_id"] = user_id
    session["tool_mode"] = request_body.tool_mode
    if request_body.tool_mode == "live":
        session["_simulation_world"] = execution_world
        live_service.prepare_session(session, user_id)
    sessions[session["id"]] = session
    return _public(session)


@router.get("/sessions")
def list_sessions(request: Request, cursor: str | None = None, limit: int = Query(default=20, ge=1, le=100)):
    user_id = _user_id(request)
    items = sorted((item for item in sessions.values() if item.get("user_id") == user_id), key=lambda x: x["created_at"], reverse=True)
    if cursor:
        items = [item for item in items if item["created_at"] < cursor and item["id"] != cursor]
    page = items[:limit]
    return {
        "items": [_public(item) for item in page],
        "next_cursor": page[-1]["created_at"] if len(items) > limit and page else None,
        "has_more": len(items) > limit,
    }


@router.get("/sessions/{session_id}")
def get_session(session_id: str, request: Request):
    session = sessions.get(session_id)
    if not session or session.get("user_id") != _user_id(request):
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Session not found"})
    return _public(session)


@router.post("/sessions/{session_id}/answer")
def answer(session_id: str, request_body: AnswerRequest, request: Request):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Session not found"})
    if session.get("user_id") != _user_id(request):
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Session not found"})
    try:
        execution_world = session.get("_simulation_world", world)
        answered = answer_session(session, execution_world, request_body.question_id, request_body.option_id, request_body.free_text)
        if session.get("tool_mode") == "live":
            live_service.prepare_session(answered, _user_id(request))
        return _public(answered)
    except ValueError as exc:
        message = str(exc)
        status = 409 if "not waiting" in message else 422
        raise HTTPException(status, detail={"code": "CONFLICT" if status == 409 else "UNPROCESSABLE_ENTITY", "message": message}) from exc


@router.post("/sessions/{session_id}/confirm")
def confirm_action(session_id: str, request_body: ConfirmActionRequest, request: Request):
    user_id = _user_id(request)
    session = sessions.get(session_id)
    if not session or session.get("user_id") != user_id:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Session not found"})
    if session.get("tool_mode") != "live" or session.get("action", {}).get("id") != request_body.action_id:
        raise HTTPException(409, detail={"code": "CONFLICT", "message": "Session has no matching live action."})
    try:
        action = live_service.execute(request_body.action_id, user_id, request_body.idempotency_key)
        live_service.apply_action_to_session(session, action)
        return _public(session)
    except KeyError as exc:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": str(exc)}) from exc
    except ValueError as exc:
        raise HTTPException(409, detail={"code": "CONFLICT", "message": str(exc)}) from exc


@router.post("/sessions/{session_id}/cancel")
def cancel_action(session_id: str, request_body: CancelActionRequest, request: Request):
    user_id = _user_id(request)
    session = sessions.get(session_id)
    if not session or session.get("user_id") != user_id:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Session not found"})
    try:
        action = live_service.cancel(request_body.action_id, user_id)
        live_service.apply_action_to_session(session, action)
        return _public(session)
    except KeyError as exc:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": str(exc)}) from exc
    except ValueError as exc:
        raise HTTPException(409, detail={"code": "CONFLICT", "message": str(exc)}) from exc


@router.get("/actions")
def list_actions(request: Request, limit: int = Query(default=50, ge=1, le=100)):
    return {"items": [live_service.public_action(action) for action in agent_store.list_actions(_user_id(request), limit)]}


@router.get("/audit")
def list_audit(request: Request, limit: int = Query(default=100, ge=1, le=200)):
    return {"items": agent_store.list_audit(_user_id(request), limit)}


@router.get("/expenses")
def list_expenses(request: Request, limit: int = Query(default=100, ge=1, le=200)):
    return {"items": agent_store.list_expenses(_user_id(request), limit)}


@router.get("/providers/capabilities")
def provider_capabilities(request: Request):
    return live_service.capabilities(_user_id(request))


@router.get("/connections")
def connections(request: Request):
    return {"items": [agent_store.connection_status(_user_id(request), "google")]}


@router.get("/oauth/google/connect")
def google_connect(request: Request):
    try:
        return {"authorization_url": oauth_manager.authorization_url(_user_id(request))}
    except OAuthConfigurationError as exc:
        raise HTTPException(503, detail={"code": "OAUTH_NOT_CONFIGURED", "message": str(exc)}) from exc


@router.get("/oauth/google/callback")
def google_callback(code: str, state: str):
    try:
        oauth_manager.callback(code, state)
    except OAuthConfigurationError as exc:
        raise HTTPException(503, detail={"code": "OAUTH_NOT_CONFIGURED", "message": str(exc)}) from exc
    except OAuthStateError as exc:
        raise HTTPException(400, detail={"code": "INVALID_OAUTH_STATE", "message": str(exc)}) from exc
    except ProviderError as exc:
        raise HTTPException(502, detail={"code": exc.code, "message": str(exc), "details": exc.details}) from exc
    frontend = os.getenv("FRONTEND_URL", "http://localhost:3000")
    return RedirectResponse(f"{frontend}/?google=connected", status_code=302)


@router.delete("/connections/google")
def disconnect_google(request: Request):
    user_id = _user_id(request)
    try:
        live_service.google.revoke(user_id)
    except ProviderError as exc:
        raise HTTPException(502, detail={"code": exc.code, "message": str(exc)}) from exc
    agent_store.audit(user_id, "OAUTH_DISCONNECTED", {}, provider="google")
    return {"provider": "google", "connected": False}


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
            "models": (req.models if req and req.models else ["gemma-4-26b-a4b-it"]),
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


# Mount routes at both /v1 prefix and root prefix
app.include_router(router, prefix="/v1")
app.include_router(router)
