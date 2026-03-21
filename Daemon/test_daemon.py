"""
CBGPU Daemon 테스트
실행: pytest test_daemon.py -v
"""

import pytest
import tempfile
import os
from unittest.mock import patch, MagicMock, call
from datetime import datetime, timezone, timedelta

import yaml

# 테스트 대상 함수들 import
from daemon import (
    load_config,
    random_password,
    apply_password,
    reset_container,
    fetch_gpus,
    fetch_active_reservations,
)


# ── 공통 픽스처 ────────────────────────────────────────────

VALID_CONFIG = {
    "supabase_url": "https://test.supabase.co",
    "supabase_anon_key": "test-key",
    "poll_interval_seconds": 10,
    "docker": {
        "image": "tensorflow/tensorflow:latest-gpu-jupyter",
        "container_port": 8888,
    },
    "gpus": {
        1: {"username": "gpu1", "container": "jupiterhub_gpu1", "device": "0", "host_port": 8001},
        2: {"username": "gpu2", "container": "jupiterhub_gpu2", "device": "1", "host_port": 8002},
    },
}


@pytest.fixture
def config_file():
    """임시 config.yaml 파일 생성"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
        yaml.dump(VALID_CONFIG, f)
        path = f.name
    yield path
    os.unlink(path)


# ── load_config 테스트 ─────────────────────────────────────

class TestLoadConfig:
    def test_valid_config(self, config_file):
        cfg = load_config(config_file)
        assert cfg["supabase_url"] == "https://test.supabase.co"
        assert cfg["poll_interval_seconds"] == 10
        assert cfg["gpus"][1]["username"] == "gpu1"

    def test_missing_supabase_url(self, tmp_path):
        bad = {**VALID_CONFIG, "supabase_url": ""}
        path = tmp_path / "cfg.yaml"
        path.write_text(yaml.dump(bad))
        with pytest.raises(ValueError, match="supabase_url"):
            load_config(str(path))

    def test_missing_gpu_field(self, tmp_path):
        bad = {
            **VALID_CONFIG,
            "gpus": {1: {"username": "gpu1", "container": "c1", "device": "0"}},  # host_port 누락
        }
        path = tmp_path / "cfg.yaml"
        path.write_text(yaml.dump(bad))
        with pytest.raises(ValueError, match="host_port"):
            load_config(str(path))

    def test_default_poll_interval(self, tmp_path):
        no_interval = {k: v for k, v in VALID_CONFIG.items() if k != "poll_interval_seconds"}
        path = tmp_path / "cfg.yaml"
        path.write_text(yaml.dump(no_interval))
        cfg = load_config(str(path))
        assert cfg["poll_interval_seconds"] == 30


# ── random_password 테스트 ─────────────────────────────────

class TestRandomPassword:
    def test_default_length(self):
        pw = random_password()
        assert len(pw) == 20

    def test_custom_length(self):
        pw = random_password(32)
        assert len(pw) == 32

    def test_alphanumeric_only(self):
        for _ in range(10):
            pw = random_password()
            assert pw.isalnum(), f"특수문자 포함됨: {pw}"

    def test_unique(self):
        passwords = {random_password() for _ in range(50)}
        assert len(passwords) == 50  # 중복 없어야 함


# ── apply_password 테스트 ──────────────────────────────────

class TestApplyPassword:
    def test_success(self):
        mock_result = MagicMock(returncode=0)
        with patch("daemon.subprocess.run", return_value=mock_result) as mock_run:
            apply_password("jupiterhub_gpu1", "gpu1", "testpass123")

        mock_run.assert_called_once()
        args = mock_run.call_args
        # sudo docker exec -i {container} chpasswd 명령 확인
        cmd = args[0][0]
        assert "docker" in cmd
        assert "exec" in cmd
        assert "jupiterhub_gpu1" in cmd
        assert "chpasswd" in cmd
        # 입력값에 username:password 형식 확인
        assert args[1]["input"] == "gpu1:testpass123\n"

    def test_failure_raises(self):
        mock_result = MagicMock(returncode=1, stderr="Permission denied")
        with patch("daemon.subprocess.run", return_value=mock_result):
            with pytest.raises(RuntimeError, match="chpasswd 실패"):
                apply_password("jupiterhub_gpu1", "gpu1", "testpass123")


# ── reset_container 테스트 ────────────────────────────────

class TestResetContainer:
    def test_runs_rm_then_run(self):
        mock_result = MagicMock(returncode=0)
        with patch("daemon.subprocess.run", return_value=mock_result) as mock_run:
            reset_container(VALID_CONFIG, 1)

        assert mock_run.call_count == 2
        rm_call, run_call = mock_run.call_args_list

        # docker rm -f 확인
        rm_cmd = rm_call[0][0]
        assert "rm" in rm_cmd
        assert "-f" in rm_cmd
        assert "jupiterhub_gpu1" in rm_cmd

        # docker run 확인
        run_cmd = run_call[0][0]
        assert "run" in run_cmd
        assert "jupiterhub_gpu1" in run_cmd
        assert "device=0" in run_cmd
        assert "8001:8888" in run_cmd

    def test_docker_run_failure_raises(self):
        rm_ok = MagicMock(returncode=0)
        run_fail = MagicMock(returncode=1, stderr="No such image")
        with patch("daemon.subprocess.run", side_effect=[rm_ok, run_fail]):
            with pytest.raises(RuntimeError, match="docker run 실패"):
                reset_container(VALID_CONFIG, 1)


# ── fetch_gpus 테스트 ─────────────────────────────────────

class TestFetchGpus:
    def test_returns_gpu_list(self):
        mock_resp = MagicMock()
        mock_resp.json.return_value = [
            {"id": 1, "password": "abc123"},
            {"id": 2, "password": "xyz789"},
        ]
        mock_resp.raise_for_status = MagicMock()

        with patch("daemon.requests.get", return_value=mock_resp):
            result = fetch_gpus(VALID_CONFIG)

        assert len(result) == 2
        assert result[0]["id"] == 1
        assert result[0]["password"] == "abc123"

    def test_http_error_raises(self):
        mock_resp = MagicMock()
        mock_resp.raise_for_status.side_effect = Exception("HTTP 500")

        with patch("daemon.requests.get", return_value=mock_resp):
            with pytest.raises(Exception, match="HTTP 500"):
                fetch_gpus(VALID_CONFIG)


# ── fetch_active_reservations 테스트 ──────────────────────

class TestFetchActiveReservations:
    def test_returns_reservations(self):
        now = datetime.now(timezone.utc)
        mock_resp = MagicMock()
        mock_resp.json.return_value = [
            {
                "id": "res-1",
                "gpu_id": 1,
                "start_time": (now - timedelta(hours=2)).isoformat(),
                "end_time": (now + timedelta(hours=1)).isoformat(),
                "status": "approved",
            }
        ]
        mock_resp.raise_for_status = MagicMock()

        with patch("daemon.requests.get", return_value=mock_resp):
            result = fetch_active_reservations(VALID_CONFIG)

        assert len(result) == 1
        assert result[0]["gpu_id"] == 1
        assert result[0]["status"] == "approved"

    def test_query_filters_approved(self):
        mock_resp = MagicMock()
        mock_resp.json.return_value = []
        mock_resp.raise_for_status = MagicMock()

        with patch("daemon.requests.get", return_value=mock_resp) as mock_get:
            fetch_active_reservations(VALID_CONFIG)

        url = mock_get.call_args[0][0]
        assert "status=eq.approved" in url
