"""Interpret, rehearse in isolated worlds, group effects, and ask or act."""

from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
import re
from uuid import uuid4

from . import llm
from .tools import TOOL_NAMES, TOOL_WEIGHTS, effect_reversibility, run_tool, validate_call
from .world import clone_world

TAU = float(os.getenv("SAWAL_DECISION_TAU", os.getenv("DECISION_TAU", "0.25")))
MAX_QUESTIONS = int(os.getenv("SAWAL_MAX_QUESTIONS", os.getenv("MAX_QUESTIONS", "2")))
K = int(os.getenv("NUM_INTERPRETATIONS", "5"))


def create_session(
    request_text: str,
    world: dict,
    tau: float | None = None,
    llm_mode: str | None = None,
) -> dict:
    interpretations, proposer = propose_interpretations(request_text, world, llm_mode=llm_mode)
    return create_session_from_proposals(request_text, world, interpretations, proposer, tau=tau)


def propose_interpretations(
    request_text: str,
    world: dict,
    llm_mode: str | None = None,
) -> tuple[list[dict], dict]:
    outcome = llm.propose_with_meta(request_text, world, K, mode=llm_mode)
    proposed = outcome.interpretations or []
    proposer = deepcopy(outcome.proposer)

    if proposed:
        proposed = _enforce_contact_ambiguity(request_text, world, proposed)
        interpretations = _validate_interpretations(proposed)
        if interpretations:
            proposer["valid_plans"] = len(interpretations)
            return interpretations, proposer
        prior_reason = proposer.get("fallback_reason")
        reason = "LLM/replay output contained no allowlisted valid plans"
        if prior_reason:
            reason = f"{prior_reason}; {reason}"
        proposer = {
            "kind": "deterministic_fallback",
            "model": proposer.get("model"),
            "valid_plans": 0,
            "latency_ms": proposer.get("latency_ms", 0.0),
            "fallback_reason": reason,
        }

    if os.getenv("SAWAL_STRICT", "0").strip().lower() in {"1", "true", "yes", "on"}:
        raise RuntimeError(
            "SAWAL_STRICT=1 refused deterministic fallback: "
            + str(proposer.get("fallback_reason") or "no model/replay proposals available")
        )

    fallback = _validate_interpretations(_heuristic_proposals(request_text, world))
    proposer["kind"] = "deterministic_fallback"
    proposer["valid_plans"] = len(fallback)
    proposer.setdefault("fallback_reason", "no model/replay proposals available")
    return fallback, proposer


def create_session_from_proposals(
    request_text: str,
    world: dict,
    interpretations: list[dict],
    proposer: dict,
    tau: float | None = None,
) -> dict:
    decision_tau = TAU if tau is None else float(tau)
    trace = []
    interpretations = deepcopy(interpretations)
    proposer = deepcopy(proposer)
    proposer["valid_plans"] = len(interpretations)

    trace.append(_trace("INTERPRETATIONS_GENERATED", {"count": len(interpretations), "valid_count": len(interpretations)}))
    if proposer.get("fallback_reason"):
        trace.append(_trace("PROPOSER_FALLBACK", {
            "kind": proposer.get("kind"),
            "model": proposer.get("model"),
            "reason": proposer.get("fallback_reason"),
        }))

    low_diversity = len(interpretations) < 2
    rehearsals = []
    for item in interpretations:
        sandbox = clone_world(world)
        effects = []
        for call in item["plan"]:
            _, new_effects = run_tool(sandbox, call)
            effects.extend(new_effects)
        signature = _signature(effects)
        item["signature"] = signature
        item["group_id"] = "grp-" + signature[:10]
        item["reversibility"] = _group_reversibility(effects)
        rehearsals.append({"interpretation": item, "sandbox": sandbox, "effects": effects, "signature": signature})

    groups = _group(rehearsals)
    chosen, regret = _best_group(groups)
    trace.append(_trace("DRY_RUN_COMPLETED", {"valid_count": len(interpretations), "groups": len(groups)}))
    trace.append(_trace("REGRET_CALCULATED", {"expected_regret": round(regret, 4), "tau": decision_tau}))

    session = {
        "id": str(uuid4()),
        "user_id": "guest",
        "request_text": request_text,
        "status": "asked" if not low_diversity and regret > decision_tau else "completed",
        "decision": {
            "action": "ask" if not low_diversity and regret > decision_tau else "act",
            "expected_regret": round(regret, 4),
            "tau": decision_tau,
            "chosen_group_id": chosen["id"] if chosen else None,
            "groups": groups,
        },
        "interpretations": interpretations,
        "groups": [_public_group(group) for group in groups],
        "proposer": proposer,
        "question": None,
        "result": None,
        "trace": trace,
        "created_at": _now(),
        "updated_at": _now(),
        "_candidate_question": None,
    }
    if low_diversity:
        session["trace"].append(_trace("LOW_DIVERSITY_FALLBACK", {"message": "Fewer than two valid plans; using the highest-ranked valid plan."}))
    if session["status"] == "asked":
        session["question"] = _make_question(rehearsals, groups)
        if session["question"]:
            session["trace"].append(_trace("CLARIFICATION_REQUIRED", {"slot": session["question"]["slot_name"]}))
        else:
            session["status"] = "completed"
            session["decision"]["action"] = "act"
    if session["status"] == "completed":
        session["result"] = execute_group(world, rehearsals, chosen)
        session["trace"].append(_trace("LIVE_EXECUTION_COMPLETED", {"success": session["result"]["success"]}))
    return session


