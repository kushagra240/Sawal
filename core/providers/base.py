"""Common live-provider contracts."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


class ProviderError(RuntimeError):
    code = "PROVIDER_ERROR"

    def __init__(self, message: str, *, retryable: bool = False, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.retryable = retryable
        self.details = details or {}


class ProviderNotConnected(ProviderError):
    code = "PROVIDER_NOT_CONNECTED"


class ProviderUnavailable(ProviderError):
    code = "PROVIDER_UNAVAILABLE"


@dataclass(frozen=True)
class ExecutionContext:
    user_id: str
    action_id: str
    idempotency_key: str


class ToolProvider(ABC):
    name: str

    @abstractmethod
    def capabilities(self, user_id: str) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def execute(self, call: dict[str, Any], context: ExecutionContext) -> dict[str, Any]:
        raise NotImplementedError
