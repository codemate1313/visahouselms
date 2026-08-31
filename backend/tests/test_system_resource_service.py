import unittest

from app.services import system_resource_service


class SystemResourceServiceTestCase(unittest.TestCase):
    def test_systemd_unit_labels_are_derived_from_cgroup_path(self):
        unit = system_resource_service._systemd_unit_from_cgroup(
            "/system.slice/visahouselms-backend.service"
        )

        self.assertEqual(unit, "visahouselms-backend.service")
        self.assertEqual(
            system_resource_service._readable_unit_label(unit),
            "Visahouselms Backend",
        )

    def test_memory_response_exposes_server_labels(self):
        reading = system_resource_service.memory()

        self.assertIn("host_label", reading)
        self.assertIn("server_label", reading)
        if reading.get("app"):
            self.assertIn("label", reading["app"])
            self.assertIn("usage_label", reading["app"])


if __name__ == "__main__":
    unittest.main()