def answer_session(session: dict, world: dict, question_id: str, option_id: str | None, free_text: str | None) -> dict:
    if session["status"] != "asked" or not session.get("question"):
        raise ValueError("Session is not waiting for an answer.")
    question = session["question"]
    if question_id != question["id"]:
        raise ValueError("question_id does not match the active question.")
    option = next((o for o in question["options"] if option_id and o["id"] == option_id), None)
    if option is None and free_text:
        text = free_text.casefold()
        option = next((o for o in question["options"] if text in o["label"].casefold() or o["label"].casefold() in text or o["value"].casefold() in text), None)
    if option is None:
        raise ValueError("Choose one of the offered options or provide a matching free-text answer.")

    surviving = [x for x in session["interpretations"] if x["group_id"] in option["target_group_ids"]]
    if not surviving:
        raise ValueError("No rehearsed plan matches that answer.")
    selected = surviving[0]
    before = clone_world(world)
    tool_results = []
    for call in selected["plan"]:
        result, _ = run_tool(world, call)
        tool_results.append({"tool": call["tool"], "result": result})
    session["status"] = "completed"
    session["question"] = None
    session["decision"]["action"] = "act"
    session["decision"]["chosen_group_id"] = selected["group_id"]
    session["result"] = {
        "success": True,
        "executed_plan": selected["plan"],
        "tool_results": tool_results,
        "world_diff": world_diff(before, world),
        "message": "Clarification received; selected plan executed in the mock world.",
    }
    session["trace"].append(_trace("ANSWER_MAPPED", {"slot": question["slot_name"], "value": option["value"]}))
    session["trace"].append(_trace("LIVE_EXECUTION_COMPLETED", {"success": True}))
    session["updated_at"] = _now()
    return session


def execute_group(world: dict, rehearsals: list[dict], group: dict | None) -> dict:
    if not group:
        return {"success": False, "executed_plan": [], "tool_results": [], "world_diff": {"added": {}, "modified": {}, "deleted": {}}, "message": "No valid plan could be generated."}
    before = clone_world(world)
    chosen = next((x["interpretation"] for x in rehearsals if x["interpretation"]["group_id"] == group["id"]), None)
    results = []
    for call in chosen["plan"] if chosen else []:
        result, _ = run_tool(world, call)
        results.append({"tool": call["tool"], "result": result})
    return {
        "success": True,
        "executed_plan": chosen["plan"] if chosen else [],
        "tool_results": results,
        "world_diff": world_diff(before, world),
        "message": "Selected plan executed in the mock world.",
    }


def world_diff(before: dict, after: dict) -> dict:
    added, modified, deleted = {}, {}, {}
    for collection in after:
        old = {str(x.get("id")): x for x in before.get(collection, []) if isinstance(x, dict) and "id" in x}
        new = {str(x.get("id")): x for x in after.get(collection, []) if isinstance(x, dict) and "id" in x}
        if collection not in before:
            continue
        new_items = [new[k] for k in new.keys() - old.keys()]
        changed_items = [{"before": old[k], "after": new[k]} for k in new.keys() & old.keys() if old[k] != new[k]]
        removed_items = [old[k] for k in old.keys() - new.keys()]
        if new_items:
            added[collection] = new_items
        if changed_items:
            modified[collection] = changed_items
        if removed_items:
            deleted[collection] = removed_items
    return {"added": added, "modified": modified, "deleted": deleted}


