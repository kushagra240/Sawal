"""Hosted open-weight LLM client with retries, replay, and provenance.

The default provider is Google's Gemini API serving Gemma 4.  No API key is ever
logged or persisted.  The compatibility ``propose`` function still returns only
interpretations; ``propose_with_meta`` additionally exposes provenance.
"""

from __future__ import annotations

from collections import Counter, deque
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
from threading import Condition, Lock
import time
from typing import Any
import urllib.error
import urllib.parse
import urllib.request

from .tools import validate_call

OPEN_MODEL_PREFIXES = ("gemma", "llama", "mistral", "qwen", "deepseek", "phi")
VALID_PROVIDERS = {"gemini", "openai_compatible"}
VALID_MODES = {"live", "record", "replay", "auto", "mock"}  # mock is legacy/internal only.

# Verified in Google's Gemma-on-Gemini-API documentation (2026-10-13).
DEFAULT_GEMMA_MODEL = "gemma-4-26b-a4b-it"
DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"


@dataclass
class ProposalOutcome:
    interpretations: list[dict] | None
    proposer: dict


class _SharedRateLimiter:
    """Process-wide sliding-window RPM limiter with queued callers."""

    def __init__(self) -> None:
        self._condition = Condition()
        self._timestamps: deque[float] = deque()

    def acquire(self) -> None:
        rpm = max(1, int(os.getenv("LLM_MAX_RPM", "10")))
        with self._condition:
            while True:
                now = time.monotonic()
                while self._timestamps and now - self._timestamps[0] >= 60.0:
                    self._timestamps.popleft()
                if len(self._timestamps) < rpm:
                    self._timestamps.append(now)
                    self._condition.notify_all()
                    return
                wait_for = max(0.01, 60.0 - (now - self._timestamps[0]))
                self._condition.wait(timeout=wait_for)

    def reset_for_tests(self) -> None:
        with self._condition:
            self._timestamps.clear()
            self._condition.notify_all()


_rate_limiter = _SharedRateLimiter()
_urlopen = urllib.request.urlopen
_openai_json_mode_supported: bool | None = None
_call_stats_lock = Lock()
_call_stats: Counter[str] = Counter()


def _provider() -> str:
    provider = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
    if provider not in VALID_PROVIDERS:
        raise ValueError(f"Unsupported LLM_PROVIDER `{provider}`; expected one of {sorted(VALID_PROVIDERS)}")
    return provider


def _normalize_model_name(model: str) -> str:
    selected = model.strip()
    if selected.casefold().startswith("models/"):
        selected = selected.split("/", 1)[1]
    return selected


def ensure_open_weight_model(model: str | None = None, provider: str | None = None) -> str:
    """Return a normalized open-weight model ID and reject closed model families."""
    selected_provider = provider or _provider()
    configured = model or os.getenv("GEMMA_MODEL_ID") or os.getenv("SAWAL_MODEL")
    selected = _normalize_model_name(configured or DEFAULT_GEMMA_MODEL)

    env_families = [
        x.strip().casefold()
        for x in os.getenv("ALLOWED_MODEL_FAMILIES", "").split(",")
        if x.strip()
    ]
    allowed = tuple(env_families) if env_families else OPEN_MODEL_PREFIXES
    if not selected.casefold().startswith(allowed):
        raise ValueError(f"Model `{selected}` is not in Sawal's open-weight model allowlist.")
    if selected_provider == "gemini" and not selected.casefold().startswith("gemma"):
        # Hosted Gemini provider is intentionally scoped to the hackathon's open-weight Gemma path.
        raise ValueError("LLM_PROVIDER=gemini requires a Gemma open-weight model.")
    return selected


