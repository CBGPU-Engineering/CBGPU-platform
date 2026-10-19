import importlib.util
import pathlib
import unittest
from unittest import mock


DAEMON_PATH = pathlib.Path(__file__).resolve().parents[1] / "daemon.py"
spec = importlib.util.spec_from_file_location("cbgpu_daemon_cpu", DAEMON_PATH)
daemon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daemon)


class CpuScopeTest(unittest.TestCase):
    def test_uuid_prefix_collision_blocks_approved_and_deleted_projects(self):
        projects = [
            {"id": "12345678-1111-1111-1111-111111111111", "status": "approved"},
            {"id": "12345678-2222-2222-2222-222222222222", "status": "deleted"},
            {"id": "87654321-3333-3333-3333-333333333333", "status": "approved"},
        ]
        self.assertEqual(daemon.cpu_collision_prefixes(projects), {"12345678"})

    def test_school_deployment_binds_only_school_interface(self):
        project = {
            "id": "12345678-1234-1234-1234-123456789abc", "name": "test",
            "host_port": 19080, "container_port": 80,
            "cpu_limit": "1", "memory_limit": "512m", "access_scope": "school",
            "deploy_type": "docker", "docker_image": "nginx:alpine",
        }
        cfg = {"docker": {"school_bind_address": "10.138.23.12"}}
        with mock.patch.object(daemon.subprocess, "run", return_value=mock.Mock(returncode=0, stderr="")) as run, \
             mock.patch.object(daemon, "wait_for_cpu_container"):
            daemon.start_cpu_container(project, cfg)
        command = next(call.args[0] for call in run.call_args_list if call.args[0][:2] == ["docker", "run"])
        self.assertIn("10.138.23.12:19080:80", command)
        self.assertNotIn("0.0.0.0:19080:80", command)

    def test_invalid_school_bind_address_preserves_existing_container(self):
        project = {"id": "12345678-1234-1234-1234-123456789abc", "host_port": 19080,
                   "container_port": 80, "access_scope": "school"}
        with mock.patch.object(daemon.subprocess, "run") as run:
            with self.assertRaises(ValueError):
                daemon.start_cpu_container(project, {"docker": {"school_bind_address": "0.0.0.0"}})
        run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