def _propose(request_text: str, world: dict) -> list[dict]:
    """Backward-compatible internal helper returning interpretations only."""
    interpretations, _ = propose_interpretations(request_text, world)
    return interpretations


def _enforce_contact_ambiguity(request_text: str, world: dict, items: list[dict]) -> list[dict]:
    lower = request_text.casefold()
    matching_contacts = []
    for contact in world.get("contacts", []):
        first_name = str(contact.get("name", "")).split()[0].casefold()
        if first_name and re.search(rf"\b{re.escape(first_name)}\b", lower):
            matching_contacts.append(contact)
    if len(matching_contacts) < 2:
        return items

    base = None
    for item in items:
        if not isinstance(item, dict):
            continue
        plan = item.get("plan", [])
        if any(isinstance(call, dict) and call.get("tool") in {"email.send", "email.draft"} for call in plan):
            base = item
            break
    if base is None:
        return items

    grounded = []
    distribution = [matching_contacts[index % len(matching_contacts)] for index in range(K)]
    if len(matching_contacts) == 2 and K == 5:
        distribution = [matching_contacts[0], matching_contacts[0], matching_contacts[0], matching_contacts[1], matching_contacts[1]]

    for index, contact in enumerate(distribution):
        candidate = deepcopy(base)
        candidate["id"] = f"interp-{index + 1:02d}"
        original_slots = candidate.get("slots", {})
        allowed = {"restaurant_id", "date_time", "party_size", "subject", "body"}
        clean_slots = {key: value for key, value in original_slots.items() if key in allowed}
        clean_slots["contact_id"] = contact["id"]
        candidate["slots"] = clean_slots
        for call in candidate.get("plan", []):
            if call.get("tool") in {"email.send", "email.draft"}:
                call.setdefault("args", {})["to"] = contact["email"]
        candidate["rationale"] = f"Interprets the ambiguous recipient as {contact['name']}."
        grounded.append(candidate)
    return grounded


