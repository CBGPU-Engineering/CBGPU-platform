import importlib.util
import pathlib
import subprocess
import tempfile
import unittest
from unittest import mock


DAEMON_PATH = pathlib.Path(__file__).resolve().parents[1] / "daemon.py"
spec = importlib.util.spec_from_file_location("cbgpu_daemon", DAEMON_PATH)
daemon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daemon)


class GpuSshTest(unittest.TestCase):
    def test_accepts_only_plain_ed25519_key(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "student"
            subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(path)], check=True)
            good = path.with_suffix(".pub").read_text().strip()
            self.assertEqual(daemon.validate_public_key(good), " ".join(good.split()[:2]))
            for bad in ('command="id" ' + good, "ssh-ed25519 AAAA", good.replace("ssh-ed25519", "ssh-rsa", 1)):
                with self.assertRaises(ValueError):
                    daemon.validate_public_key(bad)

    def test_reset_binds_ssh_only_to_tailscale_and_no_host_privileges(self):
        with tempfile.TemporaryDirectory() as directory:
            host_key_dir = pathlib.Path(directory) / "1"
            host_key_dir.mkdir()
            (host_key_dir / "ssh_host_ed25519_key").write_text("test key")
            cfg = {
                "docker": {"image": "cbgpu/gpu-ssh:latest", "container_port": 8888, "ssh_host_keys_dir": directory,
                           "school_bind_address": "10.138.23.12"},
                "gpus": {1: {"container": "jupiterhub_gpu1", "device": "0", "host_port": 8001, "ssh_port": 2201}},
            }
            with mock.patch.object(daemon, "private_bind_address", return_value="100.100.136.37"), \
                 mock.patch.object(daemon.time, "sleep"), \
                 mock.patch.object(daemon.subprocess, "run", return_value=mock.Mock(returncode=0, stdout="true", stderr="")) as run:
                daemon.reset_container(cfg, 1)
            commands = [call.args[0] for call in run.call_args_list]
            docker_create = next(command for command in commands if command[:2] == ["docker", "create"])
            self.assertIn("100.100.136.37:2201:22", docker_create)
            self.assertIn("127.0.0.1:8001:8888", docker_create)
            self.assertIn("10.138.23.12:8001:8888", docker_create)
            self.assertIn("100.100.136.37:8001:8888", docker_create)
            self.assertNotIn("8001:8888", docker_create)
            self.assertIn("--gpus", docker_create)
            self.assertNotIn("--privileged", docker_create)
            self.assertNotIn("/var/run/docker.sock", " ".join(docker_create))
            self.assertIn("/etc/ssh/hostkeys:ro", " ".join(docker_create))
            self.assertLess(commands.index(docker_create), commands.index(["docker", "stop", "jupiterhub_gpu1"]))

    def test_reset_restores_old_container_when_replacement_cannot_start(self):
        with tempfile.TemporaryDirectory() as directory:
            host_key_dir = pathlib.Path(directory) / "1"
            host_key_dir.mkdir()
            (host_key_dir / "ssh_host_ed25519_key").write_text("test key")
            cfg = {
                "docker": {"image": "cbgpu/gpu-ssh:latest", "container_port": 8888, "ssh_host_keys_dir": directory,
                           "school_bind_address": "10.138.23.12"},
                "gpus": {1: {"container": "jupiterhub_gpu1", "device": "0", "host_port": 8001, "ssh_port": 2201}},
            }
            commands = []
            starts = 0

            def fake_run(command, **_):
                nonlocal starts
                commands.append(command)
                if command[:2] == ["docker", "start"]:
                    starts += 1
                    if starts == 1:
                        return mock.Mock(returncode=1, stdout="", stderr="port unavailable")
                return mock.Mock(returncode=0, stdout="true", stderr="")

            with mock.patch.object(daemon, "private_bind_address", return_value="100.100.136.37"), \
                 mock.patch.object(daemon.subprocess, "run", side_effect=fake_run):
                with self.assertRaisesRegex(RuntimeError, "Cannot start replacement"):
                    daemon.reset_container(cfg, 1)

            candidate = next(command[3] for command in commands if command[:2] == ["docker", "create"] and command[2] == "--name")
            backup = next(command[3] for command in commands if command[:3] == ["docker", "rename", "jupiterhub_gpu1"])
            self.assertIn(["docker", "rm", "-f", "jupiterhub_gpu1"], commands)
            self.assertIn(["docker", "rename", backup, "jupiterhub_gpu1"], commands)
            self.assertEqual(commands[-1], ["docker", "start", "jupiterhub_gpu1"])
            self.assertNotIn(["docker", "rm", backup], commands)
            self.assertNotEqual(candidate, backup)

    def test_reset_keeps_old_container_when_replacement_creation_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            host_key_dir = pathlib.Path(directory) / "1"
            host_key_dir.mkdir()
            (host_key_dir / "ssh_host_ed25519_key").write_text("test key")
            cfg = {
                "docker": {"image": "cbgpu/gpu-ssh:latest", "container_port": 8888, "ssh_host_keys_dir": directory,
                           "school_bind_address": "10.138.23.12"},
                "gpus": {1: {"container": "jupiterhub_gpu1", "device": "0", "host_port": 8001, "ssh_port": 2201}},
            }

            def fake_run(command, **_):
                if command[:2] == ["docker", "create"]:
                    return mock.Mock(returncode=1, stdout="", stderr="invalid GPU request")
                return mock.Mock(returncode=0, stdout="true", stderr="")

            with mock.patch.object(daemon, "private_bind_address", return_value="100.100.136.37"), \
                 mock.patch.object(daemon.subprocess, "run", side_effect=fake_run) as run:
                with self.assertRaisesRegex(RuntimeError, "docker create failed"):
                    daemon.reset_container(cfg, 1)
            commands = [call.args[0] for call in run.call_args_list]
            self.assertFalse(any(command[1] in ("stop", "rm", "rename") for command in commands))


if __name__ == "__main__":
    unittest.main()
