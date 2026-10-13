from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any


@dataclass
class WorldState:
    contacts: list[dict[str, Any]] = field(default_factory=list)
    calendar: list[dict[str, Any]] = field(default_factory=list)
    emails: list[dict[str, Any]] = field(default_factory=list)
    reservations: list[dict[str, Any]] = field(default_factory=list)
    expenses: list[dict[str, Any]] = field(default_factory=list)

    def clone(self) -> "WorldState":
        return deepcopy(self)


def create_demo_world() -> WorldState:
    return WorldState(
        contacts=[
            {
                "id": "priya-sharma",
                "name": "Priya Sharma",
                "email": "priya.sharma@example.com",
                "role": "Manager",
            },
            {
                "id": "priya-kulkarni",
                "name": "Priya Kulkarni",
                "email": "priya.kulkarni@example.com",
                "role": "Classmate",
            },
        ],
        calendar=[
            {
                "id": "event-1",
                "title": "Team Meeting",
                "date": "2026-10-14",
                "time": "15:00",
            }
        ],
    )
