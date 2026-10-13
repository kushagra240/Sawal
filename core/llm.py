"""Hosted/open-weight LLM proposal client for Sawal."""

from __future__ import annotations

from collections import deque
import hashlib
import json
import os
from pathlib import Path
import re
import threading
import time
import urllib.error
import urllib.request

from .tools import validate_call


OPEN_MODEL_PREFIXES = (
    "gemma",
    "llama",
    "mistral",
    "qwen",
    "deepseek",
    "phi",
)

_RATE_LOCK = threading.Lock()
_RATE_TIMES: deque[float] = deque()


def _normalize_model(model: str) -> str:
    model = model.strip()
    if model.startswith("models/"):
        model = model[len("models/"):]
    return model


def ensure_open_weight_model(model: str | None = None) -> str:
    selected = model or os.getenv("GEMMA_MODEL_ID") or os.getenv("SAWAL_MODEL")

    if not selected:
        raise ValueError(
            "No model configured. Set GEMMA_MODEL_ID or SAWAL_MODEL."
        )

    selected = _normalize_model(selected)

    env_families = [
        x.strip().casefold()
        for x in os.getenv("ALLOWED_MODEL_FAMILIES", "").split(",")
        if x.strip()
    ]

    allowed = tuple(env_families) if env_families else OPEN_MODEL_PREFIXES

    if not selected.casefold().startswith(allowed):
        raise ValueError(
            f"Model `{selected}` is not in Sawal's open-weight model allowlist."
        )

    return selected


def _prompt(request_text: str, world: dict, count: int) -> str:
    return (
        'Return ONLY one valid JSON object with this structure: '
        '{"interpretations":[{"id":"interp-01","rationale":"...",'
        '"slots":{},"plan":[{"tool":"...","args":{}}]}]}. '
        f"Generate up to {count} distinct valid interpretations. "
        "Allowed tools only: "
        "contacts.search(query), "
        "calendar.list(start_date,end_date), "
        "calendar.create_event(title,start_time,end_time), "
        "restaurants.search(query), "
        "restaurants.book(restaurant_id,date_time,party_size), "
        "email.draft(to,subject,body), "
        "email.send(to,subject,body), "
        "expenses.log(amount,currency,description). "
        "Use IDs and email addresses that exist in the supplied world. "
        "Never invent contacts. "
        "Allowed ambiguity slots: contact_id, restaurant_id, date_time, "
        "party_size, subject, body. "
        "For a first name matching multiple contacts, create interpretations "
        "for the different contacts and set contact_id. "
        "Recipient identity is more important than wording differences.\n\n"
        f"USER REQUEST:\n{request_text}\n\n"
        f"WORLD:\n{json.dumps(world, ensure_ascii=False)}"
    )


def _rate_limit() -> None:
    rpm = max(1, int(os.getenv("LLM_MAX_RPM", "10")))

    while True:
        with _RATE_LOCK:
            now = time.monotonic()

            while _RATE_TIMES and now - _RATE_TIMES[0] >= 60:
                _RATE_TIMES.popleft()

            if len(_RATE_TIMES) < rpm:
                _RATE_TIMES.append(now)
                return

            wait_for = max(0.05, 60 - (now - _RATE_TIMES[0]))

        time.sleep(wait_for)


def _cache_dir() -> Path:
    return Path(
        os.getenv(
            "LLM_REPLAY_CACHE_DIR",
            "benchmark/replay_cache",
        )
    )


def _cache_key(provider: str, model: str, prompt: str) -> str:
    raw = json.dumps(
        {
            "provider": provider,
            "model": model,
            "prompt": prompt,
        },
        sort_keys=True,
        ensure_ascii=False,
    ).encode("utf-8")

    return hashlib.sha256(raw).hexdigest()


