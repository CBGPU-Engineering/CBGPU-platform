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
                "docker": {"image": "cbgpu/gpu-ssh:latest", "container_port": 8888, "ssh_host_keys_dir": directory},
                "gpus": {1: {"container": "jupiterhub_gpu1", "device": "0", "host_port": 8001, "ssh_port": 2201}},
            }
            with mock.patch.object(daemon, "private_bind_address", return_value="100.100.136.37"), \
                 mock.patch.object(daemon.subprocess, "run", return_value=mock.Mock(returncode=0, stdout="", stderr="")) as run:
                daemon.reset_container(cfg, 1)
            commands = [call.args[0] for call in run.call_args_list]
            docker_run = next(command for command in commands if command[:2] == ["docker", "run"])
            self.assertIn("100.100.136.37:2201:22", docker_run)
            self.assertIn("--gpus", docker_run)
            self.assertNotIn("--privileged", docker_run)
            self.assertNotIn("/var/run/docker.sock", " ".join(docker_run))
            self.assertIn("/etc/ssh/hostkeys:ro", " ".join(docker_run))


if __name__ == "__main__":
    unittest.main()
