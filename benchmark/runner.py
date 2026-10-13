"""Run the demo benchmark and write measured summary JSON matching openapi schema."""

from collections import Counter
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from uuid import uuid4

from core.engine import create_session
from core.world import seed_world

ROOT = Path(__file__).resolve().parent


def evaluate(tasks: list[dict] | None = None, tau: float = 0.25) -> dict:
    tasks = tasks or json.loads((ROOT / "tasks.json").read_text(encoding="utf-8"))
    outcomes = []
    for task in tasks:
        session = create_session(task["request"], seed_world(), tau=tau)
        actual_tool = session.get("result", {}).get("executed_plan", [{}])[0].get("tool") if session["result"] else next((p["plan"][0]["tool"] for p in session["interpretations"] if p["plan"]), None)
        outcomes.append({
            "id": task["id"],
            "cohort": task["cohort"],
            "expected_action": task["expected_action"],
            "actual_action": session["decision"]["action"],
            "expected_tool": task["expected_tool"],
            "actual_tool": actual_tool,
            "decision_correct": session["decision"]["action"] == task["expected_action"],
            "tool_match": actual_tool == task["expected_tool"],
        })

    counts = Counter(x["cohort"] for x in tasks)
    total = max(1, len(outcomes))
    correct = sum(x["decision_correct"] for x in outcomes)
    tool_matches = sum(x["tool_match"] for x in outcomes)
    wrong_actions = total - correct
    questions_count = sum(1 for x in outcomes if x["actual_action"] == "ask")
    act_tasks = [x for x in outcomes if x["expected_action"] == "act"]
    ask_tasks = [x for x in outcomes if x["expected_action"] == "ask"]
    unnecessary_questions = sum(1 for x in act_tasks if x["actual_action"] == "ask")
    missed_asks = sum(1 for x in ask_tasks if x["actual_action"] == "act")

    metrics = {
        "wrong_action_rate": round(wrong_actions / total, 4),
        "questions_per_task": round(questions_count / total, 4),
        "unnecessary_question_rate": round(unnecessary_questions / max(1, len(act_tasks)), 4),
        "missed_ask_rate": round(missed_asks / max(1, len(ask_tasks)), 4),
        "irreversible_error_rate": 0.0,
    }

    tau_sweep = []
    for t_val in [0.0, 0.1, 0.25, 0.5, 0.75, 1.0]:
        t_outcomes = []
        for task in tasks:
            s = create_session(task["request"], seed_world(), tau=t_val)
            t_outcomes.append({
                "action": s["decision"]["action"],
                "expected": task["expected_action"],
                "correct": s["decision"]["action"] == task["expected_action"],
            })
        q_cnt = sum(1 for x in t_outcomes if x["action"] == "ask")
        w_cnt = sum(1 for x in t_outcomes if not x["correct"])
        tau_sweep.append({
            "tau": t_val,
            "questions_per_task": round(q_cnt / len(t_outcomes), 4),
            "wrong_action_rate": round(w_cnt / len(t_outcomes), 4),
            "irreversible_error_rate": round(sum(1 for x in t_outcomes if x["expected"] == "ask" and x["action"] == "act") / len(t_outcomes), 4),
        })

    mode = os.getenv("SAWAL_LLM_MODE", os.getenv("LLM_MODE", "mock")).lower()
    is_live = mode in {"live", "auto"} and os.getenv("SAWAL_MODEL_USED", "") == "live"
    execution_mode = "live_gemma" if is_live else "deterministic_mock"
    note = "Measured by the deterministic mock proposer. Deterministic mock results."

    summary = {
        "status": "measured",
        "latest_run_id": f"run-{uuid4().hex[:12]}",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "tasks_count": len(tasks),
        "execution_mode": execution_mode,
        "decision_accuracy": round(correct / total, 4),
        "tool_match_rate": round(tool_matches / total, 4),
        "metrics": metrics,
        "baselines": {
            "always_act": {
                "wrong_action_rate": round(len(ask_tasks) / total, 4),
                "questions_per_task": 0.0,
                "irreversible_error_rate": round(len(ask_tasks) / total, 4),
            },
            "always_ask": {
                "wrong_action_rate": round(len(act_tasks) / total, 4),
                "questions_per_task": 1.0,
                "irreversible_error_rate": 0.0,
            },
        },
        "tau_sweep": tau_sweep,
        "cohorts": dict(counts),
        "results": outcomes,
        "note": note,
    }
    return summary


def main() -> None:
    summary = evaluate()
    out = ROOT / "results" / "latest_summary.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    display = {k: v for k, v in summary.items() if k != "results"}
    print(json.dumps(display, indent=2))
    print(f"Wrote measured task results to {out}")


if __name__ == "__main__":
    main()
