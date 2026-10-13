"""Honest end-to-end Sawal benchmark with hidden intent and simulated users."""

from __future__ import annotations

from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
from uuid import uuid4

from core import llm
from core.engine import answer_session, create_session_from_proposals, propose_interpretations
from core.tools import run_tool
from core.world import seed_world

ROOT = Path(__file__).resolve().parent
TAU_VALUES = [0.0, 0.1, 0.25, 0.5, 0.75, 1.0]


def _execute_plan(plan: list[dict]) -> tuple[dict, list[dict]]:
    world = seed_world()
    effects: list[dict] = []
    for call in plan:
        _, new_effects = run_tool(world, deepcopy(call))
        effects.extend(new_effects)
    return world, effects


def _effect_matches(actual: dict, intended: dict) -> bool:
    if actual.get("entity_type") != intended.get("entity_type"):
        return False
    if actual.get("operation") != intended.get("operation"):
        return False
    expected_keys = intended.get("key_fields", {})
    actual_keys = actual.get("key_fields", {})
    if any(actual_keys.get(key) != value for key, value in expected_keys.items()):
        return False
    expected_rev = intended.get("reversibility")
    return not expected_rev or actual.get("reversibility") == expected_rev


def _effects_match(actual: list[dict], intended: list[dict]) -> bool:
    """Compare semantic final mutations, ignoring generated IDs and unspecified fields."""
    if len(actual) != len(intended):
        return False
    remaining = list(actual)
    for expected in intended:
        index = next((i for i, candidate in enumerate(remaining) if _effect_matches(candidate, expected)), None)
        if index is None:
            return False
        remaining.pop(index)
    return not remaining


def _plan_matches_task(plan: list[dict], interpretation: dict, task: dict) -> bool:
    intended_slots = task.get("intended_slots", {})
    slots = interpretation.get("slots", {})
    if any(str(slots.get(key)) != str(value) for key, value in intended_slots.items()):
        return False
    _, effects = _execute_plan(plan)
    return _effects_match(effects, task.get("intended_effects", []))


def _select_interpretation(interpretations: list[dict], task: dict) -> dict | None:
    expected_tool = task.get("expected_tool")
    for item in interpretations:
        if item.get("plan") and item["plan"][0].get("tool") == expected_tool and _plan_matches_task(item["plan"], item, task):
            return item
    for item in interpretations:
        if _plan_matches_task(item.get("plan", []), item, task):
            return item
    return interpretations[0] if interpretations else None


def _simulated_answer(session: dict, task: dict) -> str | None:
    question = session.get("question") or {}
    intended_slots = task.get("intended_slots", {})
    slot = question.get("slot_name")
    if slot in intended_slots:
        intended_value = str(intended_slots[slot])
        option = next((x for x in question.get("options", []) if str(x.get("value")) == intended_value), None)
        if option:
            return option["id"]

    selected = _select_interpretation(session.get("interpretations", []), task)
    if selected:
        group_id = selected.get("group_id")
        option = next(
            (
                x for x in question.get("options", [])
                if group_id in x.get("target_group_ids", [])
            ),
            None,
        )
        if option:
            return option["id"]
    return None


def _outcome(task: dict, policy: str, asked: bool, plan: list[dict], effects: list[dict]) -> dict:
    wrong = not _effects_match(effects, task.get("intended_effects", []))
    irreversible_error = wrong and any(x.get("reversibility") == "irreversible" for x in effects)
    actual_tool = plan[0].get("tool") if plan else None
    actual_action = "ask" if asked else "act"
    return {
        "id": task["id"],
        "cohort": task["cohort"],
        "policy": policy,
        "expected_action": task["expected_action"],
        "actual_action": actual_action,
        "expected_tool": task["expected_tool"],
        "actual_tool": actual_tool,
        "decision_correct": actual_action == task["expected_action"],
        "tool_match": actual_tool == task["expected_tool"],
        "wrong_action": wrong,
        "questions": 1 if asked else 0,
        "irreversible_error": irreversible_error,
        "actual_effects": effects,
        "intended_effects": task.get("intended_effects", []),
    }


