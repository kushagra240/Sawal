import pytest
from fastapi.testclient import TestClient

from api import main


class FakeGoogle:
    def __init__(self):
        self.calls = []

    def capabilities(self, user_id):
        return [{"tool": "email.send", "available": True}]

    def execute(self, call, context):
        self.calls.append(call)
        return {
            "provider": "gmail",
            "status": "accepted_by_gmail",
            "message_id": "api-msg-1",
            "delivery_claim": "Accepted by Gmail for sending; recipient delivery or reading is not asserted.",
        }

    def revoke(self, user_id):
        return None


@pytest.fixture
def client(monkeypatch):
    main.sessions.clear()
    fake = FakeGoogle()
    monkeypatch.setattr(main.live_service, "google", fake)
    client = TestClient(main.app)
    client.cookies.set("sawal_user_id", "owner")
    client.fake_google = fake
    return client


def create_pending_send(client):
    created = client.post(
        "/v1/sessions",
        json={
            "request_text": "Send an email to Priya confirming the lab slot.",
            "llm_mode": "mock",
            "tool_mode": "live",
        },
    )
    assert created.status_code == 201
    session = created.json()
    assert session["status"] == "asked"
    answered = client.post(
        f"/v1/sessions/{session['id']}/answer",
        json={
            "question_id": session["question"]["id"],
            "option_id": session["question"]["options"][0]["id"],
        },
    )
    assert answered.status_code == 200
    pending = answered.json()
    assert pending["status"] == "awaiting_confirmation"
    return pending


def test_live_send_preview_confirm_and_duplicate_prevention(client):
    pending = create_pending_send(client)
    action = pending["action"]
    payload = {"action_id": action["id"], "idempotency_key": action["idempotency_key"]}
    first = client.post(f"/v1/sessions/{pending['id']}/confirm", json=payload)
    second = client.post(f"/v1/sessions/{pending['id']}/confirm", json=payload)
    assert first.status_code == 200
    assert first.json()["status"] == "completed"
    assert first.json()["result"]["tool_results"][0]["result"]["message_id"] == "api-msg-1"
    assert second.status_code == 200
    assert len(client.fake_google.calls) == 1


def test_live_action_cancel(client):
    pending = create_pending_send(client)
    action = pending["action"]
    cancelled = client.post(
        f"/v1/sessions/{pending['id']}/cancel", json={"action_id": action["id"]}
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    confirm = client.post(
        f"/v1/sessions/{pending['id']}/confirm",
        json={"action_id": action["id"], "idempotency_key": action["idempotency_key"]},
    )
    assert confirm.status_code == 409
    assert client.fake_google.calls == []


def test_session_and_action_are_not_visible_to_another_user(client):
    pending = create_pending_send(client)
    client.cookies.set("sawal_user_id", "attacker")
    assert client.get(f"/v1/sessions/{pending['id']}").status_code == 404
    action = pending["action"]
    response = client.post(
        f"/v1/sessions/{pending['id']}/confirm",
        json={"action_id": action["id"], "idempotency_key": action["idempotency_key"]},
    )
    assert response.status_code == 404


def test_oauth_connect_reports_missing_configuration(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)
    response = client.get("/v1/oauth/google/connect")
    assert response.status_code == 503
    assert response.json()["code"] == "OAUTH_NOT_CONFIGURED"


def test_provider_capabilities_disclose_unavailable_reservations(client):
    response = client.get("/v1/providers/capabilities")
    assert response.status_code == 200
    reservation = next(
        provider for provider in response.json()["providers"]
        if provider["provider"] == "restaurant_reservations"
    )
    assert reservation["connected"] is False
    assert all(capability["available"] is False for capability in reservation["capabilities"])