def _read_cache(key: str) -> dict | None:
    path = _cache_dir() / f"{key}.json"

    if not path.is_file():
        return None

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _write_cache(key: str, record: dict) -> None:
    path = _cache_dir()
    path.mkdir(parents=True, exist_ok=True)

    (path / f"{key}.json").write_text(
        json.dumps(record, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _extract_json(text: str) -> dict | list:
    """Extract the best JSON object from verbose model output."""
    text = text.strip()

    decoder = json.JSONDecoder()

    # Prefer fenced JSON blocks.
    fence_start = 0
    fenced_objects = []

    while True:
        marker = text.find("```", fence_start)
        if marker == -1:
            break

        content_start = text.find("\n", marker)
        if content_start == -1:
            break

        fence_end = text.find("```", content_start + 1)
        if fence_end == -1:
            break

        block = text[content_start + 1:fence_end].strip()

        if block.lower().startswith("json"):
            block = block[4:].strip()

        try:
            obj = json.loads(block)
            fenced_objects.append(obj)

            if (
                isinstance(obj, dict)
                and isinstance(obj.get("interpretations"), list)
            ):
                return obj
        except json.JSONDecodeError:
            pass

        fence_start = fence_end + 3

    # Scan all JSON object starts in the response.
    candidates = []

    for i, ch in enumerate(text):
        if ch != "{":
            continue

        try:
            obj, _ = decoder.raw_decode(text[i:])
            candidates.append(obj)

            if (
                isinstance(obj, dict)
                and isinstance(obj.get("interpretations"), list)
            ):
                return obj
        except json.JSONDecodeError:
            continue

    if candidates:
        return candidates[-1]

    raise ValueError("No valid JSON object found in model response.")

def _validate_items(parsed: dict | list, count: int) -> list[dict]:
    items = (
        parsed.get("interpretations", [])
        if isinstance(parsed, dict)
        else parsed
    )

    if not isinstance(items, list):
        return []

    valid: list[dict] = []
    seen: set[str] = set()

    for index, item in enumerate(items):
        if len(valid) >= count:
            break

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

        fingerprint = json.dumps(
            {
                "slots": item.get("slots", {}),
                "plan": plan,
            },
            sort_keys=True,
            ensure_ascii=False,
        )

        if fingerprint in seen:
            continue

        seen.add(fingerprint)

        valid.append(
            {
                "id": str(item.get("id") or f"interp-{index + 1:02d}"),
                "rationale": str(
                    item.get(
                        "rationale",
                        "Model-proposed interpretation.",
                    )
                ),
                "slots": (
                    item.get("slots", {})
                    if isinstance(item.get("slots", {}), dict)
                    else {}
                ),
                "plan": plan,
            }
        )

    return valid


def _gemini_call(model: str, prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set.")

    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
        },
    }

    return _http_json_call(
        endpoint=endpoint,
        payload=payload,
        headers={"Content-Type": "application/json"},
        response_parser=lambda raw: raw["candidates"][0]["content"]["parts"][0]["text"],
    )


def _openai_compatible_call(model: str, prompt: str) -> str:
    base = os.getenv(
        "OPENAI_BASE_URL",
        "http://localhost:11434/v1",
    ).rstrip("/")

    api_key = os.getenv("OPENAI_API_KEY", "")

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": prompt,
            }
        ],
        "temperature": 0.2,
    }

    headers = {
        "Content-Type": "application/json",
    }

    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    return _http_json_call(
        endpoint=f"{base}/chat/completions",
        payload=payload,
        headers=headers,
        response_parser=lambda raw: raw["choices"][0]["message"]["content"],
    )