def _run_always_act(task: dict, interpretations: list[dict]) -> dict:
    chosen = interpretations[0] if interpretations else None
    plan = deepcopy(chosen.get("plan", [])) if chosen else []
    _, effects = _execute_plan(plan)
    return _outcome(task, "always_act", False, plan, effects)


def _run_always_ask(task: dict, interpretations: list[dict]) -> dict:
    chosen = _select_interpretation(interpretations, task)
    plan = deepcopy(chosen.get("plan", [])) if chosen else []
    _, effects = _execute_plan(plan)
    return _outcome(task, "always_ask", True, plan, effects)


def _run_model_unsure(task: dict, interpretations: list[dict]) -> dict:
    ask = llm.distinct_plan_count(interpretations) > 1
    chosen = _select_interpretation(interpretations, task) if ask else (interpretations[0] if interpretations else None)
    plan = deepcopy(chosen.get("plan", [])) if chosen else []
    _, effects = _execute_plan(plan)
    return _outcome(task, "ask_if_model_unsure", ask, plan, effects)


def _run_sawal(task: dict, interpretations: list[dict], proposer: dict, tau: float) -> dict:
    world = seed_world()
    session = create_session_from_proposals(
        task["request"], world, interpretations, proposer, tau=tau
    )
    asked = session["status"] == "asked"
    if asked:
        option_id = _simulated_answer(session, task)
        if option_id:
            answer_session(session, world, session["question"]["id"], option_id, None)
    plan = deepcopy((session.get("result") or {}).get("executed_plan", []))
    _, effects = _execute_plan(plan)
    return _outcome(task, "sawal", asked, plan, effects)


def _metrics(outcomes: list[dict], tasks: list[dict]) -> dict:
    total = max(1, len(outcomes))
    act_ids = {x["id"] for x in tasks if x["expected_action"] == "act"}
    ask_ids = {x["id"] for x in tasks if x["expected_action"] == "ask"}
    wrong = sum(1 for x in outcomes if x["wrong_action"])
    questions = sum(x["questions"] for x in outcomes)
    unnecessary = sum(1 for x in outcomes if x["id"] in act_ids and x["questions"] > 0)
    missed = sum(1 for x in outcomes if x["id"] in ask_ids and x["questions"] == 0)
    irreversible = sum(1 for x in outcomes if x["irreversible_error"])
    return {
        "wrong_action_rate": round(wrong / total, 4),
        "questions_per_task": round(questions / total, 4),
        "unnecessary_question_rate": round(unnecessary / max(1, len(act_ids)), 4),
        "missed_ask_rate": round(missed / max(1, len(ask_ids)), 4),
        "irreversible_error_rate": round(irreversible / total, 4),
    }


def _execution_mode(kinds: Counter, requested_mode: str) -> str:
    if kinds and set(kinds) == {"llm"}:
        return "hosted_gemma_record" if requested_mode == "record" else "hosted_gemma_live"
    if kinds and set(kinds) == {"replay"}:
        return "replay"
    if kinds and set(kinds) == {"deterministic_fallback"}:
        return "deterministic_fallback"
    return "mixed"


