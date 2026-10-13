import io
import json
import urllib.error

import pytest

from core import llm
from core.world import seed_world


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def valid_json_text():
    return json.dumps({
        "interpretations": [
            {
                "id": "interp-01",
                "rationale": "Read calendar",
                "slots": {},
                "plan": [{"tool": "calendar.list", "args": {"start_date": "2026-10-14", "end_date": "2026-10-15"}}],
            }
        ]
    })


@pytest.fixture(autouse=True)
def llm_env(monkeypatch, tmp_path):
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMMA_MODEL_ID", "gemma-4-26b-a4b-it")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-never-sent")
    monkeypatch.setenv("LLM_MAX_RPM", "1000")
    monkeypatch.setenv("LLM_MAX_RETRIES", "0")
    monkeypatch.setenv("LLM_REPLAY_CACHE_DIR", str(tmp_path / "cache"))
    monkeypatch.delenv("SAWAL_STRICT", raising=False)
    llm._rate_limiter.reset_for_tests()
    llm.reset_call_stats()


def test_gemini_http_is_mocked_and_validated(monkeypatch):
    raw = {"candidates": [{"content": {"parts": [{"text": valid_json_text()}]}}]}
    monkeypatch.setattr(llm, "_urlopen", lambda request, timeout: FakeResponse(raw))
    outcome = llm.propose_with_meta("Check my calendar tomorrow.", seed_world(), mode="live")
    assert outcome.proposer["kind"] == "llm"
    assert outcome.proposer["model"] == "gemma-4-26b-a4b-it"
    assert outcome.proposer["valid_plans"] == 1
    assert outcome.interpretations[0]["plan"][0]["tool"] == "calendar.list"
    assert llm.get_call_stats()["total"] == 1


def test_invalid_tool_from_model_is_dropped(monkeypatch):
    text = json.dumps({"interpretations": [{"plan": [{"tool": "shell.exec", "args": {}}]}]})
    raw = {"candidates": [{"content": {"parts": [{"text": text}]}}]}
    monkeypatch.setattr(llm, "_urlopen", lambda request, timeout: FakeResponse(raw))
    outcome = llm.propose_with_meta("Do something", seed_world(), mode="live")
    assert outcome.interpretations is None
    assert outcome.proposer["kind"] == "deterministic_fallback"
    assert "no schema-valid plans" in outcome.proposer["fallback_reason"]


def test_record_then_replay_without_network(monkeypatch):
    raw = {"candidates": [{"content": {"parts": [{"text": valid_json_text()}]}}]}
    monkeypatch.setattr(llm, "_urlopen", lambda request, timeout: FakeResponse(raw))
    recorded = llm.propose_with_meta("Check my calendar tomorrow.", seed_world(), mode="record")
    assert recorded.proposer["kind"] == "llm"

    def fail_network(*args, **kwargs):
        raise AssertionError("replay must not use network")

    monkeypatch.setattr(llm, "_urlopen", fail_network)
    replayed = llm.propose_with_meta("Check my calendar tomorrow.", seed_world(), mode="replay")
    assert replayed.proposer["kind"] == "replay"
    assert replayed.interpretations == recorded.interpretations


def test_openai_response_format_rejection_retries_once_without_it(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openai_compatible")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://example.invalid/v1")
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    monkeypatch.setenv("LLM_RESPONSE_FORMAT", "auto")
    llm._openai_json_mode_supported = None
    calls = []

    def fake_urlopen(request, timeout):
        body = json.loads(request.data.decode("utf-8"))
        calls.append(body)
        if len(calls) == 1:
            raise urllib.error.HTTPError(request.full_url, 400, "unsupported response_format", {}, io.BytesIO(b"{}"))
        return FakeResponse({"choices": [{"message": {"content": valid_json_text()}}]})

    monkeypatch.setattr(llm, "_urlopen", fake_urlopen)
    outcome = llm.propose_with_meta("Check my calendar tomorrow.", seed_world(), mode="live")
    assert outcome.proposer["kind"] == "llm"
    assert len(calls) == 2
    assert "response_format" in calls[0]
    assert "response_format" not in calls[1]
    assert llm._openai_json_mode_supported is False


def test_strict_mode_refuses_fallback(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("SAWAL_STRICT", "1")
    with pytest.raises(RuntimeError, match="refused deterministic fallback"):
        llm.propose_with_meta("Check my calendar tomorrow.", seed_world(), mode="live")


def test_verbose_gemma_response_prefers_final_interpretations():
    verbose = (
        'Reasoning: {"tool":"email.send"} and {"contact_id":"priya-sharma"}\n'
        'Final answer:\n```json\n' + valid_json_text() + '\n```\n'
        'Extra explanation after final JSON.'
    )
    plans = llm._parse_json_text(verbose)
    assert plans is not None
    assert len(plans) == 1
    assert plans[0]["plan"][0]["tool"] == "calendar.list"
