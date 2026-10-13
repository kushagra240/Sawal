"""Encrypted persistent storage for provider credentials, actions, and audits."""

from __future__ import annotations

import base64
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import secrets
import sqlite3
from threading import RLock
from typing import Any
from uuid import uuid4

from cryptography.fernet import Fernet, InvalidToken


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class CredentialCipher:
    """Fernet wrapper. Production requires a stable SAWAL_TOKEN_ENCRYPTION_KEY."""

    def __init__(self, secret: str | None = None):
        configured = secret or os.getenv("SAWAL_TOKEN_ENCRYPTION_KEY") or os.getenv("SAWAL_SECRET_KEY")
        self.persistent = bool(configured)
        material = configured or secrets.token_urlsafe(48)
        key = base64.urlsafe_b64encode(hashlib.sha256(material.encode("utf-8")).digest())
        self._fernet = Fernet(key)

    def encrypt(self, value: dict[str, Any]) -> str:
        raw = json.dumps(value, separators=(",", ":")).encode("utf-8")
        return self._fernet.encrypt(raw).decode("ascii")

    def decrypt(self, value: str) -> dict[str, Any]:
        try:
            return json.loads(self._fernet.decrypt(value.encode("ascii")).decode("utf-8"))
        except (InvalidToken, ValueError, json.JSONDecodeError) as exc:
            raise ValueError("Stored provider credentials could not be decrypted.") from exc


