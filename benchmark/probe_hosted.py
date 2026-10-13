import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core import llm
from core.world import seed_world


def probe() -> None:
    provider = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
    model = llm.ensure_open_weight_model()
    has_key = bool(os.getenv("GEMINI_API_KEY") if provider == "gemini" else os.getenv("OPENAI_API_KEY"))

    print("=======================================================")
    print("HOSTED GEMMA PROBE")
    print("=======================================================")
    print(f"Provider: {provider}")
    print(f"Model: {model}")
    print(f"Credentials Present: {has_key} ({'Key available' if has_key else 'Missing API credentials: GEMINI_API_KEY / OPENAI_API_KEY not set'})")
    print("=======================================================\n")

    tests = [
        "Check my calendar for tomorrow afternoon.",
        "Find a quiet spot for team lunch near campus.",
        "Send an email to Priya confirming the lab slot.",
        "Draft a note for the study group and log 40 rupees for tea.",
        "Book a seminar hall for tomorrow evening.",
    ]

    summary = {
        "live_hosted": 0,
        "cached_replay": 0,
        "missing_credentials": 0,
        "api_error": 0,
        "deterministic_fallback": 0,
    }

    for text in tests:
        start = time.perf_counter()
        plans, meta = llm.propose_with_meta(text, seed_world(), 5)
        latency = int((time.perf_counter() - start) * 1000)

        kind = meta.get("kind", "deterministic_fallback")
        reason = meta.get("fallback_reason") or ""

        if kind == "llm":
            classification = "REAL_SUCCESSFUL_HOSTED_GEMMA"
            summary["live_hosted"] += 1
        elif kind == "replay":
            classification = "CACHED_REPLAY"
            summary["cached_replay"] += 1
        elif "not set" in reason.lower() or "missing" in reason.lower() or not has_key:
            classification = "DETERMINISTIC_FALLBACK (Missing Credentials)"
            summary["missing_credentials"] += 1
        elif "http" in reason.lower() or "failed" in reason.lower():
            classification = "DETERMINISTIC_FALLBACK (API Error)"
            summary["api_error"] += 1
        else:
            classification = "DETERMINISTIC_FALLBACK"
            summary["deterministic_fallback"] += 1

        print(f"REQUEST: {text}")
        print(f"CLASSIFICATION: [{classification}]")
        print(f"LATENCY_MS: {latency}")
        if reason:
            print(f"NOTE / REASON: {reason}")
        plans = plans or []
        print(f"PLANS_RETURNED: {len(plans)}")
        for i, p in enumerate(plans, 1):
            print(f"  {i}. {p}")
        print("-" * 55)

    print("\nPROBE SUMMARY:")
    print(f"  Real Successful Hosted Gemma:  {summary['live_hosted']}")
    print(f"  Cached Replay Hits:            {summary['cached_replay']}")
    print(f"  Missing Credentials Fallbacks: {summary['missing_credentials']}")
    print(f"  API Error Fallbacks:           {summary['api_error']}")
    print(f"  Other Deterministic Fallbacks: {summary['deterministic_fallback']}")
    if summary["live_hosted"] == 0 and not has_key:
        print("\nDIAGNOSIS: No live hosted model responses were received because credentials (GEMINI_API_KEY) are not set.")
        print("          All requests were safely handled via cached replay or deterministic fallback.")


if __name__ == "__main__":
    probe()
