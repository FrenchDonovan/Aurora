import unittest

from config_parser import coerce_values


class ConfigTests(unittest.TestCase):
    def test_scalars(self):
        self.assertEqual(coerce_values({"enabled": "true", "port": "8080"}),
                         {"enabled": True, "port": 8080})

    def test_nested_lists(self):
        self.assertEqual(coerce_values({"ports": ["80", "443"]}), {"ports": [80, 443]})
