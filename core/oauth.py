"""Google OAuth 2.0 authorization-code flow with PKCE and one-time state."""

from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
import hashlib
import os
import secrets
from threading import Lock
from typing import Any
import urllib.parse

from core.providers.google import GoogleProvider, GOOGLE_TOKEN_URL
from core.storage import AgentStore


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
]


class OAuthConfigurationError(RuntimeError):
    pass


class OAuthStateError(RuntimeError):
    pass


class GoogleOAuthManager:
    def __init__(self, store: AgentStore):
        self.store = store
        self._states: dict[str, dict[str, Any]] = {}
        self._lock = Lock()

    @property
    def configured(self) -> bool:
        return bool(os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET"))

    def _config(self) -> tuple[str, str, str]:
        client_id = os.getenv("GOOGLE_CLIENT_ID", "")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
        redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/v1/oauth/google/callback")
        if not client_id or not client_secret:
            raise OAuthConfigurationError("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured.")
        return client_id, client_secret, redirect_uri

    def authorization_url(self, user_id: str) -> str:
        client_id, _, redirect_uri = self._config()
        state = secrets.token_urlsafe(32)
        verifier = secrets.token_urlsafe(64)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).decode("ascii").rstrip("=")
        with self._lock:
            self._states[state] = {
                "user_id": user_id,
                "verifier": verifier,
                "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
            }
        query = urllib.parse.urlencode({
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(GOOGLE_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        })
        return f"{GOOGLE_AUTH_URL}?{query}"

    def _consume_state(self, state: str) -> dict[str, Any]:
        with self._lock:
            item = self._states.pop(state, None)
        if not item or item["expires_at"] <= datetime.now(timezone.utc):
            raise OAuthStateError("OAuth state is invalid, expired, or already used.")
        return item

    def callback(self, code: str, state: str) -> dict[str, Any]:
        client_id, client_secret, redirect_uri = self._config()
        state_data = self._consume_state(state)
        token = GoogleProvider._request_json(
            GOOGLE_TOKEN_URL,
            method="POST",
            form={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": state_data["verifier"],
            },
            authenticated=False,
        )
        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=int(token.get("expires_in", 3600)))
        ).isoformat().replace("+00:00", "Z")
        credentials = {
            "access_token": token["access_token"],
            "refresh_token": token.get("refresh_token"),
            "token_type": token.get("token_type", "Bearer"),
            "expires_at": expires_at,
        }
        profile = GoogleProvider._request_json(
            GOOGLE_USERINFO_URL,
            token=token["access_token"],
        )
        scopes = str(token.get("scope", " ".join(GOOGLE_SCOPES))).split()
        self.store.save_connection(
            state_data["user_id"],
            "google",
            credentials,
            scopes,
            profile.get("email"),
            expires_at,
        )
        self.store.audit(state_data["user_id"], "OAUTH_CONNECTED", {"scopes": scopes, "account_email": profile.get("email")}, provider="google")
        return {"user_id": state_data["user_id"], "account_email": profile.get("email"), "scopes": scopes}