class AgentStore:
    def __init__(self, path: str | Path | None = None, cipher: CredentialCipher | None = None):
        default_path = Path(__file__).resolve().parents[1] / ".data" / "sawal.db"
        self.path = str(path or os.getenv("SAWAL_DATABASE_PATH") or default_path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self.cipher = cipher or CredentialCipher()
        self._lock = RLock()
        self._connection = sqlite3.connect(self.path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._migrate()

    def _migrate(self) -> None:
        with self._lock, self._connection:
            self._connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS provider_connections (
                    user_id TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    encrypted_credentials TEXT NOT NULL,
                    scopes_json TEXT NOT NULL,
                    account_email TEXT,
                    expires_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, provider)
                );
                CREATE TABLE IF NOT EXISTS actions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    state TEXT NOT NULL,
                    plan_json TEXT NOT NULL,
                    preview_json TEXT NOT NULL,
                    result_json TEXT,
                    error_json TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE (user_id, idempotency_key)
                );
                CREATE TABLE IF NOT EXISTS audit_events (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    action_id TEXT,
                    event_type TEXT NOT NULL,
                    provider TEXT,
                    tool TEXT,
                    payload_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS expenses (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    amount REAL NOT NULL,
                    currency TEXT NOT NULL,
                    description TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )

    def save_connection(
        self,
        user_id: str,
        provider: str,
        credentials: dict[str, Any],
        scopes: list[str],
        account_email: str | None = None,
        expires_at: str | None = None,
    ) -> None:
        now = _now()
        encrypted = self.cipher.encrypt(credentials)
        with self._lock, self._connection:
            self._connection.execute(
                """INSERT INTO provider_connections
                (user_id, provider, encrypted_credentials, scopes_json, account_email, expires_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, provider) DO UPDATE SET
                  encrypted_credentials=excluded.encrypted_credentials,
                  scopes_json=excluded.scopes_json,
                  account_email=excluded.account_email,
                  expires_at=excluded.expires_at,
                  updated_at=excluded.updated_at""",
                (user_id, provider, encrypted, json.dumps(scopes), account_email, expires_at, now, now),
            )

    def get_connection(self, user_id: str, provider: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM provider_connections WHERE user_id=? AND provider=?",
                (user_id, provider),
            ).fetchone()
        if not row:
            return None
        return {
            "user_id": row["user_id"],
            "provider": row["provider"],
            "credentials": self.cipher.decrypt(row["encrypted_credentials"]),
            "scopes": json.loads(row["scopes_json"]),
            "account_email": row["account_email"],
            "expires_at": row["expires_at"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def delete_connection(self, user_id: str, provider: str) -> bool:
        with self._lock, self._connection:
            cursor = self._connection.execute(
                "DELETE FROM provider_connections WHERE user_id=? AND provider=?",
                (user_id, provider),
            )
        return cursor.rowcount > 0

    def connection_status(self, user_id: str, provider: str) -> dict[str, Any]:
        connection = self.get_connection(user_id, provider)
        return {
            "provider": provider,
            "connected": connection is not None,
            "account_email": connection.get("account_email") if connection else None,
            "scopes": connection.get("scopes", []) if connection else [],
            "updated_at": connection.get("updated_at") if connection else None,
            "credential_storage_persistent": self.cipher.persistent,
        }

    def create_action(
        self,
        user_id: str,
        session_id: str,
        plan: list[dict[str, Any]],
        preview: dict[str, Any],
        idempotency_key: str,
        state: str = "awaiting_confirmation",
    ) -> dict[str, Any]:
        existing = self.get_action_by_idempotency(user_id, idempotency_key)
        if existing:
            return existing
        action_id = str(uuid4())
        now = _now()
        with self._lock, self._connection:
            self._connection.execute(
                """INSERT INTO actions
                (id, user_id, session_id, idempotency_key, state, plan_json, preview_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (action_id, user_id, session_id, idempotency_key, state, json.dumps(plan), json.dumps(preview), now, now),
            )
        return self.get_action(action_id, user_id)  # type: ignore[return-value]

    def get_action(self, action_id: str, user_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM actions WHERE id=? AND user_id=?", (action_id, user_id)
            ).fetchone()
        return self._action_row(row)

    def get_action_by_idempotency(self, user_id: str, key: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM actions WHERE user_id=? AND idempotency_key=?", (user_id, key)
            ).fetchone()
        return self._action_row(row)

    @staticmethod
    def _action_row(row: sqlite3.Row | None) -> dict[str, Any] | None:
        if not row:
            return None
        return {
            "id": row["id"], "user_id": row["user_id"], "session_id": row["session_id"],
            "idempotency_key": row["idempotency_key"], "state": row["state"],
            "plan": json.loads(row["plan_json"]), "preview": json.loads(row["preview_json"]),
            "result": json.loads(row["result_json"]) if row["result_json"] else None,
            "error": json.loads(row["error_json"]) if row["error_json"] else None,
            "created_at": row["created_at"], "updated_at": row["updated_at"],
        }

    def update_action(
        self,
        action_id: str,
        user_id: str,
        state: str,
        result: dict[str, Any] | None = None,
        error: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        with self._lock, self._connection:
            self._connection.execute(
                "UPDATE actions SET state=?, result_json=?, error_json=?, updated_at=? WHERE id=? AND user_id=?",
                (state, json.dumps(result) if result is not None else None, json.dumps(error) if error else None, _now(), action_id, user_id),
            )
        return self.get_action(action_id, user_id)

    def list_actions(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._connection.execute(
                "SELECT * FROM actions WHERE user_id=? ORDER BY created_at DESC LIMIT ?", (user_id, limit)
            ).fetchall()
        return [self._action_row(row) for row in rows if row]  # type: ignore[misc]

    def audit(
        self,
        user_id: str,
        event_type: str,
        payload: dict[str, Any],
        action_id: str | None = None,
        provider: str | None = None,
        tool: str | None = None,
    ) -> None:
        with self._lock, self._connection:
            self._connection.execute(
                "INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (str(uuid4()), user_id, action_id, event_type, provider, tool, json.dumps(payload), _now()),
            )

    def list_audit(self, user_id: str, limit: int = 100) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._connection.execute(
                "SELECT * FROM audit_events WHERE user_id=? ORDER BY created_at DESC LIMIT ?", (user_id, limit)
            ).fetchall()
        return [{**dict(row), "payload": json.loads(row["payload_json"])} for row in rows]

    def add_expense(self, user_id: str, amount: float, currency: str, description: str) -> dict[str, Any]:
        expense = {"id": str(uuid4()), "user_id": user_id, "amount": amount, "currency": currency, "description": description, "created_at": _now()}
        with self._lock, self._connection:
            self._connection.execute(
                "INSERT INTO expenses VALUES (?, ?, ?, ?, ?, ?)", tuple(expense.values())
            )
        return expense

    def list_expenses(self, user_id: str, limit: int = 100) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._connection.execute(
                "SELECT * FROM expenses WHERE user_id=? ORDER BY created_at DESC LIMIT ?", (user_id, limit)
            ).fetchall()
        return [dict(row) for row in rows]
