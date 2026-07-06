#!/usr/bin/env python3
"""
CBGPU Daemon

역할:
  1. Supabase gpus 테이블 폴링 → 비밀번호 변경 감지 → 컨테이너 내 계정에 반영
  2. 예약 종료 시간 감지 → 컨테이너 리셋 (흔적 제거 + 접근 차단)
  3. cpu_projects 테이블 폴링 → 승인된 프로젝트 배포 / 재배포 / 삭제 처리

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


def apply_password(container: str, password: str):
    """Jupyter Server/Notebook 환경에 맞게 비밀번호 변경"""
    # 1. 컨테이너 안에서 비밀번호 해시 생성
    hash_script = (
        "try:\n"
        "    from jupyter_server.auth import passwd\n"
        "except ImportError:\n"
        "    from notebook.auth import passwd\n"
        f"print(passwd('{password}'))"
    )
    hash_proc = subprocess.run(
        ["docker", "exec", container, "python3", "-c", hash_script],
        capture_output=True,
        text=True,
    )
    if hash_proc.returncode != 0:
        raise RuntimeError(f"해시 생성 실패: {hash_proc.stderr.strip()}")
    hashed = hash_proc.stdout.strip()
    if not hashed:
        raise RuntimeError("해시 생성 결과가 비어 있습니다")

    # 2. 설정 파일 내용 생성 (ServerApp과 NotebookApp 둘 다 대응)
    # 토큰 로그인을 끄고 비밀번호 로그인을 활성화합니다.
    config_content = (
        f"c.ServerApp.password = '{hashed}'\n"
        f"c.NotebookApp.password = '{hashed}'\n"
        "c.ServerApp.token = ''\n"
        "c.NotebookApp.token = ''"
    )

    # 3. jupyter_server_config.py와 jupyter_notebook_config.py 모두에 저장
    # 쉘의 $ 해석 오류를 막기 위해 파이썬 코드로 안전하게 기록합니다.
    write_script = (
        "import os\n"
        "content = \"\"\"" + config_content + "\"\"\"\n"
        "for cfg_file in ['jupyter_server_config.py', 'jupyter_notebook_config.py']:\n"
        "    path = os.path.join('/root/.jupyter', cfg_file)\n"
        "    os.makedirs('/root/.jupyter', exist_ok=True)\n"
        "    with open(path, 'w') as f:\n"
        "        f.write(content)"
    )
    
    config_proc = subprocess.run(
        ["docker", "exec", container, "python3", "-c", write_script],
        capture_output=True,
        text=True,
    )
    
    if config_proc.returncode != 0:
        raise RuntimeError(f"Config 저장 실패: {config_proc.stderr.strip()}")

    # 4. 컨테이너 재시작하여 설정 적용
    restart_proc = subprocess.run(
        ["docker", "restart", container],
        capture_output=True,
        text=True,
    )
    if restart_proc.returncode != 0:
        raise RuntimeError(f"컨테이너 재시작 실패: {restart_proc.stderr.strip()}")


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
        ["docker","rm", "-f", container],
        capture_output=True,
        text=True,
    )

    # 새 컨테이너 생성 (공유 메모리 32GB 상향)
    proc = subprocess.run(
        [
            "docker","run", "-d",
            "--name", container,
            "--gpus", f"device={device}",
            "--shm-size", "32g",
            "-e", "JUPYTER_SKIP_TRASH=yes",
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


# Git 모드 런타임별 Docker 베이스 이미지
RUNTIME_IMAGES: dict[str, str] = {
    "node20":     "node:20-alpine",
    "node18":     "node:18-alpine",
    "python311":  "python:3.11-slim",
    "python39":   "python:3.9-slim",
}


def fetch_cpu_projects(cfg: dict) -> list[dict]:
    """approved 또는 deleted 상태의 CPU 프로젝트 목록 조회"""
    url = (
        cfg["supabase_url"].rstrip("/")
        + "/rest/v1/cpu_projects?select=*&status=in.(approved,deleted)"
    )
    resp = requests.get(url, headers=supabase_headers(cfg), timeout=10)
    resp.raise_for_status()
    return resp.json()


def update_cpu_deployed_at(cfg: dict, project_id: str):
    """데몬이 배포 완료 후 deployed_at을 현재 시각으로 업데이트"""
    url = cfg["supabase_url"].rstrip("/") + f"/rest/v1/cpu_projects?id=eq.{project_id}"
    now = datetime.now(timezone.utc).isoformat()
    headers = {
        **supabase_headers(cfg),
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    resp = requests.patch(url, headers=headers, json={"deployed_at": now}, timeout=10)
    resp.raise_for_status()


def cpu_container_name(project_id: str) -> str:
    return f"cbcpu_{project_id[:8]}"


def cpu_volume_name(project_id: str) -> str:
    return f"cbcpu_{project_id[:8]}_data"


def apply_firewall(port: int, scope: str, action: str = "allow"):
    """ufw로 포트 접근 규칙 추가/제거. scope: school | public (private는 무시)"""
    if scope == "private":
        return
    try:
        if action == "allow":
            if scope == "school":
                subprocess.run(
                    ["ufw", "allow", "from", "10.138.26.0/24", "to", "any", "port", str(port)],
                    capture_output=True, text=True,
                )
            else:  # public
                subprocess.run(["ufw", "allow", str(port)], capture_output=True, text=True)
        elif action == "delete":
            if scope == "school":
                subprocess.run(
                    ["ufw", "delete", "allow", "from", "10.138.26.0/24", "to", "any", "port", str(port)],
                    capture_output=True, text=True,
                )
            else:
                subprocess.run(["ufw", "delete", "allow", str(port)], capture_output=True, text=True)
    except Exception as e:
        log.warning("방화벽 규칙 적용 실패 (port=%d, scope=%s, action=%s): %s", port, scope, action, e)


def start_cpu_container(project: dict):
    """CPU 프로젝트 컨테이너 시작 (기존 컨테이너가 있으면 먼저 제거)"""
    project_id = project["id"]
    container  = cpu_container_name(project_id)
    host_port  = project["host_port"]
    ctr_port   = project["container_port"]

    # 기존 컨테이너 제거
    subprocess.run(["docker", "rm", "-f", container], capture_output=True, text=True)

    cmd = [
        "docker", "run", "-d",
        "--name", container,
        "--cpus", str(project["cpu_limit"]),
        "-m", str(project["memory_limit"]),
        "-p", f"{host_port}:{ctr_port}",
        "--restart", "unless-stopped",
    ]

    # 환경변수
    for k, v in (project.get("env_vars") or {}).items():
        cmd += ["-e", f"{k}={v}"]

    deploy_type = project.get("deploy_type", "docker")

    if deploy_type == "docker":
        image = project.get("docker_image")
        if not image:
            raise ValueError("docker_image가 비어 있습니다")
        cmd.append(image)

    elif deploy_type == "git":
        git_url    = project.get("git_url", "")
        git_branch = project.get("git_branch") or "main"
        run_cmd    = project.get("run_command") or "npm start"
        runtime    = project.get("runtime") or "node20"
        base_image = RUNTIME_IMAGES.get(runtime, "node:20-alpine")
        volume     = cpu_volume_name(project_id)

        subprocess.run(["docker", "volume", "create", volume], capture_output=True, text=True)

        if "python" in runtime:
            # python:slim 이미지 → apt-get으로 git 설치
            setup = (
                f"apt-get update -qq && apt-get install -y -qq git 2>/dev/null && "
                f"([ -d /app/.git ] || git clone {git_url} /app) && "
                f"cd /app && git fetch && git checkout {git_branch} && git pull && "
                f"([ -f requirements.txt ] && pip install -r requirements.txt -q 2>/dev/null || true) && "
                f"{run_cmd}"
            )
        else:
            # node:alpine 이미지 → apk로 git 설치
            setup = (
                f"apk add --no-cache git 2>/dev/null && "
                f"([ -d /app/.git ] || git clone {git_url} /app) && "
                f"cd /app && git fetch && git checkout {git_branch} && git pull && "
                f"([ -f package.json ] && npm install --silent 2>/dev/null || true) && "
                f"{run_cmd}"
            )

        cmd += ["-v", f"{volume}:/app", base_image, "sh", "-c", setup]

    else:
        raise ValueError(f"알 수 없는 deploy_type: {deploy_type}")

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"docker run 실패: {proc.stderr.strip()}")

    log.info("CPU 프로젝트 '%s' 배포 완료 (container=%s, port=%d)", project.get("name"), container, host_port)


def stop_cpu_container(project: dict):
    """CPU 프로젝트 컨테이너 정지 및 제거 (볼륨은 보존)"""
    container = cpu_container_name(project["id"])
    subprocess.run(["docker", "rm", "-f", container], capture_output=True, text=True)
    log.info("CPU 프로젝트 '%s' 컨테이너 제거 완료 (container=%s)", project.get("name"), container)


def main():
    cfg_path = sys.argv[1] if len(sys.argv) > 1 else "config.yaml"

    try:
        cfg = load_config(cfg_path)
    except Exception as e:
        log.error("설정 파일 오류: %s", e)
        sys.exit(1)

    log.info("CBGPU Daemon 시작 | poll_interval=%ds", cfg["poll_interval_seconds"])

    # 변경 감지용 in-memory 상태
    applied_session_pass: dict[int, str] = {}   # gpu_id → 현재 예약 세션에서 적용된 마지막 비밀번호
    reset_done: set[str] = set()                # 이미 리셋 처리한 reservation id
    cpu_cleaned: set[str] = set()               # 이미 컨테이너를 제거한 deleted 프로젝트 id

    while True:
        time.sleep(cfg["poll_interval_seconds"])
        now = datetime.now(timezone.utc)

        # 1. 데이터 가져오기 (Fail-Safe 적용)
        try:
            gpus_data = {g["id"]: g for g in fetch_gpus(cfg)}
            reservations = fetch_active_reservations(cfg)
        except Exception as e:
            # [중요] 네트워크 오류 시 절대 리셋하거나 비밀번호를 건드리지 않습니다.
            log.warning("Supabase 연결 실패 (네트워크 단절 가능성): %s. 현재 상태를 유지하며 재시도합니다.", e)
            continue

        # 2. 데이터가 텅 비었을 때의 안전 장치
        # 만약 fetch는 성공했으나 예약 목록이 아예 없는 경우(삭제된 경우)에만 리셋 로직을 수행합니다.
        # (Exception이 발생하지 않고 빈 리스트 []가 온 경우에만 아래 로직으로 진행)

        # 현재 활성화된 예약 찾기 (start_time <= now <= end_time)
        active_gpu_ids = set()
        for res in reservations:
            res_id = res["id"]
            gpu_id = res["gpu_id"]
            
            try:
                st = datetime.fromisoformat(res["start_time"].replace("Z", "+00:00"))
                et = datetime.fromisoformat(res["end_time"].replace("Z", "+00:00"))
            except ValueError:
                continue

            # Case A: 현재 사용 중인 예약
            if st <= now <= et:
                active_gpu_ids.add(gpu_id)
                gpu_db = gpus_data.get(gpu_id)
                if not gpu_db: continue
                
                new_password = gpu_db.get("password") or ""
                
                # 비밀번호가 아직 적용되지 않았거나, 중간에 바뀐 경우에만 적용
                if new_password and applied_session_pass.get(gpu_id) != new_password:
                    gpu_cfg = cfg["gpus"].get(gpu_id)
                    if gpu_cfg:
                        log.info("GPU #%d: 예약 시간 내 비밀번호 적용 시도 (Container: %s)", gpu_id, gpu_cfg["container"])
                        try:
                            apply_password(gpu_cfg["container"], new_password)
                            applied_session_pass[gpu_id] = new_password
                            log.info("GPU #%d: 비밀번호 적용 성공", gpu_id)
                        except Exception as e:
                            log.error("GPU #%d: 비밀번호 적용 실패: %s", gpu_id, e)

            # Case B: 예약 종료됨 → 리셋 처리
            elif now > et and res_id not in reset_done:
                gpu_cfg = cfg["gpus"].get(gpu_id)
                if gpu_cfg:
                    log.info("GPU #%d: 예약 종료 감지 (Session: %s) → 리셋 시작", gpu_id, res_id)
                    try:
                        reset_container(cfg, gpu_id)
                        reset_done.add(res_id)
                        applied_session_pass.pop(gpu_id, None) # 해당 GPU 세션 정보 초기화
                    except Exception as e:
                        log.error("GPU #%d: 리셋 실패: %s", gpu_id, e)

        # 3. CPU 프로젝트 배포 처리
        try:
            cpu_projects = fetch_cpu_projects(cfg)
        except Exception as e:
            log.warning("CPU 프로젝트 조회 실패: %s. 현재 상태를 유지합니다.", e)
            cpu_projects = []

        for proj in cpu_projects:
            proj_id = proj["id"]

            # 삭제된 프로젝트 → 컨테이너 제거
            if proj["status"] == "deleted":
                if proj_id not in cpu_cleaned:
                    log.info("CPU 프로젝트 '%s' 삭제 감지 → 컨테이너 제거", proj.get("name"))
                    try:
                        stop_cpu_container(proj)
                        apply_firewall(proj["host_port"], proj.get("access_scope", "private"), "delete")
                        cpu_cleaned.add(proj_id)
                    except Exception as e:
                        log.error("CPU 프로젝트 '%s' 컨테이너 제거 실패: %s", proj.get("name"), e)
                continue

            # 승인된 프로젝트 → 배포 또는 재배포 필요 여부 확인
            deploy_requested = proj.get("deploy_requested_at")
            deployed         = proj.get("deployed_at")

            needs_deploy = deployed is None or (
                deploy_requested is not None and deploy_requested > deployed
            )

            if needs_deploy:
                log.info("CPU 프로젝트 '%s' %s 시작", proj.get("name"), "재배포" if deployed else "최초 배포")
                try:
                    start_cpu_container(proj)
                    apply_firewall(proj["host_port"], proj.get("access_scope", "private"), "allow")
                    update_cpu_deployed_at(cfg, proj_id)
                    cpu_cleaned.discard(proj_id)
                except Exception as e:
                    log.error("CPU 프로젝트 '%s' 배포 실패: %s", proj.get("name"), e)


if __name__ == "__main__":
    main()