def build_prompt(request_text: str, world: dict, count: int = 5) -> str:
    return (
        "Return ONLY one JSON object with this shape: "
        "{\"interpretations\":[{\"id\":\"interp-01\",\"rationale\":\"...\","
        "\"slots\":{},\"plan\":[{\"tool\":\"...\",\"args\":{...}}]}]}. "
        f"Create up to {count} genuinely distinct, valid interpretations for the request. "
        "A plan may contain more than one tool call when the request clearly asks for multiple actions. "
        "Only use these tools: contacts.search(query), calendar.list(start_date,end_date), "
        "calendar.create_event(title,start_time,end_time), restaurants.search(query), "
        "restaurants.book(restaurant_id,date_time,party_size), email.draft(to,subject,body), "
        "email.send(to,subject,body), expenses.log(amount,currency,description). "
        "Use entity IDs/emails from the world. Never invent contacts or execute anything outside the mock world. "
        "The slots object represents unresolved USER choices, never tool names/actions. "
        "Allowed ambiguity slots: contact_id, restaurant_id, date_time, party_size, subject, body. "
        "If a first name matches multiple contacts, create interpretations for those contacts and set contact_id. "
        "Recipient identity has higher priority than subject wording. "
        f"Request: {request_text}\nWorld: {json.dumps(world, ensure_ascii=False, sort_keys=True)}"
    )


def _cache_dir() -> Path:
    return Path(os.getenv("LLM_REPLAY_CACHE_DIR", "benchmark/replay_cache"))


def _cache_key(provider: str, model: str, prompt: str) -> str:
    raw = json.dumps(
        {"provider": provider, "model": model, "prompt": prompt},
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _cache_path(key: str) -> Path:
    return _cache_dir() / f"{key}.json"


def _read_cache(provider: str, model: str, prompt: str) -> list[dict] | None:
    path = _cache_path(_cache_key(provider, model, prompt))
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return None
    items = payload.get("interpretations") if isinstance(payload, dict) else None
    return _validate_generated_items(items)


def _write_cache(
    provider: str,
    model: str,
    prompt: str,
    items: list[dict],
    raw_text: str,
    provider_meta: dict | None = None,
) -> None:
    key = _cache_key(provider, model, prompt)
    path = _cache_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "cache_key": key,
        "provider": provider,
        "model": model,
        "prompt_sha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
        "recorded_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "interpretations": items,
        "raw_text": raw_text,
        "provider_meta": provider_meta or {},
    }
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    temp.replace(path)


def _parse_json_text(content: str) -> list[dict] | None:
    """Find schema-valid interpretations even after verbose model reasoning."""
    text = content.strip()
    decoder = json.JSONDecoder()
    # The model may prepend commentary, embedded JSON snippets, and a final
    # fenced JSON object. Scan each object boundary instead of taking the first.
    for index, char in enumerate(text):
        if char != "{":
            continue
        try:
            parsed, _ = decoder.raw_decode(text[index:])
        except json.JSONDecodeError:
            continue
        if not isinstance(parsed, dict) or not isinstance(parsed.get("interpretations"), list):
            continue
        valid = _validate_generated_items(parsed["interpretations"])
        if valid:
            return valid
    # Support providers that return an array as the root value.
    for index, char in enumerate(text):
        if char != "[":
            continue
        try:
            parsed, _ = decoder.raw_decode(text[index:])
        except json.JSONDecodeError:
            continue
        valid = _validate_generated_items(parsed)
        if valid:
            return valid
    return None

def _validate_generated_items(items: Any) -> list[dict] | None:
    if not isinstance(items, list) or not items:
        return None
    valid: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        plan = item.get("plan")
        if not isinstance(plan, list) or not plan:
            continue
        try:
            for call in plan:
                validate_call(call)
        except (ValueError, TypeError, KeyError):
            continue
        valid.append(item)
    return valid or None


