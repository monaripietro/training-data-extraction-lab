import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import dashboard


class DashboardTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / "tests/fixtures/dashboard_sample.json").read_text())
        self.text = dashboard.render(self.data, datetime(2026, 11, 28, 12, 0, tzinfo=timezone.utc))

    def test_next_action_follows_priority(self):
        self.assertIn("**Sviluppatore (Vibe):** #60 Esegui tutti", self.text)
        self.assertIn("**Pietro:** #71 Prova", self.text)

    def test_dashboard_issue_and_pulls_are_not_tasks(self):
        self.assertNotIn("**#61**", self.text)
        self.assertNotIn("**#73**", self.text)

    def test_linked_pull_and_question_are_shown(self):
        self.assertIn("#60** Esegui tutti — _da fare_ · PR #73", self.text)
        self.assertIn("❓ domanda", self.text)

    def test_unassigned_section(self):
        self.assertIn("Senza responsabile (1)", self.text)

    def test_timestamp_does_not_count_as_a_change(self):
        later = dashboard.render(self.data, datetime(2026, 11, 28, 13, 0, tzinfo=timezone.utc))
        self.assertEqual(dashboard.strip_timestamp(self.text), dashboard.strip_timestamp(later))


if __name__ == "__main__":
    unittest.main()
