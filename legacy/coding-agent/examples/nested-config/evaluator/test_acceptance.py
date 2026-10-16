"""Operator-owned acceptance tests, withheld from the agent workspace."""
import unittest

from config_parser import coerce_values


class AcceptanceTests(unittest.TestCase):
    def test_deeply_nested_list_and_dict(self):
        self.assertEqual(coerce_values({"services": [{"ports": ["80", "443"], "tls": "false"}]}),
                         {"services": [{"ports": [80, 443], "tls": False}]})

    def test_nested_lists(self):
        self.assertEqual(coerce_values([["1", "true"], ["-3", "false"]]), [[1, True], [-3, False]])

    def test_preserves_existing_values(self):
        source = {"items": [None, False, 0, "hello", []]}
        self.assertEqual(coerce_values(source), source)

    def test_does_not_mutate_input(self):
        source = {"x": ["1", {"y": "true"}]}
        actual = coerce_values(source)
        self.assertEqual(source, {"x": ["1", {"y": "true"}]})
        self.assertEqual(actual, {"x": [1, {"y": True}]})
