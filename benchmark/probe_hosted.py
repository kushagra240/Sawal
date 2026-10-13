"""Manual hosted-Gemma smoke probe. Requires GEMINI_API_KEY and uses real API calls."""

from __future__ import annotations

import json
import os

from core import llm
from core.engine import propose_interpretations
from core.world import seed_world

DEMO_REQUESTS = [
    ("calendar", "Check my calendar for tomorrow afternoon."),
    ("lunch_spot", "Find a quiet spot for team lunch near campus."),
    ("priya_email", "Send an email to Priya confirming the lab slot."),
    ("note_and_expense", "Draft a note to Rohan about tea and log 40 rupees for tea."),
    ("seminar_hall", "Schedule a seminar hall event tomorrow at 3 pm."),
]


def main() -> None:
    if not os.getenv("GEMINI_API_KEY", "").strip():
        raise SystemExit("GEMINI_API_KEY is required for the hosted probe; refusing fallback evidence.")
    os.environ.setdefault("SAWAL_STRICT", "1")
    llm.reset_call_stats()
    rows = []
    for name, request in DEMO_REQUESTS:
        interpretations, proposer = propose_interpretations(request, seed_world(), llm_mode="live")
        rows.append({
            "name": name,
            "request": request,
            "model": proposer.get("model"),
            "kind": proposer.get("kind"),
            "latency_ms": proposer.get("latency_ms"),
            "valid_plans": len(interpretations),
            "distinct_plans": llm.distinct_plan_count(interpretations),
            "fallback_reason": proposer.get("fallback_reason"),
        })
    print(json.dumps({"requests": rows, "api_calls": llm.get_call_stats()}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