def _heuristic_proposals(text: str, world: dict) -> list[dict]:
    lower = text.casefold()
    if any(word in lower for word in ("log", "record", "track")) and re.search(r"\d", lower) and any(word in lower for word in ("rupee", "rs", "₹", "expense", "spent")):
        amount_match = re.search(r"(?:₹|rs\.?\s*)?(\d+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|₹)?", lower)
        amount = float(amount_match.group(1)) if amount_match else 40.0
        description = re.sub(r"\b(?:please\s+)?(?:log|record|track)\s+", "", text, flags=re.I).strip().rstrip(".")
        return _five([{"slots": {}, "rationale": "Logs the explicitly specified small expense.", "plan": [{"tool": "expenses.log", "args": {"amount": amount, "currency": "INR", "description": description}}]}])

    if any(word in lower for word in ("contact", "address book")) and any(word in lower for word in ("find", "search", "look", "lookup")):
        query = next((c["name"].split()[0] for c in world["contacts"] if c["name"].casefold() in lower or c["name"].split()[0].casefold() in lower), text[:80])
        return _five([{"slots": {}, "rationale": "Reads matching contacts without changing state.", "plan": [{"tool": "contacts.search", "args": {"query": query}}]}])

    if any(word in lower for word in ("restaurant", "lunch", "dinner", "vegetarian place", "quiet spot", "somewhere nice")) and any(word in lower for word in ("find", "search", "look", "quiet", "vegetarian", "nice")) and not any(word in lower for word in ("book", "reserve", "reservation")):
        query = "vegetarian" if "vegetarian" in lower else "restaurant"
        return _five([{"slots": {}, "rationale": "Searches restaurant options; no booking is made.", "plan": [{"tool": "restaurants.search", "args": {"query": query}}]}])

    if "draft" in lower and "study group" in lower:
        return _five([{"slots": {}, "rationale": "Saves a private draft addressed to the study group.", "plan": [{"tool": "email.draft", "args": {"to": "study-group@campus.internal", "subject": _subject(text), "body": text}}]}])

    if any(word in lower for word in ("email", "message", "send", "draft")):
        contacts = [c for c in world["contacts"] if c["name"].split()[0].casefold() in lower or c["name"].casefold() in lower]
        contacts = contacts or [world["contacts"][0]]
        verb = "email.draft" if "draft" in lower else "email.send"
        subject = _subject(text)
        body = text
        plans = []
        for c in contacts[:2]:
            plans.append({"slots": {"contact_id": c["id"]}, "rationale": f"Interprets the recipient as {c['name']}.", "plan": [{"tool": verb, "args": {"to": c["email"], "subject": subject, "body": body}}]})
        if len(plans) == 1:
            return _five(plans)
        return _five([plans[0], plans[0], plans[0], plans[1], plans[1]])

    if any(word in lower for word in ("book", "reserve", "reservation")) and any(word in lower for word in ("restaurant", "dinner", "table", "lunch")):
        restaurants = world["restaurants"][:2]
        if len(restaurants) >= 2 and not any(r["name"].casefold() in lower for r in restaurants):
            options = restaurants
        else:
            options = [next((r for r in restaurants if r["name"].casefold() in lower), restaurants[0])]
        plans = [{"slots": {"restaurant_id": r["id"]}, "rationale": f"Interprets the venue as {r['name']}.", "plan": [{"tool": "restaurants.book", "args": {"restaurant_id": r["id"], "date_time": _extract_datetime(text), "party_size": _extract_party_size(text)}}]} for r in options]
        if len(plans) == 1:
            return _five(plans)
        return _five([plans[0], plans[0], plans[0], plans[1], plans[1]])

    if any(word in lower for word in ("calendar", "schedule", "events", "event")) and any(word in lower for word in ("check", "show", "find", "list", "look")):
        start = datetime.now(timezone.utc).replace(microsecond=0)
        end = start + timedelta(days=1)
        return _five([{"slots": {}, "rationale": "Reads matching calendar events without changing state.", "plan": [{"tool": "calendar.list", "args": {"start_date": start.isoformat(), "end_date": end.isoformat()}}]}])

    return _five([{"slots": {}, "rationale": "No supported side effect was inferred; use a safe read-only contact lookup.", "plan": [{"tool": "contacts.search", "args": {"query": text[:120] or ""}}]}])


def _five(plans: list[dict]) -> list[dict]:
    if not plans:
        return []
    return [{"id": f"interp-{i + 1:02d}", **deepcopy(plans[i % len(plans)])} for i in range(K)]


def _validate_interpretations(items: list) -> list[dict]:
    valid = []
    for index, item in enumerate(items[:K]):
        if not isinstance(item, dict) or not isinstance(item.get("plan"), list) or not item["plan"]:
            continue
        try:
            for call in item["plan"]:
                validate_call(call)
        except (ValueError, TypeError, KeyError):
            continue
        valid.append({
            "id": str(item.get("id") or f"interp-{index + 1:02d}"),
            "rationale": str(item.get("rationale", "Model-proposed interpretation.")),
            "slots": item.get("slots", {}) if isinstance(item.get("slots", {}), dict) else {},
            "plan": item["plan"],
        })
    return valid


def _group(rehearsals: list[dict]) -> list[dict]:
    buckets = defaultdict(list)
    for run in rehearsals:
        buckets[run["signature"]].append(run)
    total = max(1, len(rehearsals))
    result = []
    for sig, runs in buckets.items():
        effects = runs[0]["effects"]
        result.append({
            "id": "grp-" + sig[:10],
            "mass": len(runs) / total,
            "size": len(runs),
            "interpretation_ids": [r["interpretation"]["id"] for r in runs],
            "canonical_effects": effects,
            "signature": sig,
            "reversibility": _group_reversibility(effects),
        })
    return result


def _public_group(group: dict) -> dict:
    return {
        "id": group["id"],
        "size": group.get("size", len(group.get("interpretation_ids", []))),
        "effects": deepcopy(group.get("canonical_effects", [])),
        "reversibility": group.get("reversibility", _group_reversibility(group.get("canonical_effects", []))),
    }


def _group_reversibility(effects: list[dict]) -> str:
    if not effects:
        return "readonly"
    if any(effect.get("reversibility_weight", 0.0) >= 0.7 for effect in effects):
        return "irreversible"
    return "reversible"