def evaluate(tasks: list[dict] | None = None, tau: float = 0.25, llm_mode: str | None = None) -> dict:
    tasks = tasks or json.loads((ROOT / "tasks.json").read_text(encoding="utf-8"))
    requested_mode = (llm_mode or os.getenv("SAWAL_LLM_MODE") or os.getenv("LLM_MODE") or "auto").lower()
    llm.reset_call_stats()

    prepared: list[dict] = []
    proposer_kinds: Counter[str] = Counter()
    proposer_by_task: dict[str, dict] = {}
    for task in tasks:
        interpretations, proposer = propose_interpretations(
            task["request"], seed_world(), llm_mode=requested_mode
        )
        prepared.append({"task": task, "interpretations": interpretations, "proposer": proposer})
        proposer_kinds[proposer["kind"]] += 1
        proposer_by_task[task["id"]] = deepcopy(proposer)

    always_act = [_run_always_act(x["task"], x["interpretations"]) for x in prepared]
    always_ask = [_run_always_ask(x["task"], x["interpretations"]) for x in prepared]

    tau_runs: dict[float, list[dict]] = {}
    for tau_value in TAU_VALUES:
        tau_runs[tau_value] = [
            _run_sawal(x["task"], x["interpretations"], x["proposer"], tau_value)
            for x in prepared
        ]

    selected_tau = min(TAU_VALUES, key=lambda value: abs(value - tau))
    default_outcomes = tau_runs[selected_tau]
    total = max(1, len(default_outcomes))
    decision_correct = sum(1 for x in default_outcomes if x["decision_correct"])
    tool_matches = sum(1 for x in default_outcomes if x["tool_match"])

    baselines = {
        "always_act": _metrics(always_act, tasks),
        "always_ask": _metrics(always_ask, tasks),
    }
    if proposer_kinds.get("llm", 0) > 0:
        model_unsure = [_run_model_unsure(x["task"], x["interpretations"]) for x in prepared]
        baselines["ask_if_model_unsure"] = _metrics(model_unsure, tasks)

    tau_sweep = []
    for tau_value in TAU_VALUES:
        row = {"tau": tau_value, **_metrics(tau_runs[tau_value], tasks)}
        tau_sweep.append(row)

    call_stats = llm.get_call_stats()
    rpm = max(1, int(os.getenv("LLM_MAX_RPM", "10")))
    logical_live_calls = len(tasks) if requested_mode in {"live", "record", "auto"} else 0
    dispatch_floor_seconds = max(0, math.ceil(max(0, logical_live_calls - rpm) / rpm) * 60)

    if proposer_kinds.get("deterministic_fallback", 0):
        note = (
            "Measured end-to-end with real policy execution and hidden-intent simulated users. "
            "One or more tasks used deterministic fallback; these are not all-live hosted-model results."
        )
    elif proposer_kinds.get("replay", 0):
        note = (
            "Measured end-to-end from recorded hosted-model proposals replayed from benchmark/replay_cache. "
            "No live model call was required for replayed tasks."
        )
    else:
        note = (
            "Measured end-to-end using hosted Gemma proposals. Hidden intent was used only by the simulated user/evaluator, "
            "not by the proposer."
        )

    counts = Counter(x["cohort"] for x in tasks)
    model = next((x["proposer"].get("model") for x in prepared if x["proposer"].get("model")), None)
    summary = {
        "status": "measured",
        "latest_run_id": f"run-{uuid4().hex[:12]}",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "tasks_count": len(tasks),
        "execution_mode": _execution_mode(proposer_kinds, requested_mode),
        "model": model,
        "llm_mode": requested_mode,
        "decision_accuracy": round(decision_correct / total, 4),
        "tool_match_rate": round(tool_matches / total, 4),
        "metrics": _metrics(default_outcomes, tasks),
        "baselines": baselines,
        "tau_sweep": tau_sweep,
        "cohorts": dict(counts),
        "proposer_counts": dict(proposer_kinds),
        "proposer_by_task": proposer_by_task,
        "proposer_counts_per_task": {
            task_id: {
                "llm": 1 if meta["kind"] == "llm" else 0,
                "replay": 1 if meta["kind"] == "replay" else 0,
                "deterministic_fallback": 1 if meta["kind"] == "deterministic_fallback" else 0,
            }
            for task_id, meta in proposer_by_task.items()
        },
        "api_call_count": int(call_stats.get("total", 0)),
        "api_call_breakdown": call_stats,
        "configured_llm_max_rpm": rpm,
        "rate_limit_dispatch_floor_seconds": dispatch_floor_seconds,
        "results": default_outcomes,
        "note": note,
    }
    return summary


def main() -> None:
    summary = evaluate()
    out = ROOT / "results" / "latest_summary.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    display = {k: v for k, v in summary.items() if k not in {"results", "proposer_by_task"}}
    print(json.dumps(display, indent=2, ensure_ascii=False))
    print(f"Wrote measured task results to {out}")


if __name__ == "__main__":
    main()
