"""Seed data and safe in-memory world snapshots for the demo."""

from copy import deepcopy


def seed_world() -> dict:
    return {
        "contacts": [
            {"id": "priya-sharma", "name": "Priya Sharma", "email": "priya.sharma@fincorp.internal", "relationship": "Manager", "company": "FinCorp Global Pune"},
            {"id": "priya-kulkarni", "name": "Priya Kulkarni", "email": "priya.kulkarni@academics.internal", "relationship": "Classmate / Study Partner", "company": "Pune University CS Dept"},
            {"id": "rohan-verma", "name": "Rohan Verma", "email": "rohan.v@techops.internal", "relationship": "Colleague", "company": "FinCorp Global Pune"},
            {"id": "ananya-iyer", "name": "Ananya Iyer", "email": "ananya.iyer@cloudclub.org", "relationship": "Hackathon Mentor", "company": "Cloud Computing Club Pune"},
        ],
        "calendar_events": [
            {"id": "evt-01", "title": "Quarterly Planning Sync", "start_time": "2026-10-15T10:00:00+05:30", "end_time": "2026-10-15T11:00:00+05:30", "attendees": ["priya.sharma@fincorp.internal", "rohan.v@techops.internal"]},
            {"id": "evt-02", "title": "Hackathon Check-in", "start_time": "2026-10-13T14:00:00+05:30", "end_time": "2026-10-13T14:30:00+05:30", "attendees": ["ananya.iyer@cloudclub.org"]},
        ],
        "restaurants": [
            {"id": "rest-spice-route", "name": "Spice Route Pune", "cuisine": "North Indian", "dietary_tags": ["vegetarian", "jain_options"], "price_band": "₹₹", "capacity": 45},
            {"id": "rest-deccan-bistro", "name": "Deccan Bistro", "cuisine": "Continental & Italian", "dietary_tags": ["vegetarian", "vegan", "gluten_free"], "price_band": "₹₹₹", "capacity": 30},
            {"id": "rest-viman-greens", "name": "Viman Greens", "cuisine": "Organic South Indian", "dietary_tags": ["pure_vegetarian", "vegan"], "price_band": "₹", "capacity": 60},
            {"id": "rest-bawarchi-table", "name": "Bawarchi Table", "cuisine": "Mughlai & Biryani", "dietary_tags": ["halal"], "price_band": "₹₹", "capacity": 50},
        ],
        "reservations": [],
        "emails": [],
        "expenses": [],
    }


def clone_world(world: dict) -> dict:
    return deepcopy(world)
