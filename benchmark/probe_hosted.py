from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core import llm
from core.world import seed_world

tests = [
    "Check my calendar for tomorrow afternoon.",
    "Find a quiet spot for team lunch near campus.",
    "Send an email to Priya confirming the lab slot.",
    "Draft a note for the study group and log 40 rupees for tea.",
    "Book a seminar hall for tomorrow evening."
]

for text in tests:
    start = time.perf_counter()
    result = llm.propose(text, seed_world(), 5)
    latency = int((time.perf_counter() - start) * 1000)

    plans = result or []
    print("\nREQUEST:", text)
    print("LATENCY_MS:", latency)
    print("PLANS:", len(plans))
    for i, p in enumerate(plans, 1):
        print(i, p)
