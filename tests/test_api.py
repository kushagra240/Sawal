import pytest
from fastapi.testclient import TestClient
from api.main import app, sessions, world
from core.world import seed_world


@pytest.fixture(autouse=True)
def reset_state():
    global world, sessions
    sessions.clear()
    from api import main
    main.world = seed_world()


@pytest.fixture
def client():
    return TestClient(app)


def test_health_endpoints(client):
    res_v1 = client.get("/v1/health")
    assert res_v1.status_code == 200
    data = res_v1.json()
    assert data["status"] == "ok"
    assert "timestamp" in data
    assert data["storage_backend"] == "memory"
    assert data["llm_mode"] in ["live", "record", "replay", "auto"]

    res_root = client.get("/health")
    assert res_root.status_code == 200
    assert res_root.json()["status"] == "ok"


def test_config_endpoint(client):
    res = client.get("/v1/config")
    assert res.status_code == 200
    cfg = res.json()
    assert cfg["allow_guest_demo"] is True
    assert "decision_tau" in cfg
    assert "max_questions" in cfg
    assert "num_interpretations" in cfg
    assert "gemma_model_id" in cfg
    assert "reversibility_weights" in cfg


def test_me_and_preferences(client):
    res = client.get("/v1/me")
    assert res.status_code == 200
    me = res.json()
    assert me["user_id"] == "guest_user"
    assert "preferences" in me

    put_res = client.put("/v1/me/preferences", json={"preferences": {"theme": "dark", "preferred_dining_time": "20:00"}})
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["preferences"]["theme"] == "dark"
    assert updated["preferences"]["preferred_dining_time"] == "20:00"


def test_create_session_act_and_get(client):
    res = client.post("/v1/sessions", json={"request_text": "Check my calendar for tomorrow afternoon."})
    assert res.status_code == 201
    session = res.json()
    session_id = session["id"]
    assert session["status"] == "completed"
    assert session["decision"]["action"] == "act"
    assert session["result"]["success"] is True

    get_res = client.get(f"/v1/sessions/{session_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == session_id


def test_create_session_ask_and_answer(client):
    res = client.post("/v1/sessions", json={"request_text": "Send an email to Priya confirming the lab slot."})
    assert res.status_code == 201
    session = res.json()
    session_id = session["id"]
    assert session["status"] == "asked"
    assert session["decision"]["action"] == "ask"
    assert session["question"] is not None
    assert len(session["question"]["options"]) == 2

    question_id = session["question"]["id"]
    option_id = session["question"]["options"][0]["id"]

    ans_res = client.post(f"/v1/sessions/{session_id}/answer", json={"question_id": question_id, "option_id": option_id})
    assert ans_res.status_code == 200
    answered = ans_res.json()
    assert answered["status"] == "completed"
    assert answered["question"] is None
    assert answered["result"]["success"] is True


def test_list_sessions_pagination(client):
    client.post("/v1/sessions", json={"request_text": "Find vegetarian restaurants."})
    client.post("/v1/sessions", json={"request_text": "Log 40 rupees for tea."})

    res = client.get("/v1/sessions?limit=1")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 1
    assert data["has_more"] is True
    assert "next_cursor" in data


def test_world_state_and_reset(client):
    res = client.get("/v1/world")
    assert res.status_code == 200
    world_state = res.json()
    assert "contacts" in world_state
    assert "calendar_events" in world_state
    assert "restaurants" in world_state

    # Mutate through an action
    client.post("/v1/sessions", json={"request_text": "Log 50 rupees for snacks."})
    res_after = client.get("/v1/world")
    assert len(res_after.json()["expenses"]) >= 1

    # Reset world
    reset_res = client.post("/v1/world/reset")
    assert reset_res.status_code == 200
    assert reset_res.json()["expenses"] == []


def test_benchmark_endpoints(client):
    summary_res = client.get("/v1/benchmark/summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["tasks_count"] == 24
    assert "metrics" in summary
    assert "tau_sweep" in summary

    run_res = client.post("/v1/benchmark/runs", json={})
    assert run_res.status_code == 202
    run_data = run_res.json()
    run_id = run_data["id"]
    assert run_data["status"] == "completed"

    get_run = client.get(f"/v1/benchmark/runs/{run_id}")
    assert get_run.status_code == 200
    assert get_run.json()["id"] == run_id


def test_not_found_session(client):
    res = client.get("/v1/sessions/non-existent-uuid")
    assert res.status_code == 404
    err = res.json()
    assert err["code"] == "NOT_FOUND"


def test_validation_error(client):
    res = client.post("/v1/sessions", json={"request_text": "hi"})  # min_length 3
    assert res.status_code == 422
    err = res.json()
    assert err["code"] == "UNPROCESSABLE_ENTITY"
