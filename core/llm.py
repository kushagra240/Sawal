"""Small OpenAI-compatible chat client for Ollama/vLLM; no proprietary model SDK."""

import json
import os
import urllib.error
import urllib.request

OPEN_MODEL_PREFIXES = ("gemma", "llama", "mistral", "qwen", "deepseek", "phi")


def ensure_open_weight_model(model: str | None = None) -> str:
    selected = (model or os.getenv("SAWAL_MODEL", os.getenv("GEMMA_MODEL_ID", "gemma4:e2b"))).strip()
    env_families = [x.strip().casefold() for x in os.getenv("ALLOWED_MODEL_FAMILIES", "").split(",") if x.strip()]
    allowed = tuple(env_families) if env_families else OPEN_MODEL_PREFIXES
    if not selected.casefold().startswith(allowed):
        raise ValueError(f"Model `{selected}` is not in Sawal's open-weight model allowlist.")
    return selected


def propose(request_text: str, world: dict, count: int = 5) -> list[dict] | None:
    base = os.getenv("OPENAI_BASE_URL", "http://localhost:11434/v1").rstrip("/")
    model = ensure_open_weight_model()
    prompt = (
        "Return only JSON: {\"interpretations\":[{\"id\":\"interp-01\",\"rationale\":\"...\","
        "\"slots\":{},\"plan\":[{\"tool\":\"...\",\"args\":{...}}]}]}. "
        f"Create up to {count} genuinely distinct, valid interpretations for this request. "
        "Only use these tools: contacts.search(query), calendar.list(start_date,end_date), "
        "calendar.create_event(title,start_time,end_time), restaurants.search(query), "
        "restaurants.book(restaurant_id,date_time,party_size), email.draft(to,subject,body), "
        "email.send(to,subject,body), expenses.log(amount,currency,description). "
        "Use entity IDs/emails from the world. Never invent contacts or execute anything outside the mock world. "
        f"Request: {request_text}\nWorld: {json.dumps(world, ensure_ascii=False)}"
    )
    payload = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2, "response_format": {"type": "json_object"}}).encode()
    timeout = float(os.getenv("SAWAL_LLM_TIMEOUT", os.getenv("LLM_TIMEOUT_SECONDS", "8")))
    request = urllib.request.Request(
        f"{base}/chat/completions", data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY', 'ollama')}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = json.loads(response.read().decode())
        content = raw["choices"][0]["message"]["content"]
        content = content.strip()
        if content.startswith("```"):
            content = content.strip("`")
            if content.startswith("json"):
                content = content[4:]
        parsed = json.loads(content)
        items = parsed.get("interpretations", []) if isinstance(parsed, dict) else parsed
        return items if isinstance(items, list) and items else None
    except (OSError, ValueError, KeyError, TypeError, urllib.error.URLError):
        return None
