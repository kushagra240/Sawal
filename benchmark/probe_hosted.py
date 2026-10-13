import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.config import load_environment
from core import llm
from core.world import seed_world

load_environment()


def probe() -> None:
    provider = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
    model = llm.ensure_open_weight_model()
    raw_key = os.getenv("GEMINI_API_KEY", "").strip() if provider == "gemini" else os.getenv("OPENAI_API_KEY", "").strip()
    has_key = bool(raw_key)

    print("=======================================================")
    print("HOSTED GEMMA PROBE")
    print("=======================================================")
    print(f"Provider:            {provider}")
    print(f"Configured Model:    {model}")
    print(f"Credentials Present: {has_key} ({'Key detected in environment / .env' if has_key else 'Missing API credentials: GEMINI_API_KEY / OPENAI_API_KEY not set'})")
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
        "http_auth_error": 0,
        "model_not_found": 0,
        "timeout_or_network": 0,
        "rate_limit": 0,
        "invalid_output": 0,
        "other_fallback": 0,
    }

    # Controlled short live probe first to check provider availability without hanging
    live_available = False
    controlled_failure_reason = None
    controlled_category = None

    if has_key:
        print("Checking live endpoint availability (controlled 1-request check)...")
        check_start = time.perf_counter()
        try:
            sample_plans, sample_meta = llm.propose_with_meta(tests[0], seed_world(), 5, mode="live")
            check_latency = int((time.perf_counter() - check_start) * 1000)
            if sample_meta.get("kind") == "llm":
                live_available = True
                print(f"  -> Live check SUCCEEDED ({check_latency}ms). Proceeding with live evaluations.\n")
            else:
                controlled_failure_reason = sample_meta.get("fallback_reason") or "Live call returned no plans"
                controlled_category = sample_meta.get("error_category") or llm.classify_failure_reason(controlled_failure_reason, has_key)
                print(f"  -> Live check FAILED: [{controlled_category}] {controlled_failure_reason}")
                print("  -> Bypassing further network timeouts; evaluating replay cache & fallback.\n")
        except Exception as exc:
            controlled_failure_reason = llm._sanitize_message(str(exc))
            controlled_category = llm.classify_failure_reason(controlled_failure_reason, has_key)
            print(f"  -> Live check FAILED: [{controlled_category}] {controlled_failure_reason}")
            print("  -> Bypassing further network timeouts; evaluating replay cache & fallback.\n")
    else:
        print("Credentials missing: running in offline replay / deterministic fallback mode.\n")

    eval_mode = "live" if live_available else "auto"

    for text in tests:
        start = time.perf_counter()
        # If live check failed on a network timeout or auth error, don't repeat the hang
        if has_key and not live_available:
            # Check if cached replay exists
            plans, meta = llm.propose_with_meta(text, seed_world(), 5, mode="replay")
            if not plans:
                # Fallback record
                meta = {
                    "kind": "deterministic_fallback",
                    "fallback_reason": controlled_failure_reason,
                    "error_category": controlled_category,
                    "model": model,
                }
        else:
            plans, meta = llm.propose_with_meta(text, seed_world(), 5, mode=eval_mode)

        latency = int((time.perf_counter() - start) * 1000)
        kind = meta.get("kind", "deterministic_fallback")
        reason = meta.get("fallback_reason") or ""
        cat = meta.get("error_category") or llm.classify_failure_reason(reason, has_key)

        if kind == "llm":
            classification = "REAL_SUCCESSFUL_HOSTED_GEMMA"
            summary["live_hosted"] += 1
        elif kind == "replay":
            classification = "CACHED_REPLAY"
            summary["cached_replay"] += 1
        elif cat == "MISSING_CREDENTIALS":
            classification = "DETERMINISTIC_FALLBACK (Missing Credentials)"
            summary["missing_credentials"] += 1
        elif cat == "HTTP_AUTH_ERROR":
            classification = "DETERMINISTIC_FALLBACK (HTTP Auth / Permission Error)"
            summary["http_auth_error"] += 1
        elif cat == "MODEL_NOT_FOUND_OR_UNSUPPORTED":
            classification = "DETERMINISTIC_FALLBACK (Model Not Found / Unsupported)"
            summary["model_not_found"] += 1
        elif cat in {"TIMEOUT_ERROR", "NETWORK_ERROR"}:
            classification = f"DETERMINISTIC_FALLBACK ({'Timeout' if cat == 'TIMEOUT_ERROR' else 'Network Error'})"
            summary["timeout_or_network"] += 1
        elif cat == "RATE_LIMIT_EXCEEDED":
            classification = "DETERMINISTIC_FALLBACK (Rate Limit / Quota Exceeded)"
            summary["rate_limit"] += 1
        elif cat == "INVALID_MODEL_OUTPUT":
            classification = "DETERMINISTIC_FALLBACK (Invalid Model Output)"
            summary["invalid_output"] += 1
        else:
            classification = "DETERMINISTIC_FALLBACK"
            summary["other_fallback"] += 1

        print(f"REQUEST: {text}")
        print(f"CLASSIFICATION: [{classification}]")
        print(f"LATENCY_MS:     {latency}")
        if reason:
            print(f"NOTE / REASON:  {reason}")
        plans = plans or []
        print(f"PLANS_RETURNED: {len(plans)}")
        for i, p in enumerate(plans, 1):
            print(f"  {i}. {p}")
        print("-" * 55)

    print("\nPROBE SUMMARY:")
    print(f"  Real Successful Hosted Gemma:       {summary['live_hosted']}")
    print(f"  Cached Replay Hits:                 {summary['cached_replay']}")
    print(f"  Missing Credentials Fallbacks:      {summary['missing_credentials']}")
    print(f"  HTTP Auth/Permission Fallbacks:     {summary['http_auth_error']}")
    print(f"  Model Not Found/Unsupported:        {summary['model_not_found']}")
    print(f"  Timeout/Network Fallbacks:          {summary['timeout_or_network']}")
    print(f"  Rate Limit / Quota Fallbacks:       {summary['rate_limit']}")
    print(f"  Invalid Model Output Fallbacks:     {summary['invalid_output']}")
    print(f"  Other Deterministic Fallbacks:      {summary['other_fallback']}")

    # Formulate precise and actionable diagnosis
    print("\nDIAGNOSIS:")
    if summary["live_hosted"] > 0:
        print("  SUCCESS: Received valid live hosted Gemma response(s).")
    elif not has_key:
        print("  CREDENTIALS MISSING: GEMINI_API_KEY is not set.")
        print("  Action: Add your key to D:\\Sawal\\.env (e.g. GEMINI_API_KEY=AIza...) to enable live calls.")
        print("  Offline status: Cached replay and deterministic mock fallbacks are fully functional.")
    elif summary["http_auth_error"] > 0 or controlled_category == "HTTP_AUTH_ERROR":
        print("  AUTHENTICATION ERROR: The provided GEMINI_API_KEY was rejected by Google Gemini API (HTTP 401/403).")
        print("  Action: Check that the API key in D:\\Sawal\\.env is valid and active in Google AI Studio.")
    elif summary["model_not_found"] > 0 or controlled_category == "MODEL_NOT_FOUND_OR_UNSUPPORTED":
        print(f"  MODEL NOT FOUND: Model '{model}' was not found on generativelanguage.googleapis.com (HTTP 404).")
        print("  Action: Verify the model name in GEMMA_MODEL_ID in D:\\Sawal\\.env.")
    elif summary["timeout_or_network"] > 0 or controlled_category in {"TIMEOUT_ERROR", "NETWORK_ERROR"}:
        print("  TIMEOUT / NETWORK ISSUE: Connection to generativelanguage.googleapis.com timed out or failed.")
        print("  Action: Check network connectivity or proxy settings. Offline replay & fallback remain active.")
    elif summary["rate_limit"] > 0 or controlled_category == "RATE_LIMIT_EXCEEDED":
        print("  RATE LIMIT / QUOTA: Quota limit hit on Google Gemini API (HTTP 429).")
        print("  Action: Check quota limits in Google AI Studio or increase retry delay.")
    else:
        print("  All requests were safely resolved via cached replay or deterministic fallback.")


if __name__ == "__main__":
    probe()
