"""Live execution coordinator with previews, confirmation, idempotency, and audits."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import re
from typing import Any

from core.providers import GoogleProvider, ProviderError, ProviderUnavailable
from core.providers.base import ExecutionContext
from core.storage import AgentStore


CONSEQUENTIAL_TOOLS = {
    "email.send",
    "calendar.create_event",
    "calendar.update_event",
    "calendar.cancel_event",
    "restaurants.book",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class LiveExecutionService:
    def __init__(self, store: AgentStore, google: GoogleProvider | None = None):
        self.store = store
        self.google = google or GoogleProvider(store)

    def capabilities(self, user_id: str) -> dict[str, Any]:
        google_capabilities = self.google.capabilities(user_id)
        return {
            "mode": "live",
            "providers": [
                {
                    **self.store.connection_status(user_id, "google"),
                    "oauth_configured": bool(__import__("os").getenv("GOOGLE_CLIENT_ID") and __import__("os").getenv("GOOGLE_CLIENT_SECRET")),
                    "capabilities": google_capabilities,
                },
                {
                    "provider": "local_expenses",
                    "connected": True,
                    "capabilities": [
                        {"tool": "expenses.log", "available": True},
                        {"tool": "expenses.list", "available": True},
                    ],
                },
                {
                    "provider": "restaurant_reservations",
                    "connected": False,
                    "capabilities": [
                        {"tool": "restaurants.search", "available": False, "reason": "No authorized reservation provider is configured."},
                        {"tool": "restaurants.book", "available": False, "reason": "No authorized reservation provider is configured."},
                    ],
                },
            ],
        }

    def enrich_world_contacts(self, user_id: str, request_text: str, world: dict[str, Any]) -> dict[str, Any]:
        """Ground named recipients against authorized Google Contacts when connected."""
        if not self.store.get_connection(user_id, "google"):
            return world
        ignored = {"send", "email", "draft", "please", "confirming", "check", "book", "calendar"}
        candidates = [word for word in re.findall(r"\b[A-Z][a-z]{2,}\b", request_text) if word.casefold() not in ignored]
        contacts: list[dict[str, Any]] = []
        for query in candidates[:3]:
            try:
                result = self.google.execute(
                    {"tool": "contacts.search", "args": {"query": query, "max_results": 10}},
                    ExecutionContext(user_id, "contact-resolution", "contact-resolution"),
                )
            except ProviderError:
                continue
            for person in result.get("contacts", []):
                for email in person.get("emails", []):
                    contacts.append({
                        "id": person.get("id") or email,
                        "name": person.get("name") or email,
                        "email": email,
                        "relationship": "Google Contact",
                        "company": "Authorized Google Contacts",
                    })
        if contacts:
            deduped = {contact["email"].casefold(): contact for contact in contacts}
            world["contacts"] = list(deduped.values())
        return world

    @staticmethod
    def _idempotency_key(user_id: str, session_id: str, plan: list[dict[str, Any]]) -> str:
        material = json.dumps({"user_id": user_id, "session_id": session_id, "plan": plan}, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(material.encode("utf-8")).hexdigest()

    @staticmethod
    def _preview(plan: list[dict[str, Any]]) -> dict[str, Any]:
        items = []
        for index, call in enumerate(plan):
            tool = call.get("tool", "unknown")
            args = call.get("args", {})
            summary: dict[str, Any] = {"tool": tool, "position": index + 1}
            if tool.startswith("email."):
                summary.update({"provider": "gmail", "to": args.get("to"), "subject": args.get("subject"), "body": args.get("body")})
            elif tool.startswith("calendar."):
                summary.update({"provider": "google_calendar", **args})
            elif tool.startswith("expenses."):
                summary.update({"provider": "local_expenses", **args})
            elif tool.startswith("restaurants."):
                summary.update({"provider": "restaurant_reservations", **args, "available": False})
            items.append(summary)
        return {
            "items": items,
            "requires_confirmation": any(call.get("tool") in CONSEQUENTIAL_TOOLS for call in plan),
            "warning": "Confirmation authorizes only this exact plan. Changes require a new preview.",
        }

    def prepare_session(self, session: dict[str, Any], user_id: str) -> dict[str, Any]:
        session["tool_mode"] = "live"
        if session.get("status") != "completed" or not session.get("result"):
            return session
        plan = session["result"].get("executed_plan", [])
        preview = self._preview(plan)
        key = self._idempotency_key(user_id, session["id"], plan)
        state = "awaiting_confirmation" if preview["requires_confirmation"] else "ready"
        action = self.store.create_action(user_id, session["id"], plan, preview, key, state=state)
        session["action"] = self.public_action(action)
        session["result"] = None
        session["status"] = state
        session["trace"].append({
            "id": f"trc-{action['id'][:8]}",
            "kind": "ACTION_PREVIEW_CREATED",
            "payload": {"action_id": action["id"], "requires_confirmation": preview["requires_confirmation"]},
            "timestamp": _now(),
        })
        self.store.audit(user_id, "ACTION_PREVIEW_CREATED", {"requires_confirmation": preview["requires_confirmation"], "tools": [call.get("tool") for call in plan]}, action["id"])
        if state == "ready":
            action = self.execute(action["id"], user_id, key)
            self.apply_action_to_session(session, action)
        return session

    @staticmethod
    def public_action(action: dict[str, Any]) -> dict[str, Any]:
        return {key: value for key, value in action.items() if key not in {"user_id", "plan"}}

    def _execute_call(self, call: dict[str, Any], context: ExecutionContext) -> dict[str, Any]:
        tool = call["tool"]
        if tool.startswith(("email.", "contacts.", "calendar.")):
            return self.google.execute(call, context)
        if tool == "expenses.log":
            args = call["args"]
            return {"provider": "local_expenses", "status": "recorded", "expense": self.store.add_expense(context.user_id, float(args["amount"]), str(args["currency"]), str(args["description"]))}
        if tool == "expenses.list":
            return {"provider": "local_expenses", "expenses": self.store.list_expenses(context.user_id, int(call["args"].get("limit", 100)))}
        if tool.startswith("restaurants."):
            raise ProviderUnavailable("No legitimate restaurant reservation provider is configured; no booking was made.")
        raise ProviderUnavailable(f"No live provider supports {tool}.")

    def execute(self, action_id: str, user_id: str, idempotency_key: str) -> dict[str, Any]:
        action = self.store.get_action(action_id, user_id)
        if not action:
            raise KeyError("Action not found.")
        if action["idempotency_key"] != idempotency_key:
            raise ValueError("Idempotency key does not match this action.")
        if action["state"] == "completed":
            return action
        if action["state"] in {"cancelled", "failed"}:
            raise ValueError(f"Action is already {action['state']}.")
        if action["state"] not in {"awaiting_confirmation", "ready"}:
            raise ValueError("Action is already executing.")
        self.store.update_action(action_id, user_id, "executing")
        self.store.audit(user_id, "ACTION_EXECUTION_STARTED", {"tools": [call["tool"] for call in action["plan"]]}, action_id)
        context = ExecutionContext(user_id, action_id, idempotency_key)
        results = []
        try:
            for call in action["plan"]:
                result = self._execute_call(call, context)
                results.append({"tool": call["tool"], "result": result})
                self.store.audit(user_id, "TOOL_EXECUTED", {"status": result.get("status", "ok")}, action_id, result.get("provider"), call["tool"])
        except ProviderError as exc:
            error = {"code": exc.code, "message": str(exc), "retryable": exc.retryable, "details": exc.details}
            failed = self.store.update_action(action_id, user_id, "failed", error=error)
            self.store.audit(user_id, "ACTION_FAILED", error, action_id)
            return failed  # type: ignore[return-value]
        result = {
            "success": True,
            "executed_plan": action["plan"],
            "tool_results": results,
            "world_diff": {"added": {}, "modified": {}, "deleted": {}},
            "message": "Authorized live action completed. Provider receipts are included; delivery or reading is not implied.",
        }
        completed = self.store.update_action(action_id, user_id, "completed", result=result)
        self.store.audit(user_id, "ACTION_COMPLETED", {"tools": [call["tool"] for call in action["plan"]]}, action_id)
        return completed  # type: ignore[return-value]

    def cancel(self, action_id: str, user_id: str) -> dict[str, Any]:
        action = self.store.get_action(action_id, user_id)
        if not action:
            raise KeyError("Action not found.")
        if action["state"] not in {"awaiting_confirmation", "ready"}:
            raise ValueError(f"Action cannot be cancelled from state {action['state']}.")
        cancelled = self.store.update_action(action_id, user_id, "cancelled")
        self.store.audit(user_id, "ACTION_CANCELLED", {}, action_id)
        return cancelled  # type: ignore[return-value]

    def apply_action_to_session(self, session: dict[str, Any], action: dict[str, Any]) -> None:
        session["action"] = self.public_action(action)
        session["status"] = action["state"]
        session["result"] = action.get("result")
        if action["state"] == "failed":
            session["error"] = action.get("error")
        session["updated_at"] = _now()
        session["trace"].append({
            "id": f"trc-{action['id'][:8]}-{action['state']}",
            "kind": f"ACTION_{action['state'].upper()}",
            "payload": {"action_id": action["id"]},
            "timestamp": _now(),
        })