def _best_group(groups: list[dict]) -> tuple[dict | None, float]:
    if not groups:
        return None, 1.0
    scored = [(sum(other["mass"] * _effect_distance(group["canonical_effects"], other["canonical_effects"]) for other in groups), group) for group in groups]
    regret, group = min(scored, key=lambda pair: (pair[0], -pair[1]["mass"]))
    return group, min(1.0, regret)


def _effect_distance(left: list[dict], right: list[dict]) -> float:
    def key(effect):
        return (effect["entity_type"], effect["operation"])
    remaining = list(right)
    cost = 0.0
    for effect in left:
        match_idx = next((i for i, candidate in enumerate(remaining) if key(candidate) == key(effect)), None)
        if match_idx is None:
            cost += effect["reversibility_weight"]
            continue
        candidate = remaining.pop(match_idx)
        if effect["key_fields"] != candidate["key_fields"]:
            cost += max(effect["reversibility_weight"], candidate["reversibility_weight"])
    cost += sum(x["reversibility_weight"] for x in remaining)
    return cost


def _signature(effects: list[dict]) -> str:
    data = sorted(effects, key=lambda x: json.dumps(x, sort_keys=True, ensure_ascii=False))
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _make_question(rehearsals: list[dict], groups: list[dict]) -> dict | None:
    values: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    group_for_interp = {r["interpretation"]["id"]: r["interpretation"]["group_id"] for r in rehearsals}
    for run in rehearsals:
        interpretation = run["interpretation"]
        allowed_question_slots = {"contact_id", "restaurant_id", "date_time", "party_size", "subject", "body"}
        for key, val in interpretation["slots"].items():
            if key not in allowed_question_slots:
                continue
            if val is not None:
                values[key][str(val)].append(interpretation["id"])

        for call in interpretation.get("plan", []):
            if call.get("tool") not in {"email.send", "email.draft"}:
                continue
            recipient = str(call.get("args", {}).get("to", "")).casefold()
            contact = next((item for item in run["sandbox"].get("contacts", []) if str(item.get("email", "")).casefold() == recipient), None)
            if contact:
                values["contact_id"][str(contact["id"])].append(interpretation["id"])

    differing = [(slot, options) for slot, options in values.items() if len(options) > 1]
    if not differing:
        return None
    slot_priority = {
        "contact_id": 100,
        "restaurant_id": 90,
        "recipient": 85,
        "date_time": 70,
        "party_size": 60,
        "subject": 10,
        "body": 5,
    }
    slot, options = max(differing, key=lambda item: (slot_priority.get(item[0], 30), len(item[1])))
    choices = []
    world = rehearsals[0]["sandbox"] if rehearsals else {}
    collection = "contacts" if slot == "contact_id" else "restaurants" if slot == "restaurant_id" else None
    for value, interp_ids in options.items():
        entity = next((x for x in world.get(collection, []) if x.get("id") == value), {}) if collection else {}
        label = entity.get("name", value)
        suffix = entity.get("relationship") or entity.get("cuisine")
        if suffix:
            label += f" ({suffix})"
        group_ids = sorted({group_for_interp[x] for x in interp_ids})
        choices.append({"id": "opt-" + re.sub(r"[^a-z0-9-]", "-", value.casefold()), "label": label, "value": value, "target_group_ids": group_ids})
    question_text = "Which contact did you mean?" if slot == "contact_id" else "Which restaurant should I book?" if slot == "restaurant_id" else f"Which value should I use for {slot.replace('_', ' ')}?"
    return {"id": f"q-slot-{slot}-01", "slot_name": slot, "question": question_text, "options": choices}


def _subject(text: str) -> str:
    cleaned = re.sub(r"^(please\s+)?(send|email|message|draft)\s+(an?\s+)?(email|message|note)?\s*(to\s+)?", "", text, flags=re.I).strip()
    return (cleaned[:120] or "Message from Sawal").rstrip(" .")


def _extract_datetime(text: str) -> str:
    match = re.search(r"\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b", text, re.I)
    return match.group(1) if match else "2026-10-13T20:00:00+05:30"


def _extract_party_size(text: str) -> int:
    match = re.search(r"\b(?:for\s+)?(\d{1,2})\s*(?:people|persons|guests)?\b", text, re.I)
    return int(match.group(1)) if match else 2


def _trace(kind: str, payload: dict) -> dict:
    return {"id": "trc-" + str(uuid4())[:8], "kind": kind, "payload": payload, "timestamp": _now()}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
