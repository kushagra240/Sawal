import json
import pytest

from core.live import LiveExecutionService
from core.oauth import GoogleOAuthManager, OAuthConfigurationError, OAuthStateError
from core.providers.base import ProviderError
from core.providers.google import GoogleProvider
from core.storage import AgentStore, CredentialCipher


class FakeGoogle:
    def __init__(self, fail=False):
        self.calls = []
        self.fail = fail

    def capabilities(self, user_id):
        return [{"tool": "email.send", "available": True}]

    def execute(self, call, context):
        self.calls.append((call, context))
        if self.fail:
            raise ProviderError("upstream timed out", retryable=True)
        if call["tool"] == "email.send":
            return {
                "provider": "gmail",
                "status": "accepted_by_gmail",
                "message_id": "msg-real-123",
                "delivery_claim": "Accepted by Gmail for sending; recipient delivery or reading is not asserted.",
            }
        if call["tool"] == "email.draft":
            return {"provider": "gmail", "status": "draft_created", "draft_id": "draft-123"}
        return {"provider": "google", "status": "ok"}


@pytest.fixture
def store():
    return AgentStore(":memory:", CredentialCipher("test-only-secret"))


def send_session():
    return {
        "id": "session-1",
        "status": "completed",
        "result": {
            "executed_plan": [{"tool": "email.send", "args": {"to": "person@example.com", "subject": "Hello", "body": "Body"}}]
        },
        "trace": [],
    }


def test_live_send_requires_confirmation_and_executes_once(store):
    google = FakeGoogle()
    service = LiveExecutionService(store, google=google)
    session = service.prepare_session(send_session(), "user-a")
    assert session["status"] == "awaiting_confirmation"
    assert google.calls == []
    action = session["action"]

    completed = service.execute(action["id"], "user-a", action["idempotency_key"])
    duplicate = service.execute(action["id"], "user-a", action["idempotency_key"])

    assert completed["state"] == "completed"
    assert duplicate["result"]["tool_results"][0]["result"]["message_id"] == "msg-real-123"
    assert len(google.calls) == 1


def test_cancelled_action_never_executes(store):
    google = FakeGoogle()
    service = LiveExecutionService(store, google=google)
    session = service.prepare_session(send_session(), "user-a")
    action = service.cancel(session["action"]["id"], "user-a")
    assert action["state"] == "cancelled"
    with pytest.raises(ValueError, match="cancelled"):
        service.execute(action["id"], "user-a", action["idempotency_key"])
    assert google.calls == []


def test_action_ownership_is_enforced(store):
    service = LiveExecutionService(store, google=FakeGoogle())
    session = service.prepare_session(send_session(), "owner")
    action_id = session["action"]["id"]
    assert store.get_action(action_id, "attacker") is None
    with pytest.raises(KeyError):
        service.execute(action_id, "attacker", session["action"]["idempotency_key"])


def test_provider_failure_is_truthful_and_retryable(store):
    service = LiveExecutionService(store, google=FakeGoogle(fail=True))
    session = service.prepare_session(send_session(), "user-a")
    action = service.execute(session["action"]["id"], "user-a", session["action"]["idempotency_key"])
    assert action["state"] == "failed"
    assert action["result"] is None
    assert action["error"] == {
        "code": "PROVIDER_ERROR",
        "message": "upstream timed out",
        "retryable": True,
        "details": {},
    }


def test_draft_executes_without_send_claim(store):
    google = FakeGoogle()
    service = LiveExecutionService(store, google=google)
    session = send_session()
    session["result"]["executed_plan"][0]["tool"] = "email.draft"
    prepared = service.prepare_session(session, "user-a")
    assert prepared["status"] == "completed"
    result = prepared["result"]["tool_results"][0]["result"]
    assert result["status"] == "draft_created"
    assert "delivery" not in json.dumps(result).lower()


def test_restaurant_live_booking_never_fakes_success(store):
    service = LiveExecutionService(store, google=FakeGoogle())
    session = send_session()
    session["result"]["executed_plan"] = [{"tool": "restaurants.book", "args": {"restaurant_id": "x", "date_time": "2030-01-01T19:00:00Z", "party_size": 2}}]
    prepared = service.prepare_session(session, "user-a")
    failed = service.execute(prepared["action"]["id"], "user-a", prepared["action"]["idempotency_key"])
    assert failed["state"] == "failed"
    assert "no booking was made" in failed["error"]["message"].lower()


def test_credentials_are_encrypted_at_rest():
    store = AgentStore(":memory:", CredentialCipher("stable-test-key"))
    store.save_connection("u1", "google", {"access_token": "plain-secret-token", "refresh_token": "refresh-secret"}, ["scope"])
    encrypted = store._connection.execute(
        "SELECT encrypted_credentials FROM provider_connections WHERE user_id='u1'"
    ).fetchone()[0]
    assert "plain-secret-token" not in encrypted
    assert store.get_connection("u1", "google")["credentials"]["access_token"] == "plain-secret-token"


def test_oauth_missing_config_and_invalid_state(store, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)
    oauth = GoogleOAuthManager(store)
    with pytest.raises(OAuthConfigurationError):
        oauth.authorization_url("u1")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "secret")
    with pytest.raises(OAuthStateError):
        oauth.callback("code", "unknown-state")


def test_expired_access_token_is_refreshed(store, monkeypatch):
    store.save_connection(
        "u1", "google",
        {"access_token": "expired", "refresh_token": "refresh", "expires_at": "2000-01-01T00:00:00Z"},
        ["scope"],
    )
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "secret")
    monkeypatch.setattr(GoogleProvider, "_request_json", staticmethod(lambda *args, **kwargs: {"access_token": "fresh", "expires_in": 3600}))
    provider = GoogleProvider(store)
    assert provider._access_token("u1") == "fresh"
    assert store.get_connection("u1", "google")["credentials"]["access_token"] == "fresh"


def test_gmail_send_response_parsing(store, monkeypatch):
    provider = GoogleProvider(store)
    monkeypatch.setattr(provider, "_access_token", lambda user_id: "token")
    monkeypatch.setattr(provider, "_api", lambda *args, **kwargs: {"id": "msg-1", "threadId": "thread-1", "labelIds": ["SENT"]})
    from core.providers.base import ExecutionContext
    result = provider.execute(
        {"tool": "email.send", "args": {"to": "person@example.com", "subject": "Hi", "body": "Body"}},
        ExecutionContext("u1", "a1", "key"),
    )
    assert result["status"] == "accepted_by_gmail"
    assert result["message_id"] == "msg-1"
    assert "delivery or reading is not asserted" in result["delivery_claim"]
