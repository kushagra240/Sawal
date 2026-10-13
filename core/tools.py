"""Allowlisted mock tools. All writes affect only the passed world snapshot."""

from datetime import datetime, timezone
from uuid import uuid4

TOOL_NAMES = {
    "contacts.search", "calendar.list", "calendar.create_event",
    "restaurants.search", "restaurants.book", "email.draft",
    "email.send", "expenses.log",
}

TOOL_WEIGHTS = {
    "email.send": 1.0,
    "restaurants.book": 0.7,
    "calendar.create_event": 0.4,
    "expenses.log": 0.3,
    "email.draft": 0.1,
}

REQUIRED_ARGS = {
    "contacts.search": {"query"},
    "calendar.list": {"start_date", "end_date"},
    "calendar.create_event": {"title", "start_time", "end_time"},
    "restaurants.search": {"query"},
    "restaurants.book": {"restaurant_id", "date_time", "party_size"},
    "email.draft": {"to", "subject", "body"},
    "email.send": {"to", "subject", "body"},
    "expenses.log": {"amount", "currency", "description"},
}


def validate_call(call: dict) -> None:
    if not isinstance(call, dict) or not {"tool", "args"} <= set(call):
        raise ValueError("Each tool call must contain `tool` and `args`.")
    name, args = call["tool"], call["args"]
    if name not in TOOL_NAMES:
        raise ValueError(f"Tool is not allowlisted: {name}")
    if not isinstance(args, dict):
        raise ValueError("Tool args must be an object.")
    missing = REQUIRED_ARGS[name] - args.keys()
    if missing:
        raise ValueError(f"{name} is missing required args: {', '.join(sorted(missing))}")
    if name == "restaurants.book" and (not isinstance(args["party_size"], int) or args["party_size"] < 1):
        raise ValueError("party_size must be a positive integer")
    if name == "expenses.log" and (not isinstance(args["amount"], (int, float)) or args["amount"] <= 0):
        raise ValueError("amount must be positive")


def run_tool(world: dict, call: dict) -> tuple[dict, list[dict]]:
    """Run one validated tool and return (tool result, canonical effects)."""
    validate_call(call)
    tool, args = call["tool"], call["args"]
    effects: list[dict] = []

    if tool == "contacts.search":
        q = args["query"].casefold()
        return {"contacts": [x for x in world["contacts"] if q in (x["name"] + " " + x["email"] + " " + x["relationship"]).casefold()]}, effects
    if tool == "calendar.list":
        return {"events": list(world["calendar_events"])}, effects
    if tool == "restaurants.search":
        q = args["query"].casefold()
        return {"restaurants": [x for x in world["restaurants"] if q in (x["name"] + " " + x["cuisine"] + " " + " ".join(x["dietary_tags"])).casefold()]}, effects

    if tool == "calendar.create_event":
        item = {"id": str(uuid4()), **args}
        world["calendar_events"].append(item)
        effects.append(_effect("calendar_event", "create", {"title": args["title"], "start_time": args["start_time"]}, tool))
    elif tool == "restaurants.book":
        item = {"id": str(uuid4()), **args, "status": "confirmed"}
        world["reservations"].append(item)
        restaurant = next((r for r in world["restaurants"] if r["id"] == args["restaurant_id"]), None)
        effects.append(_effect("reservation", "create", {"restaurant_id": args["restaurant_id"], "restaurant": restaurant["name"] if restaurant else args["restaurant_id"], "date_time": args["date_time"], "party_size": args["party_size"]}, tool))
    elif tool in {"email.draft", "email.send"}:
        status = "draft" if tool == "email.draft" else "sent"
        item = {"id": str(uuid4()), "status": status, **args}
        world["emails"].append(item)
        if status == "sent":
            effects.append(_effect("email", "send", {"to": args["to"], "subject": args["subject"]}, tool))
        else:
            effects.append(_effect("email", "create", {"to": args["to"], "subject": args["subject"]}, tool))
    elif tool == "expenses.log":
        item = {"id": str(uuid4()), **args}
        world["expenses"].append(item)
        effects.append(_effect("expense", "create", {"amount": args["amount"], "currency": args["currency"], "description": args["description"]}, tool))

    return {"success": True, "item": item}, effects


def _effect(entity_type: str, operation: str, key_fields: dict, tool: str) -> dict:
    return {"entity_type": entity_type, "operation": operation, "key_fields": key_fields, "reversibility_weight": TOOL_WEIGHTS[tool]}
