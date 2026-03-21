#!/usr/bin/env python3
"""
CBGPU Daemon

역할:
  1. Supabase gpus 테이블 폴링 → 비밀번호 변경 감지 → 컨테이너 내 계정에 반영
  2. 예약 종료 시간 감지 → 컨테이너 리셋 (흔적 제거 + 접근 차단)

실행: python3 daemon.py [config.yaml 경로]
"""

import sys
import time
import logging
import subprocess
import secrets
import string
from datetime import datetime, timezone

import yaml
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


def load_config(path: str) -> dict:
    with open(path, "r") as f:
        cfg = yaml.safe_load(f)

    for key in ("supabase_url", "supabase_anon_key", "gpus", "docker"):
        if not cfg.get(key):
            raise ValueError(f"config에 '{key}'가 없거나 비어 있습니다")

    for gpu_id, info in cfg["gpus"].items():
        for field in ("username", "container", "device", "host_port"):
            if not info.get(field) and info.get(field) != 0:
                raise ValueError(f"gpus.{gpu_id}에 '{field}'가 필요합니다")

    cfg.setdefault("poll_interval_seconds", 30)
    return cfg


def supabase_headers(cfg: dict) -> dict:
    return {
        "apikey": cfg["supabase_anon_key"],
        "Authorization": f"Bearer {cfg['supabase_anon_key']}",
    }


def fetch_gpus(cfg: dict) -> list[dict]:
    url = cfg["supabase_url"].rstrip("/") + "/rest/v1/gpus?select=id,password"
    resp = requests.get(url, headers=supabase_headers(cfg), timeout=10)
    resp.raise_for_status()
    return resp.json()


def fetch_active_reservations(cfg: dict) -> list[dict]:
    """status=approved인 예약 목록 조회"""
    url = (
        cfg["supabase_url"].rstrip("/")
        + "/rest/v1/reservations?select=id,gpu_id,start_time,end_time,status&status=eq.approved"
    )
    resp = requests.get(url, headers=supabase_headers(cfg), timeout=10)
    resp.raise_for_status()
    return resp.json()


def random_password(length: int = 20) -> str:
    """컨테이너 리셋 후 잠금용 랜덤 비밀번호 생성"""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def apply_password(container: str, username: str, password: str):
    """컨테이너 안 시스템 계정 비밀번호 변경 (chpasswd 사용)"""
    proc = subprocess.run(
        ["sudo", "docker", "exec", "-i", container, "chpasswd"],
        input=f"{username}:{password}\n",
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"chpasswd 실패: {proc.stderr.strip()}")


def reset_container(cfg: dict, gpu_id: int):
    """컨테이너 삭제 후 새로 생성 (흔적 제거)"""
    gpu_cfg = cfg["gpus"][gpu_id]
    container = gpu_cfg["container"]
    device = gpu_cfg["device"]
    host_port = gpu_cfg["host_port"]
    container_port = cfg["docker"]["container_port"]
    image = cfg["docker"]["image"]

    log.info("GPU #%d: 컨테이너 '%s' 리셋 시작", gpu_id, container)

    # 기존 컨테이너 삭제
    subprocess.run(
        ["sudo", "docker", "rm", "-f", container],
        capture_output=True,
        text=True,
    )

    # 새 컨테이너 생성
    proc = subprocess.run(
        [
            "sudo", "docker", "run", "-d",
            "--name", container,
            "--gpus", f"device={device}",
            "-p", f"{host_port}:{container_port}",
            "--restart", "always",
            image,
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"docker run 실패: {proc.stderr.strip()}")

    log.info("GPU #%d: 컨테이너 리셋 완료", gpu_id)


def main():
    cfg_path = sys.argv[1] if len(sys.argv) > 1 else "config.yaml"

    try:
        cfg = load_config(cfg_path)
    except Exception as e:
        log.error("설정 파일 오류: %s", e)
        sys.exit(1)

    log.info("CBGPU Daemon 시작 | poll_interval=%ds", cfg["poll_interval_seconds"])

    # 변경 감지용 in-memory 상태
    known_passwords: dict[int, str] = {}   # gpu_id → 마지막으로 적용한 비밀번호
    reset_done: set[str] = set()           # 이미 리셋 처리한 reservation id

    # 초기 GPU 비밀번호 로드
    try:
        for gpu in fetch_gpus(cfg):
            known_passwords[gpu["id"]] = gpu.get("password") or ""
        log.info("Supabase에서 GPU %d개 로드 완료", len(known_passwords))
    except Exception as e:
        log.warning("초기 로드 실패: %s", e)

    while True:
        time.sleep(cfg["poll_interval_seconds"])
        now = datetime.now(timezone.utc)

        # ── 1. 비밀번호 변경 감지 ──────────────────────────────
        try:
            gpus = fetch_gpus(cfg)
        except Exception as e:
            log.warning("gpus 폴링 오류: %s", e)
            gpus = []

        for gpu in gpus:
            gpu_id: int = gpu["id"]
            password: str = gpu.get("password") or ""

            if not password or known_passwords.get(gpu_id) == password:
                continue

            gpu_cfg = cfg["gpus"].get(gpu_id)
            if not gpu_cfg:
                log.warning("GPU #%d: config에 설정이 없어 건너뜀", gpu_id)
                known_passwords[gpu_id] = password
                continue

            log.info("GPU #%d: 비밀번호 변경 감지 → 컨테이너 '%s'에 적용 중...",
                     gpu_id, gpu_cfg["container"])
            try:
                apply_password(gpu_cfg["container"], gpu_cfg["username"], password)
                log.info("GPU #%d: 비밀번호 적용 완료", gpu_id)
                known_passwords[gpu_id] = password
            except Exception as e:
                log.error("GPU #%d: 비밀번호 적용 실패: %s", gpu_id, e)

        # ── 2. 예약 종료 감지 → 컨테이너 리셋 ────────────────────
        try:
            reservations = fetch_active_reservations(cfg)
        except Exception as e:
            log.warning("reservations 폴링 오류: %s", e)
            reservations = []

        for res in reservations:
            res_id: str = res["id"]
            if res_id in reset_done:
                continue

            end_time = datetime.fromisoformat(res["end_time"].replace("Z", "+00:00"))
            if now <= end_time:
                continue

            # 예약 종료됨
            gpu_id: int = res["gpu_id"]
            gpu_cfg = cfg["gpus"].get(gpu_id)
            if not gpu_cfg:
                reset_done.add(res_id)
                continue

            log.info("GPU #%d: 예약 종료 감지 (reservation %s) → 컨테이너 리셋 시작", gpu_id, res_id)
            try:
                reset_container(cfg, gpu_id)
                reset_done.add(res_id)
                # known_passwords 초기화 (새 컨테이너는 비밀번호 없음)
                known_passwords.pop(gpu_id, None)
            except Exception as e:
                log.error("GPU #%d: 컨테이너 리셋 실패: %s", gpu_id, e)


if __name__ == "__main__":
    main()
