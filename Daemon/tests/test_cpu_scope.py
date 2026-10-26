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
    def test_controlled_rollout_preserves_idle_gpu_container(self):
        polls = 0

        def next_poll(_):
            nonlocal polls
            polls += 1
            if polls == 2:
                raise StopIteration

        with mock.patch.object(daemon, "load_config", return_value={"poll_interval_seconds": 30, "gpus": {4: {"container": "jupiterhub_gpu4"}}}), \
             mock.patch.object(daemon, "fetch_gpus", return_value=[]), \
             mock.patch.object(daemon, "fetch_active_reservations", return_value=[]), \
             mock.patch.object(daemon, "fetch_ssh_keys", return_value={}), \
             mock.patch.object(daemon, "fetch_cpu_projects", return_value=[]), \
             mock.patch.object(daemon.os.path, "isfile", return_value=True), \
             mock.patch.object(daemon, "reset_container") as reset, \
             mock.patch.object(daemon.time, "sleep", side_effect=next_poll):
            with self.assertRaises(StopIteration):
                daemon.main()
        reset.assert_not_called()

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

    def test_tunnel_start_does_not_block_gpu_polling(self):
        project = {
            "id": "12345678-1234-1234-1234-123456789abc", "name": "public",
            "status": "approved", "access_scope": "public", "public_url": None,
            "deployed_at": "2026-10-22T00:00:00Z", "deploy_requested_at": "2026-10-21T00:00:00Z",
        }
        polls = 0

        def next_poll(_):
            nonlocal polls
            polls += 1
            if polls == 3:
                raise StopIteration

        executor = mock.Mock()
        executor.submit.return_value = Future()  # Tunnel image pull never finishes.
        with mock.patch.object(daemon, "load_config", return_value={"poll_interval_seconds": 30, "gpus": {}}), \
             mock.patch.object(daemon, "fetch_gpus", return_value=[]) as fetch_gpus, \
             mock.patch.object(daemon, "fetch_active_reservations", return_value=[]), \
             mock.patch.object(daemon, "fetch_ssh_keys", return_value={}), \
             mock.patch.object(daemon, "fetch_cpu_projects", return_value=[project]), \
             mock.patch.object(daemon, "cpu_container_running", return_value=True), \
             mock.patch.object(daemon, "ThreadPoolExecutor", return_value=executor), \
             mock.patch.object(daemon.time, "sleep", side_effect=next_poll):
            with self.assertRaises(StopIteration):
                daemon.main()

        self.assertEqual(fetch_gpus.call_count, 2)
        executor.submit.assert_called_once_with(daemon.sync_cpu_tunnel, project, {"poll_interval_seconds": 30, "gpus": {}})

    def test_new_public_project_delete_needs_no_firewall_rule(self):
        status = "Status: active\n9001/tcp ALLOW IN Anywhere\n"
        with mock.patch.object(daemon.subprocess, "run",
                               return_value=mock.Mock(returncode=0, stdout=status, stderr="")) as run:
            daemon.apply_firewall(19080, "public", "delete")
        run.assert_called_once_with(["ufw", "status"], capture_output=True, text=True)

    def test_legacy_public_project_delete_removes_firewall_rule(self):
        status = "Status: active\n9001/tcp ALLOW IN Anywhere\n"
        with mock.patch.object(daemon.subprocess, "run",
                               return_value=mock.Mock(returncode=0, stdout=status, stderr="")) as run:
            daemon.apply_firewall(9001, "public", "delete")
        self.assertEqual(run.call_args_list[-1].args[0], ["ufw", "delete", "allow", "9001"])

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

    def test_public_deployment_never_binds_all_interfaces(self):
        project = {
            "id": "12345678-1234-1234-1234-123456789abc", "name": "test",
            "host_port": 19080, "container_port": 80,
            "cpu_limit": "1", "memory_limit": "512m", "access_scope": "public",
            "deploy_type": "docker", "docker_image": "nginx:alpine",
        }
        cfg = {"docker": {"school_bind_address": "10.138.23.12"}}

        def fake_run(command, **_):
            if command[:3] == ["docker", "inspect", "--format"]:
                return mock.Mock(returncode=1, stdout="", stderr="error: no such object")
            return mock.Mock(returncode=0, stdout="", stderr="")
        with mock.patch.object(daemon.subprocess, "run", side_effect=fake_run) as run, \
             mock.patch.object(daemon, "private_bind_address", return_value="100.100.136.37"), \
             mock.patch.object(daemon, "wait_for_cpu_container"):
            daemon.start_cpu_container(project, cfg)
        command = next(call.args[0] for call in run.call_args_list if call.args[0][:2] == ["docker", "create"])
        for address in ("127.0.0.1", "10.138.23.12", "100.100.136.37"):
            self.assertIn(f"{address}:19080:80", command)
        self.assertNotIn("0.0.0.0:19080:80", command)
        self.assertFalse(any(arg.startswith(":19080") for arg in command))

    def test_tunnel_url_ignores_cloudflared_api_host_and_takes_latest(self):
        logs = (
            'ERR failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel"\n'
            "|  https://old-name-here.trycloudflare.com  |\n"
            "|  https://new-name-here.trycloudflare.com  |\n"
        )
        with mock.patch.object(daemon.subprocess, "run",
                               return_value=mock.Mock(returncode=0, stdout="", stderr=logs)):
            self.assertEqual(daemon.read_cpu_tunnel_url("12345678-1234"), "https://new-name-here.trycloudflare.com")
        with mock.patch.object(daemon.subprocess, "run",
                               return_value=mock.Mock(returncode=0, stdout="", stderr='Post "https://api.trycloudflare.com/tunnel"')):
            self.assertIsNone(daemon.read_cpu_tunnel_url("12345678-1234"))

    def test_public_project_gets_loopback_tunnel_and_url_is_recorded(self):
        project = {"id": "12345678-1234-1234-1234-123456789abc", "name": "t",
                   "host_port": 19080, "access_scope": "public", "public_url": None}
        commands = []

        def fake_run(command, **_):
            commands.append(command)
            if command[:2] == ["docker", "inspect"]:
                return mock.Mock(returncode=1, stdout="", stderr="Error: No such object")
            if command[:2] == ["docker", "logs"]:
                return mock.Mock(returncode=0, stdout="", stderr="https://abc-def.trycloudflare.com")
            return mock.Mock(returncode=0, stdout="", stderr="")
        cfg = {"docker": {}, "supabase_url": "https://example.supabase.co"}
        with mock.patch.object(daemon.subprocess, "run", side_effect=fake_run), \
             mock.patch.object(daemon, "update_cpu_public_url") as update:
            daemon.sync_cpu_tunnel(project, cfg)
        run = next(c for c in commands if c[:3] == ["docker", "run", "-d"])
        self.assertIn("--network", run)
        self.assertEqual(run[run.index("--url") + 1], "http://127.0.0.1:19080")
        update.assert_called_once_with(cfg, project["id"], "https://abc-def.trycloudflare.com")

    def test_existing_tunnel_for_same_port_is_kept_and_unchanged_url_not_rewritten(self):
        project = {"id": "12345678-1234-1234-1234-123456789abc", "name": "t", "host_port": 19080,
                   "access_scope": "public", "public_url": "https://abc-def.trycloudflare.com"}
        commands = []

        def fake_run(command, **_):
            commands.append(command)
            if command[:2] == ["docker", "inspect"]:
                return mock.Mock(returncode=0, stdout="true|19080", stderr="")
            if command[:2] == ["docker", "logs"]:
                return mock.Mock(returncode=0, stdout="", stderr="https://abc-def.trycloudflare.com")
            return mock.Mock(returncode=0, stdout="", stderr="")
        with mock.patch.object(daemon.subprocess, "run", side_effect=fake_run), \
             mock.patch.object(daemon, "update_cpu_public_url") as update:
            daemon.sync_cpu_tunnel(project, {"docker": {}})
        self.assertFalse(any(c[:2] == ["docker", "run"] or c[:3] == ["docker", "rm", "-f"] for c in commands))
        update.assert_not_called()

    def test_tunnel_for_old_port_is_replaced_after_port_change(self):
        project = {"id": "12345678-1234-1234-1234-123456789abc", "name": "t", "host_port": 19081,
                   "access_scope": "public", "public_url": "https://old.trycloudflare.com"}
        commands = []

        def fake_run(command, **_):
            commands.append(command)
            if command[:2] == ["docker", "inspect"]:
                return mock.Mock(returncode=0, stdout="true|19080", stderr="")
            if command[:2] == ["docker", "logs"]:
                return mock.Mock(returncode=0, stdout="", stderr="https://new.trycloudflare.com")
            return mock.Mock(returncode=0, stdout="", stderr="")
        with mock.patch.object(daemon.subprocess, "run", side_effect=fake_run), \
             mock.patch.object(daemon, "update_cpu_public_url") as update:
            daemon.sync_cpu_tunnel(project, {"docker": {}})
        self.assertIn(["docker", "rm", "-f", "cbtun_12345678"], commands)
        self.assertTrue(any(c[:3] == ["docker", "run", "-d"] for c in commands))
        update.assert_called_once()

    def test_leaving_public_scope_removes_tunnel_and_clears_url(self):
        project = {"id": "12345678-1234-1234-1234-123456789abc", "name": "t", "host_port": 19080,
                   "access_scope": "school", "public_url": "https://old.trycloudflare.com"}
        with mock.patch.object(daemon.subprocess, "run",
                               return_value=mock.Mock(returncode=0, stdout="", stderr="")) as run, \
             mock.patch.object(daemon, "update_cpu_public_url") as update:
            daemon.sync_cpu_tunnel(project, {"docker": {}})
        self.assertIn(["docker", "rm", "-f", "cbtun_12345678"], [c.args[0] for c in run.call_args_list])
        update.assert_called_once_with({"docker": {}}, project["id"], None)

    def test_tunnel_failure_does_not_fail_the_deployment(self):
        project = {"id": "12345678-1234-1234-1234-123456789abc", "name": "t", "host_port": 19080,
                   "access_scope": "public"}
        with mock.patch.object(daemon, "ensure_cpu_tunnel", side_effect=RuntimeError("no image")):
            daemon.sync_cpu_tunnel(project, {"docker": {}})  # must not raise

    def test_public_deploy_opens_no_ufw_port(self):
        project = {"id": "12345678-1234-1234-1234-123456789abc", "host_port": 19080, "access_scope": "public"}
        with mock.patch.object(daemon, "apply_firewall") as firewall, \
             mock.patch.object(daemon, "start_cpu_container"), \
             mock.patch.object(daemon, "sync_cpu_tunnel"), \
             mock.patch.object(daemon, "update_cpu_deployed_at"):
            daemon.deploy_cpu_project(project, {})
        firewall.assert_not_called()

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
