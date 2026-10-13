import unittest

from core.engine import answer_session, create_session
from core.llm import ensure_open_weight_model
from core.tools import run_tool
from core.world import seed_world


class EngineTests(unittest.TestCase):
    def test_ambiguous_send_asks_then_sends_only_to_selected_contact(self):
        world = seed_world()
        session = create_session("Send an email to Priya confirming the lab slot.", world)
        self.assertEqual(session["status"], "asked")
        self.assertEqual(len(session["question"]["options"]), 2)
        self.assertEqual(session["question"]["slot_name"], "contact_id")
        self.assertEqual(
            {option["value"] for option in session["question"]["options"]},
            {"priya-sharma", "priya-kulkarni"},
        )
        self.assertEqual(world["emails"], [])
        option = next(x for x in session["question"]["options"] if x["value"] == "priya-sharma")
        answer_session(session, world, session["question"]["id"], option["id"], None)
        self.assertEqual(session["status"], "completed")
        self.assertEqual(len(world["emails"]), 1)
        self.assertEqual(world["emails"][0]["to"], "priya.sharma@fincorp.internal")

    def test_safe_calendar_read_acts_without_mutating_world(self):
        world = seed_world()
        initial = seed_world()
        session = create_session("Check my calendar for tomorrow afternoon.", world)
        self.assertEqual(session["status"], "completed")
        self.assertEqual(session["decision"]["action"], "act")
        self.assertEqual(world, initial)
        self.assertEqual(session["result"]["world_diff"], {"added": {}, "modified": {}, "deleted": {}})

    def test_draft_is_low_risk_and_does_not_send(self):
        world = seed_world()
        session = create_session("Draft an email to Rohan about the project update.", world)
        self.assertEqual(session["status"], "completed")
        self.assertEqual(world["emails"][0]["status"], "draft")
        self.assertTrue(world["emails"][0]["to"].startswith("rohan."))

    def test_plan_is_rehearsed_in_clones(self):
        world = seed_world()
        session = create_session("Send an email to Priya confirming the lab slot.", world)
        self.assertEqual(len(session["interpretations"]), 5)
        self.assertEqual(world["emails"], [])

    def test_answer_rejects_a_stale_question(self):
        world = seed_world()
        session = create_session("Send an email to Priya confirming the lab slot.", world)
        with self.assertRaisesRegex(ValueError, "does not match"):
            answer_session(session, world, "stale-question", "opt-priya-sharma", None)

    def test_explicit_expense_is_logged_as_low_risk(self):
        world = seed_world()
        session = create_session("Log 40 rupees for tea.", world)
        self.assertEqual(session["status"], "completed")
        self.assertEqual(session["result"]["executed_plan"][0]["tool"], "expenses.log")
        self.assertEqual(world["expenses"][0]["amount"], 40)

    def test_restaurant_search_is_read_only(self):
        world = seed_world()
        session = create_session("Find vegetarian restaurants.", world)
        self.assertEqual(session["status"], "completed")
        self.assertEqual(session["result"]["executed_plan"][0]["tool"], "restaurants.search")
        self.assertEqual(world["reservations"], [])

    def test_closed_model_family_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "open-weight"):
            ensure_open_weight_model("closed-provider-model")

    def test_unknown_tool_is_rejected_before_execution(self):
        with self.assertRaisesRegex(ValueError, "not allowlisted"):
            run_tool(seed_world(), {"tool": "shell.exec", "args": {}})


if __name__ == "__main__":
    unittest.main()