def distinct_plan_count(items: list[dict] | None) -> int:
    """Count semantically distinct plan+slot payloads for live verification reports."""
    seen: set[str] = set()
    for item in items or []:
        normalized = json.dumps(
            {"slots": item.get("slots", {}), "plan": item.get("plan", [])},
            sort_keys=True,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        seen.add(normalized)
    return len(seen)


def _increment_call(provider: str) -> None:
    with _call_stats_lock:
        _call_stats["total"] += 1
        _call_stats[provider] += 1


def reset_call_stats() -> None:
    with _call_stats_lock:
        _call_stats.clear()


def get_call_stats() -> dict[str, int]:
    with _call_stats_lock:
        return dict(_call_stats)


def _request_json(request: urllib.request.Request, timeout: float, provider: str) -> dict:
    max_retries = max(0, int(os.getenv("LLM_MAX_RETRIES", "3")))
    base_backoff = max(0.0, float(os.getenv("LLM_RETRY_BACKOFF_SECONDS", "0.5")))
    attempt = 0
    while True:
        _rate_limiter.acquire()
        _increment_call(provider)
        try:
            with _urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            retryable = exc.code == 429 or 500 <= exc.code <= 599
            if not retryable or attempt >= max_retries:
                raise
        except urllib.error.URLError:
            if attempt >= max_retries:
                raise
        attempt += 1
        if base_backoff:
            time.sleep(base_backoff * (2 ** (attempt - 1)))


def _openai_api_key(base: str) -> str:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key and "generativelanguage.googleapis.com" in base:
        key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise ValueError("OPENAI_API_KEY is required for LLM_PROVIDER=openai_compatible.")
    return key


def _call_openai_compatible(
    model: str,
    prompt: str,
    timeout: float,
) -> tuple[list[dict] | None, str, dict]:
    """Call an OpenAI-compatible endpoint; auto-disable response_format on rejection."""
    global _openai_json_mode_supported

    base = os.getenv("OPENAI_BASE_URL", DEFAULT_OPENAI_BASE_URL).rstrip("/")
    key = _openai_api_key(base)
    json_pref = os.getenv("LLM_RESPONSE_FORMAT", "auto").strip().lower()
    use_json_mode = json_pref != "off" and _openai_json_mode_supported is not False

    def build_request(with_response_format: bool) -> urllib.request.Request:
        body: dict[str, Any] = {
            "model": model,
            "messages": [
                {"role": "system", "content": "Return only the requested JSON object. Do not use markdown."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
        }
        if with_response_format:
            body["response_format"] = {"type": "json_object"}
        return urllib.request.Request(
            f"{base}/chat/completions",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
                "x-goog-api-client": "sawal-hackathon-oai/1.0",
            },
            method="POST",
        )

    try:
        raw = _request_json(build_request(use_json_mode), timeout, "openai_compatible")
        if use_json_mode and json_pref == "auto":
            _openai_json_mode_supported = True
    except urllib.error.HTTPError as exc:
        if use_json_mode and json_pref == "auto" and exc.code in {400, 404, 422}:
            _openai_json_mode_supported = False
            raw = _request_json(build_request(False), timeout, "openai_compatible")
            use_json_mode = False
        else:
            raise

    content = raw["choices"][0]["message"].get("content", "")
    text = str(content)
    return _parse_json_text(text), text, {"response_format": bool(use_json_mode)}


def _call_gemini(
    model: str,
    prompt: str,
    timeout: float,
) -> tuple[list[dict] | None, str, dict]:
    """Call Gemma 4 through the native Gemini API generateContent endpoint.

    Gemma 4's official Gemini API guide explicitly documents system instructions
    and function calling.  It does not document structured-output/JSON mode for
    Gemma 4, so Sawal deliberately requests JSON in text and validates it locally.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is required for LLM_PROVIDER=gemini.")

    base = os.getenv("GEMINI_BASE_URL", DEFAULT_GEMINI_BASE_URL).rstrip("/")
    encoded_model = urllib.parse.quote(model, safe="-._:")
    payload = {
        "systemInstruction": {
            "parts": [{"text": "You are Sawal's planner. Return only valid JSON, without markdown fences."}]
        },
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2},
    }
    request = urllib.request.Request(
        f"{base}/models/{encoded_model}:generateContent",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
            "x-goog-api-client": "sawal-hackathon/1.0",
        },
        method="POST",
    )
    raw = _request_json(request, timeout, "gemini")
    parts = raw["candidates"][0]["content"]["parts"]
    text = "".join(str(part.get("text", "")) for part in parts if isinstance(part, dict))
    return _parse_json_text(text), text, {"response_format": False}


def _live_call(provider: str, model: str, prompt: str) -> tuple[list[dict] | None, str, dict]:
    timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", os.getenv("SAWAL_LLM_TIMEOUT", "60")))
    if provider == "gemini":
        return _call_gemini(model, prompt, timeout)
    return _call_openai_compatible(model, prompt, timeout)


def _strict() -> bool:
    return os.getenv("SAWAL_STRICT", "0").strip().lower() in {"1", "true", "yes", "on"}


def _fallback_outcome(model: str | None, started: float, reason: str) -> ProposalOutcome:
    if _strict():
        raise RuntimeError(f"Strict LLM mode refused deterministic fallback: {reason}")
    return ProposalOutcome(
        None,
        {
            "kind": "deterministic_fallback",
            "model": model,
            "valid_plans": 0,
            "latency_ms": int(round((time.perf_counter() - started) * 1000)),
            "fallback_reason": reason,
        },
    )


def propose_with_meta(
    request_text: str,
    world: dict,
    count: int = 5,
    mode: str | None = None,
) -> ProposalOutcome:
    provider = _provider()
    model = ensure_open_weight_model(provider=provider)
    selected_mode = (mode or os.getenv("SAWAL_LLM_MODE") or os.getenv("LLM_MODE") or "auto").strip().lower()
    if selected_mode not in VALID_MODES:
        raise ValueError(f"Unsupported LLM mode `{selected_mode}`; expected one of {sorted(VALID_MODES)}")

    prompt = build_prompt(request_text, world, count)
    started = time.perf_counter()

    def meta(kind: str, valid_plans: int, fallback_reason: str | None = None) -> dict:
        result: dict[str, Any] = {
            "kind": kind,
            "model": model if kind != "deterministic_fallback" or model else None,
            "valid_plans": int(valid_plans),
            "latency_ms": int(round((time.perf_counter() - started) * 1000)),
        }
        if fallback_reason:
            result["fallback_reason"] = fallback_reason
        return result

    if selected_mode == "mock":
        return _fallback_outcome(model, started, "legacy mock mode requested")

    if selected_mode == "replay":
        cached = _read_cache(provider, model, prompt)
        if cached:
            items = cached[:count]
            return ProposalOutcome(items, meta("replay", len(items)))
        return _fallback_outcome(model, started, "replay cache miss")

    live_error: str | None = None
    try:
        items, raw_text, provider_meta = _live_call(provider, model, prompt)
        if items:
            items = items[:count]
            if selected_mode == "record":
                _write_cache(provider, model, prompt, items, raw_text, provider_meta)
            return ProposalOutcome(items, meta("llm", len(items)))
        live_error = "model response contained no schema-valid plans"
    except (OSError, ValueError, KeyError, TypeError, urllib.error.URLError, urllib.error.HTTPError) as exc:
        # Never include headers/request objects in errors; they can contain credentials.
        live_error = f"{type(exc).__name__}: {exc}"

    if selected_mode == "auto":
        cached = _read_cache(provider, model, prompt)
        if cached:
            items = cached[:count]
            return ProposalOutcome(items, meta("replay", len(items), f"live call failed: {live_error}"))

    return _fallback_outcome(model, started, f"live call failed: {live_error or 'no valid plans'}")


def propose(request_text: str, world: dict, count: int = 5) -> list[dict] | None:
    """Backward-compatible wrapper returning only interpretations."""
    return propose_with_meta(request_text, world, count).interpretations
