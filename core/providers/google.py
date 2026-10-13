"""Google Gmail, Calendar, and People API provider using OAuth bearer tokens."""

from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import json
import os
from typing import Any
import urllib.error
import urllib.parse
import urllib.request

from core.storage import AgentStore
from .base import ExecutionContext, ProviderError, ProviderNotConnected, ToolProvider


GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"


class GoogleProvider(ToolProvider):
    name = "google"

    TOOL_SCOPES = {
        "email.search": "https://www.googleapis.com/auth/gmail.readonly",
        "email.read": "https://www.googleapis.com/auth/gmail.readonly",
        "email.draft": "https://www.googleapis.com/auth/gmail.compose",
        "email.send": "https://www.googleapis.com/auth/gmail.compose",
        "contacts.search": "https://www.googleapis.com/auth/contacts.readonly",
        "calendar.list": "https://www.googleapis.com/auth/calendar.readonly",
        "calendar.check_availability": "https://www.googleapis.com/auth/calendar.readonly",
        "calendar.create_event": "https://www.googleapis.com/auth/calendar.events",
        "calendar.update_event": "https://www.googleapis.com/auth/calendar.events",
        "calendar.cancel_event": "https://www.googleapis.com/auth/calendar.events",
    }

    def __init__(self, store: AgentStore):
        self.store = store

    def capabilities(self, user_id: str) -> list[dict[str, Any]]:
        connection = self.store.get_connection(user_id, self.name)
        scopes = set(connection.get("scopes", [])) if connection else set()
        return [
            {
                "tool": tool,
                "available": bool(connection and required in scopes),
                "reason": None if connection and required in scopes else "Google account is not connected with the required scope.",
            }
            for tool, required in self.TOOL_SCOPES.items()
        ]

    def _connection(self, user_id: str) -> dict[str, Any]:
        connection = self.store.get_connection(user_id, self.name)
        if not connection:
            raise ProviderNotConnected("Connect a Google account before using live Google tools.")
        return connection

    def _access_token(self, user_id: str) -> str:
        connection = self._connection(user_id)
        credentials = connection["credentials"]
        expires_at = credentials.get("expires_at")
        if credentials.get("access_token") and expires_at:
            expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if expiry > datetime.now(timezone.utc) + timedelta(seconds=60):
                return credentials["access_token"]
        refresh_token = credentials.get("refresh_token")
        if not refresh_token:
            raise ProviderNotConnected("Google authorization expired and no refresh token is available. Reconnect the account.")
        payload = {
            "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        refreshed = self._request_json(
            GOOGLE_TOKEN_URL,
            method="POST",
            form=payload,
            authenticated=False,
        )
        credentials["access_token"] = refreshed["access_token"]
        credentials["expires_at"] = (
            datetime.now(timezone.utc) + timedelta(seconds=int(refreshed.get("expires_in", 3600)))
        ).isoformat().replace("+00:00", "Z")
        self.store.save_connection(
            user_id,
            self.name,
            credentials,
            connection["scopes"],
            connection.get("account_email"),
            credentials["expires_at"],
        )
        return credentials["access_token"]

    def _api(self, user_id: str, url: str, method: str = "GET", payload: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request_json(url, method=method, payload=payload, token=self._access_token(user_id))

    @staticmethod
    def _request_json(
        url: str,
        method: str = "GET",
        payload: dict[str, Any] | None = None,
        form: dict[str, Any] | None = None,
        token: str | None = None,
        authenticated: bool = True,
    ) -> dict[str, Any]:
        headers = {"Accept": "application/json"}
        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        elif form is not None:
            data = urllib.parse.urlencode(form).encode("utf-8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        if authenticated:
            if not token:
                raise ProviderNotConnected("Missing Google access token.")
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=float(os.getenv("PROVIDER_TIMEOUT_SECONDS", "20"))) as response:
                body = response.read()
                return json.loads(body.decode("utf-8")) if body else {}
        except urllib.error.HTTPError as exc:
            try:
                body = json.loads(exc.read().decode("utf-8"))
                message = body.get("error", {}).get("message") or body.get("error_description") or "Google API request failed."
            except Exception:
                message = "Google API request failed."
            raise ProviderError(message, retryable=exc.code in {429, 500, 502, 503, 504}, details={"status": exc.code}) from exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise ProviderError("Google API request timed out or could not be reached.", retryable=True) from exc

    @staticmethod
    def _raw_message(args: dict[str, Any]) -> str:
        message = EmailMessage()
        message["To"] = str(args["to"])
        message["Subject"] = str(args["subject"])
        message.set_content(str(args["body"]))
        return base64.urlsafe_b64encode(message.as_bytes()).decode("ascii").rstrip("=")

    def execute(self, call: dict[str, Any], context: ExecutionContext) -> dict[str, Any]:
        tool = call["tool"]
        args = call["args"]
        if tool not in self.TOOL_SCOPES:
            raise ProviderError(f"Google provider does not support {tool}.")

        if tool == "email.search":
            params = urllib.parse.urlencode({"q": args["query"], "maxResults": min(int(args.get("max_results", 10)), 50)})
            data = self._api(context.user_id, f"https://gmail.googleapis.com/gmail/v1/users/me/messages?{params}")
            return {"messages": data.get("messages", []), "result_size_estimate": data.get("resultSizeEstimate", 0)}
        if tool == "email.read":
            message_id = urllib.parse.quote(str(args["message_id"]), safe="")
            data = self._api(context.user_id, f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}?format=metadata")
            return {"message_id": data.get("id"), "thread_id": data.get("threadId"), "label_ids": data.get("labelIds", []), "payload": data.get("payload", {})}
        if tool == "email.draft":
            data = self._api(
                context.user_id,
                "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
                method="POST",
                payload={"message": {"raw": self._raw_message(args)}},
            )
            return {"provider": "gmail", "status": "draft_created", "draft_id": data.get("id"), "message_id": data.get("message", {}).get("id")}
        if tool == "email.send":
            data = self._api(
                context.user_id,
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                method="POST",
                payload={"raw": self._raw_message(args)},
            )
            return {
                "provider": "gmail",
                "status": "accepted_by_gmail",
                "message_id": data.get("id"),
                "thread_id": data.get("threadId"),
                "label_ids": data.get("labelIds", []),
                "delivery_claim": "Accepted by Gmail for sending; recipient delivery or reading is not asserted.",
            }
        if tool == "contacts.search":
            params = urllib.parse.urlencode({"query": args["query"], "readMask": "names,emailAddresses", "pageSize": min(int(args.get("max_results", 10)), 30)})
            data = self._api(context.user_id, f"https://people.googleapis.com/v1/people:searchContacts?{params}")
            contacts = []
            for result in data.get("results", []):
                person = result.get("person", {})
                names = person.get("names", [])
                emails = person.get("emailAddresses", [])
                contacts.append({
                    "id": person.get("resourceName"),
                    "name": names[0].get("displayName") if names else None,
                    "emails": [item.get("value") for item in emails if item.get("value")],
                })
            return {"contacts": contacts}
        if tool == "calendar.list":
            params = urllib.parse.urlencode({"timeMin": args["start_date"], "timeMax": args["end_date"], "singleEvents": "true", "orderBy": "startTime"})
            data = self._api(context.user_id, f"https://www.googleapis.com/calendar/v3/calendars/primary/events?{params}")
            return {"events": data.get("items", [])}
        if tool == "calendar.check_availability":
            data = self._api(
                context.user_id,
                "https://www.googleapis.com/calendar/v3/freeBusy",
                method="POST",
                payload={"timeMin": args["start_time"], "timeMax": args["end_time"], "items": [{"id": "primary"}]},
            )
            return {"busy": data.get("calendars", {}).get("primary", {}).get("busy", [])}
        if tool == "calendar.create_event":
            event = {"summary": args["title"], "start": {"dateTime": args["start_time"]}, "end": {"dateTime": args["end_time"]}}
            if args.get("attendees"):
                event["attendees"] = [{"email": email} for email in args["attendees"]]
            data = self._api(context.user_id, "https://www.googleapis.com/calendar/v3/calendars/primary/events", method="POST", payload=event)
            return {"provider": "google_calendar", "status": data.get("status"), "event_id": data.get("id"), "html_link": data.get("htmlLink")}
        if tool == "calendar.update_event":
            event_id = urllib.parse.quote(str(args["event_id"]), safe="")
            payload = {key: value for key, value in args.items() if key != "event_id"}
            data = self._api(context.user_id, f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}", method="PATCH", payload=payload)
            return {"provider": "google_calendar", "status": data.get("status"), "event_id": data.get("id"), "html_link": data.get("htmlLink")}
        if tool == "calendar.cancel_event":
            event_id = urllib.parse.quote(str(args["event_id"]), safe="")
            self._api(context.user_id, f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}", method="DELETE")
            return {"provider": "google_calendar", "status": "cancelled", "event_id": args["event_id"]}
        raise ProviderError(f"Unsupported Google tool: {tool}")

    def revoke(self, user_id: str) -> None:
        connection = self._connection(user_id)
        token = connection["credentials"].get("refresh_token") or connection["credentials"].get("access_token")
        if token:
            try:
                self._request_json(GOOGLE_REVOKE_URL, method="POST", form={"token": token}, authenticated=False)
            except ProviderError:
                # Local deletion is still required if Google already invalidated the token.
                pass
        self.store.delete_connection(user_id, self.name)
