import importlib.util
import pathlib
import unittest
from concurrent.futures import Future
from unittest import mock


DAEMON_PATH = pathlib.Path(__file__).resolve().parents[1] / "daemon.py"
spec = importlib.util.spec_from_file_location("cbgpu_daemon_cpu", DAEMON_PATH)
daemon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daemon)


class CpuScopeTest(unittest.TestCase):
    def test_slow_cpu_deploy_does_not_block_gpu_or_other_projects(self):
        project = {
            "id": "12345678-1234-1234-1234-123456789abc", "name": "slow",
            "status": "approved", "deployed_at": None, "deploy_requested_at": "2026-10-22T00:00:00Z",
        }
        other = {**project, "id": "87654321-1234-1234-1234-123456789abc", "name": "other"}
        sleeps = 0

        def next_poll(_):
            nonlocal sleeps
            sleeps += 1
            if sleeps == 3:
                raise StopIteration

        executor = mock.Mock()
        executor.submit.side_effect = [Future(), Future()]  # Both deployments stay in progress.
        with mock.patch.object(daemon, "load_config", return_value={"poll_interval_seconds": 30, "gpus": {}}), \
             mock.patch.object(daemon, "fetch_gpus", return_value=[]) as fetch_gpus, \
             mock.patch.object(daemon, "fetch_active_reservations", return_value=[]), \
             mock.patch.object(daemon, "fetch_ssh_keys", return_value={}), \
             mock.patch.object(daemon, "fetch_cpu_projects", return_value=[project, other]), \
             mock.patch.object(daemon, "cpu_container_running", return_value=False), \
             mock.patch.object(daemon, "ThreadPoolExecutor", return_value=executor), \
             mock.patch.object(daemon.time, "sleep", side_effect=next_poll):
            with self.assertRaises(StopIteration):
                daemon.main()

        self.assertEqual(fetch_gpus.call_count, 2)
        self.assertEqual(executor.submit.call_count, 2)

    def test_git_container_must_survive_after_setup_marker(self):
        inspections = 0

        def fake_run(command, **_):
            nonlocal inspections
            if command[:2] == ["docker", "inspect"]:
                inspections += 1
                state = "true|0" if inspections < 3 else "false|1"
                return mock.Mock(returncode=0, stdout=state, stderr="")
            return mock.Mock(returncode=0, stdout="", stderr="")

        with mock.patch.object(daemon.subprocess, "run", side_effect=fake_run), \
             mock.patch.object(daemon.time, "sleep"):
            with self.assertRaisesRegex(RuntimeError, "exited or restarted"):
                daemon.wait_for_cpu_container("12345678-1234-1234-1234-123456789abc", True)
        self.assertEqual(inspections, 3)

    def test_restarting_container_is_not_ready(self):
        def fake_run(command, **_):
            if command[:2] == ["docker", "inspect"]:
                return mock.Mock(returncode=0, stdout="true|1", stderr="")
            return mock.Mock(returncode=0, stdout="", stderr="")

        with mock.patch.object(daemon.subprocess, "run", side_effect=fake_run):
            with self.assertRaisesRegex(RuntimeError, "restarted during startup"):
                daemon.wait_for_cpu_container("12345678-1234-1234-1234-123456789abc", False)

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
        def fake_run(command, **_):
            if command[:3] == ["docker", "inspect", "--format"]:
                return mock.Mock(returncode=1, stdout="", stderr="error: no such object")
            return mock.Mock(returncode=0, stdout="", stderr="")
        with mock.patch.object(daemon.subprocess, "run", side_effect=fake_run) as run, \
             mock.patch.object(daemon, "wait_for_cpu_container"):
            daemon.start_cpu_container(project, cfg)
        command = next(call.args[0] for call in run.call_args_list if call.args[0][:2] == ["docker", "create"])
        self.assertIn("10.138.23.12:19080:80", command)
        self.assertNotIn("0.0.0.0:19080:80", command)

    def test_failed_redeploy_restores_previous_container(self):
        project = {
            "id": "12345678-1234-1234-1234-123456789abc", "name": "test",
            "host_port": 19080, "container_port": 80, "cpu_limit": "1",
            "memory_limit": "512m", "access_scope": "school",
            "deploy_type": "docker", "docker_image": "nginx:alpine",
        }
        commands = []
        starts = 0

        def fake_run(command, **_):
            nonlocal starts
            commands.append(command)
            if command[:3] == ["docker", "inspect", "--format"]:
                return mock.Mock(returncode=0, stdout="true", stderr="")
            if command[:2] == ["docker", "start"]:
                starts += 1
                if starts == 1:
                    return mock.Mock(returncode=1, stdout="", stderr="port busy")
            return mock.Mock(returncode=0, stdout="", stderr="")

        with mock.patch.object(daemon.subprocess, "run", side_effect=fake_run):
            with self.assertRaisesRegex(RuntimeError, "Cannot start CPU replacement"):
                daemon.start_cpu_container(project, {"docker": {"school_bind_address": "10.138.23.12"}})

        container = daemon.cpu_container_name(project["id"])
        backup = next(command[3] for command in commands if command[:3] == ["docker", "rename", container])
        self.assertLess(next(i for i, command in enumerate(commands) if command[:2] == ["docker", "create"]),
                        commands.index(["docker", "stop", container]))
        self.assertIn(["docker", "rm", "-f", container], commands)
        self.assertIn(["docker", "rename", backup, container], commands)
        self.assertEqual(commands[-1], ["docker", "start", container])
        self.assertNotIn(["docker", "rm", "-f", backup], commands)

    def test_git_redeploy_copies_volume_after_stopping_old_container(self):
        project = {
            "id": "12345678-1234-1234-1234-123456789abc", "name": "test",
            "host_port": 19080, "container_port": 80, "cpu_limit": "1",
            "memory_limit": "512m", "access_scope": "school",
            "deploy_type": "git", "git_url": "https://example.com/repo.git",
            "runtime": "node20", "run_command": "npm start",
        }
        commands = []

        def fake_run(command, **_):
            commands.append(command)
            if command[:4] == ["docker", "inspect", "--format", "{{.State.Running}}"]:
                return mock.Mock(returncode=0, stdout="true", stderr="")
            if command[:3] == ["docker", "inspect", "--format"]:
                return mock.Mock(returncode=0, stdout="cbcpu_old_data", stderr="")
            return mock.Mock(returncode=0, stdout="", stderr="")

        with mock.patch.object(daemon.subprocess, "run", side_effect=fake_run), \
             mock.patch.object(daemon, "wait_for_cpu_container") as wait:
            daemon.start_cpu_container(project, {"docker": {"school_bind_address": "10.138.23.12"}})

        container = daemon.cpu_container_name(project["id"])
        wait.assert_called_once_with(project["id"], True, timeout_seconds=600)
        copy = next(command for command in commands if command[:3] == ["docker", "run", "--rm"])
        self.assertIn("cbcpu_old_data:/source:ro", copy)
        self.assertLess(commands.index(["docker", "stop", container]), commands.index(copy))
        self.assertTrue(any(command[:2] == ["docker", "volume"] and command[2] == "create" for command in commands))

    def test_invalid_school_bind_address_preserves_existing_container(self):
        project = {"id": "12345678-1234-1234-1234-123456789abc", "host_port": 19080,
                   "container_port": 80, "access_scope": "school"}
        with mock.patch.object(daemon.subprocess, "run") as run:
            with self.assertRaises(ValueError):
                daemon.start_cpu_container(project, {"docker": {"school_bind_address": "0.0.0.0"}})
        run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