def _http_json_call(
    endpoint: str,
    payload: dict,
    headers: dict,
    response_parser,
) -> str:
    timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
    retries = max(0, int(os.getenv("LLM_MAX_RETRIES", "3")))

    last_error: Exception | None = None

    for attempt in range(retries + 1):
        _rate_limit()

        request = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            with urllib.request.urlopen(
                request,
                timeout=timeout,
            ) as response:
                raw = json.loads(response.read().decode("utf-8"))

            return response_parser(raw)

        except urllib.error.HTTPError as exc:
            last_error = exc

            if exc.code != 429 and not (500 <= exc.code <= 599):
                body = ""

                try:
                    body = exc.read().decode("utf-8")[:500]
                except Exception:
                    pass

                raise RuntimeError(
                    f"LLM HTTP {exc.code}: {body}"
                ) from exc

        except (
            urllib.error.URLError,
            TimeoutError,
            OSError,
            KeyError,
            ValueError,
            TypeError,
        ) as exc:
            last_error = exc

        if attempt < retries:
            time.sleep(min(2 ** attempt, 8))

    raise RuntimeError(
        f"LLM request failed after retries: {last_error}"
    )


def propose_with_meta(
    request_text: str,
    world: dict,
    count: int = 5,
    mode: str | None = None,
) -> tuple[list[dict] | None, dict]:
    provider = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
    model = ensure_open_weight_model()

    selected_mode = (
        mode
        or os.getenv("LLM_MODE")
        or os.getenv("SAWAL_LLM_MODE")
        or "auto"
    ).strip().lower()

    if selected_mode not in {"live", "record", "replay", "auto"}:
        selected_mode = "auto"

    prompt = _prompt(request_text, world, count)
    key = _cache_key(provider, model, prompt)

    started = time.perf_counter()

    def metadata(
        kind: str,
        plans: list[dict] | None,
        reason: str | None = None,
    ) -> dict:
        result = {
            "kind": kind,
            "model": model,
            "valid_plans": len(plans or []),
            "latency_ms": int(
                (time.perf_counter() - started) * 1000
            ),
        }

        if reason:
            result["fallback_reason"] = reason

        return result

    if selected_mode == "replay":
        cached = _read_cache(key)

        if cached:
            plans = cached.get("interpretations", [])
            plans = _validate_items(plans, count)

            return plans, metadata("replay", plans)

        return None, metadata(
            "deterministic_fallback",
            None,
            "replay_cache_miss",
        )

    def live_call() -> list[dict]:
        if provider == "gemini":
            text = _gemini_call(model, prompt)
        elif provider == "openai_compatible":
            text = _openai_compatible_call(model, prompt)
        else:
            raise ValueError(
                "LLM_PROVIDER must be gemini or openai_compatible."
            )

        parsed = _extract_json(text)
        return _validate_items(parsed, count)

    if selected_mode in {"live", "record"}:
        try:
            plans = live_call()

            if not plans:
                raise RuntimeError(
                    "Model returned zero valid plans."
                )

            if selected_mode == "record":
                _write_cache(
                    key,
                    {
                        "provider": provider,
                        "model": model,
                        "prompt_hash": key,
                        "interpretations": plans,
                    },
                )

            return plans, metadata("llm", plans)

        except Exception as exc:
            if os.getenv("SAWAL_STRICT", "0") == "1":
                raise

            return None, metadata(
                "deterministic_fallback",
                None,
                str(exc),
            )

    # AUTO: live -> replay -> fallback
    try:
        plans = live_call()

        if plans:
            return plans, metadata("llm", plans)

    except Exception as live_exc:
        cached = _read_cache(key)

        if cached:
            plans = _validate_items(
                cached.get("interpretations", []),
                count,
            )

            if plans:
                return plans, metadata(
                    "replay",
                    plans,
                    f"live_failed: {live_exc}",
                )

        if os.getenv("SAWAL_STRICT", "0") == "1":
            raise

        return None, metadata(
            "deterministic_fallback",
            None,
            f"live_failed_and_no_replay: {live_exc}",
        )

    return None, metadata(
        "deterministic_fallback",
        None,
        "model_returned_no_valid_plans",
    )


def propose(
    request_text: str,
    world: dict,
    count: int = 5,
) -> list[dict] | None:
    plans, _ = propose_with_meta(
        request_text,
        world,
        count,
    )
    return plans
