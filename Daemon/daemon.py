#!/usr/bin/env python3
"""
CBGPU Daemon

Responsibilities:
  1. Poll the Supabase gpus table -> detect password changes -> apply them to in-container accounts
  2. Detect reservation end times -> reset containers (wipe traces + block access)
  3. Poll the cpu_projects table -> deploy / redeploy / delete approved projects

Usage: python3 daemon.py [path to config.yaml]
"""

import sys
import time
import logging
import subprocess
import os
import shlex
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
            raise ValueError(f"config is missing or has an empty '{key}'")

    for gpu_id, info in cfg["gpus"].items():
        for field in ("username", "container", "device", "host_port"):
            if not info.get(field) and info.get(field) != 0:
                raise ValueError(f"gpus.{gpu_id} is missing required field '{field}'")

    cfg.setdefault("poll_interval_seconds", 30)
    return cfg


def supabase_headers(cfg: dict) -> dict:
    return {
        "apikey": cfg["supabase_anon_key"],
        "Authorization": f"Bearer {cfg['supabase_anon_key']}",
    }


def cpu_headers() -> dict:
    """CPU deployment writes require a server-only credential, never the public key."""
    key = os.environ.get("CBGPU_SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise RuntimeError("CBGPU_SUPABASE_SERVICE_ROLE_KEY is not configured")
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def fetch_gpus(cfg: dict) -> list[dict]:
    url = cfg["supabase_url"].rstrip("/") + "/rest/v1/gpus?select=id,password"
    resp = requests.get(url, headers=supabase_headers(cfg), timeout=10)
    resp.raise_for_status()
    return resp.json()


def fetch_active_reservations(cfg: dict) -> list[dict]:
    """Fetch reservations with status=approveds"""
    url = (
        cfg["supabase_url"].rstrip("/")
        + "/rest/v1/reservations?select=id,gpu_id,start_time,end_time,status&status=eq.approved"
    )
    resp = requests.get(url, headers=supabase_headers(cfg), timeout=10)
    resp.raise_for_status()
    return resp.json()


def random_password(length: int = 20) -> str:
    """Generate a random lockout password for after a container reset"""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def apply_password(container: str, password: str):
    """Change the password to match the Jupyter Server/Notebook setup"""
    # 1. Generate the password hash inside the container
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
        raise RuntimeError(f"Hash generation failed: {hash_proc.stderr.strip()}")
    hashed = hash_proc.stdout.strip()
    if not hashed:
        raise RuntimeError("Hash generation returned an empty result")

    # 2. Build the config file contents (covers both ServerApp and NotebookApp)
    # Disables token login and enables password login.
    config_content = (
        f"c.ServerApp.password = '{hashed}'\n"
        f"c.NotebookApp.password = '{hashed}'\n"
        "c.ServerApp.token = ''\n"
        "c.NotebookApp.token = ''"
    )

    # 3. Write to both jupyter_server_config.py and jupyter_notebook_config.py
    # Written safely via Python code to avoid shell '$' interpolation errors.
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
        raise RuntimeError(f"Failed to save config: {config_proc.stderr.strip()}")

    # 4. Restart the container to apply the config
    restart_proc = subprocess.run(
        ["docker", "restart", container],
        capture_output=True,
        text=True,
    )
    if restart_proc.returncode != 0:
        raise RuntimeError(f"Failed to restart container: {restart_proc.stderr.strip()}")


def reset_container(cfg: dict, gpu_id: int):
    """Remove and recreate the container (wipe traces)"""
    gpu_cfg = cfg["gpus"][gpu_id]
    container = gpu_cfg["container"]
    device = gpu_cfg["device"]
    host_port = gpu_cfg["host_port"]
    container_port = cfg["docker"]["container_port"]
    image = cfg["docker"]["image"]

    log.info("GPU #%d: starting reset of container '%s'", gpu_id, container)

    # Remove the existing container
    subprocess.run(
        ["docker","rm", "-f", container],
        capture_output=True,
        text=True,
    )

    # Create a new container (shared memory bumped to 32GB)
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
        raise RuntimeError(f"docker run failed: {proc.stderr.strip()}")

    log.info("GPU #%d: container reset complete", gpu_id)


# Docker base image per Git-mode runtime
RUNTIME_IMAGES: dict[str, str] = {
    "node20":     "node:20-alpine",
    "node18":     "node:18-alpine",
    "python311":  "python:3.11-slim",
    "python39":   "python:3.9-slim",
}


def fetch_cpu_projects(cfg: dict) -> list[dict]:
    """Fetch CPU projects with status approved or deleted"""
    url = (
        cfg["supabase_url"].rstrip("/")
        + "/rest/v1/cpu_projects?select=*&status=in.(approved,deleted)"
    )
    resp = requests.get(url, headers=cpu_headers(), timeout=10)
    resp.raise_for_status()
    return resp.json()


def update_cpu_deployed_at(cfg: dict, project_id: str):
    """Update deployed_at to the current time once the daemon finishes deploying"""
    url = cfg["supabase_url"].rstrip("/") + f"/rest/v1/cpu_projects?id=eq.{project_id}"
    now = datetime.now(timezone.utc).isoformat()
    headers = {
        **cpu_headers(),
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    resp = requests.patch(url, headers=headers, json={"deployed_at": now}, timeout=10)
    resp.raise_for_status()
    if len(resp.json()) != 1:
        raise RuntimeError(f"CPU project {project_id} deployment timestamp was not updated")


def cpu_container_name(project_id: str) -> str:
    return f"cbcpu_{project_id[:8]}"


def cpu_volume_name(project_id: str) -> str:
    return f"cbcpu_{project_id[:8]}_data"


def cpu_container_running(project_id: str) -> bool:
    proc = subprocess.run(
        ["docker", "inspect", "--format", "{{.State.Running}}", cpu_container_name(project_id)],
        capture_output=True, text=True,
    )
    return proc.returncode == 0 and proc.stdout.strip() == "true"


def wait_for_cpu_container(project_id: str, git_mode: bool, timeout_seconds: int = 180):
    """A detached docker run only means Docker accepted the request."""
    container = cpu_container_name(project_id)
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if not cpu_container_running(project_id):
            logs = subprocess.run(["docker", "logs", "--tail", "20", container], capture_output=True, text=True)
            raise RuntimeError(f"CPU container exited during startup: {logs.stderr[-1000:] or logs.stdout[-1000:]}")
        if git_mode:
            ready = subprocess.run(["docker", "exec", container, "test", "-f", "/tmp/cbgpu-ready"], capture_output=True)
            if ready.returncode == 0:
                return
        elif time.monotonic() <= deadline - timeout_seconds + 3:
            time.sleep(1)
            continue
        else:
            return
        time.sleep(1)
    raise RuntimeError("CPU container did not finish setup in time")


def apply_firewall(port: int, scope: str, action: str = "allow"):
    """Add/remove a port access rule via ufw. scope: school | public (private is ignored)"""
    if scope == "private":
        return
    if action not in ("allow", "delete"):
        raise ValueError(f"Unknown firewall action: {action}")
    status = subprocess.run(["ufw", "status"], capture_output=True, text=True)
    if status.returncode != 0 or not status.stdout.startswith("Status: active"):
        raise RuntimeError("UFW must be active before school/public CPU ports can be exposed")
    try:
        if action == "allow":
            if scope == "school":
                proc = subprocess.run(
                    ["ufw", "allow", "from", "10.138.26.0/24", "to", "any", "port", str(port)],
                    capture_output=True, text=True,
                )
            else:  # public
                proc = subprocess.run(["ufw", "allow", str(port)], capture_output=True, text=True)
        elif action == "delete":
            if scope == "school":
                proc = subprocess.run(
                    ["ufw", "delete", "allow", "from", "10.138.26.0/24", "to", "any", "port", str(port)],
                    capture_output=True, text=True,
                )
            else:
                proc = subprocess.run(["ufw", "delete", "allow", str(port)], capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip() or proc.stdout.strip())
    except Exception as e:
        raise RuntimeError(f"Failed to apply firewall rule (port={port}, scope={scope}, action={action}): {e}") from e


def private_bind_address() -> str:
    """Prefer the VPN interface; never publish a private project on all NICs."""
    try:
        proc = subprocess.run(["tailscale", "ip", "-4"], capture_output=True, text=True)
    except FileNotFoundError:
        return "127.0.0.1"
    return proc.stdout.strip().splitlines()[0] if proc.returncode == 0 and proc.stdout.strip() else "127.0.0.1"


def start_cpu_container(project: dict):
    """Start a CPU project container (removing any existing container first)"""
    project_id = project["id"]
    container  = cpu_container_name(project_id)
    host_port  = project["host_port"]
    ctr_port   = project["container_port"]

    # Remove the existing container
    subprocess.run(["docker", "rm", "-f", container], capture_output=True, text=True)

    cmd = [
        "docker", "run", "-d",
        "--name", container,
        "--cpus", str(project["cpu_limit"]),
        "-m", str(project["memory_limit"]),
        "-p", f"{private_bind_address() if project.get('access_scope', 'private') == 'private' else '0.0.0.0'}:{host_port}:{ctr_port}",
        "--restart", "unless-stopped",
    ]

    # Environment variables
    for k, v in (project.get("env_vars") or {}).items():
        cmd += ["-e", f"{k}={v}"]

    deploy_type = project.get("deploy_type", "docker")

    if deploy_type == "docker":
        image = project.get("docker_image")
        if not image:
            raise ValueError("docker_image is empty")
        cmd.append(image)

    elif deploy_type == "git":
        git_url    = project.get("git_url", "")
        git_branch = project.get("git_branch") or "main"
        run_cmd    = project.get("run_command") or "npm start"
        runtime    = project.get("runtime") or "node20"
        base_image = RUNTIME_IMAGES.get(runtime, "node:20-alpine")
        volume     = cpu_volume_name(project_id)

        volume_proc = subprocess.run(["docker", "volume", "create", volume], capture_output=True, text=True)
        if volume_proc.returncode != 0:
            raise RuntimeError(f"docker volume create failed: {volume_proc.stderr.strip()}")

        quoted_url = shlex.quote(git_url)
        quoted_branch = shlex.quote(git_branch)
        quoted_run = shlex.quote(run_cmd)

        if "python" in runtime:
            # python:slim image -> install git via apt-get
            setup = (
                "set -e; apt-get update -qq; apt-get install -y -qq git; "
                f"if [ ! -d /app/.git ]; then git clone -- {quoted_url} /app; fi; "
                f"git -C /app remote set-url origin {quoted_url}; "
                f"git -C /app fetch origin {quoted_branch}; git -C /app checkout -B {quoted_branch} FETCH_HEAD; "
                "cd /app; if [ -f requirements.txt ]; then pip install -r requirements.txt -q; fi; "
                f"touch /tmp/cbgpu-ready; exec sh -c {quoted_run}"
            )
        else:
            # node:alpine image -> install git via apk
            setup = (
                "set -e; apk add --no-cache git; "
                f"if [ ! -d /app/.git ]; then git clone -- {quoted_url} /app; fi; "
                f"git -C /app remote set-url origin {quoted_url}; "
                f"git -C /app fetch origin {quoted_branch}; git -C /app checkout -B {quoted_branch} FETCH_HEAD; "
                "cd /app; if [ -f package-lock.json ]; then npm ci; elif [ -f package.json ]; then npm install; fi; "
                f"touch /tmp/cbgpu-ready; exec sh -c {quoted_run}"
            )

        cmd += ["-v", f"{volume}:/app", base_image, "sh", "-c", setup]

    else:
        raise ValueError(f"Unknown deploy_type: {deploy_type}")

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"docker run failed: {proc.stderr.strip()}")

    wait_for_cpu_container(project_id, deploy_type == "git")

    log.info("CPU project '%s' deployed (container=%s, port=%d)", project.get("name"), container, host_port)


def stop_cpu_container(project: dict):
    """Stop and remove a CPU project container (volume is preserved)"""
    container = cpu_container_name(project["id"])
    proc = subprocess.run(["docker", "rm", "-f", container], capture_output=True, text=True)
    if proc.returncode != 0 and "No such container" not in proc.stderr:
        raise RuntimeError(f"docker rm failed: {proc.stderr.strip()}")
    log.info("CPU project '%s' container removed (container=%s)", project.get("name"), container)


def main():
    cfg_path = sys.argv[1] if len(sys.argv) > 1 else "config.yaml"

    try:
        cfg = load_config(cfg_path)
    except Exception as e:
        log.error("Config file error: %s", e)
        sys.exit(1)

    log.info("CBGPU Daemon started | poll_interval=%ds", cfg["poll_interval_seconds"])

    # In-memory state for change detection
    applied_session_pass: dict[int, str] = {}   # gpu_id -> last password applied in the current reservation session
    reset_done: set[str] = set()                # reservation ids already reset
    cpu_cleaned: set[str] = set()               # deleted project ids whose container was already removed

    while True:
        time.sleep(cfg["poll_interval_seconds"])
        now = datetime.now(timezone.utc)

        # 1. Fetch data (fail-safe)
        try:
            gpus_data = {g["id"]: g for g in fetch_gpus(cfg)}
            reservations = fetch_active_reservations(cfg)
        except Exception as e:
            # [Important] Never reset or touch passwords on a network error.
            log.warning("Supabase connection failed (possible network outage): %s. Keeping current state and retrying.", e)
            continue

        # 2. Safeguard for empty data
        # Reset logic only runs when the fetch succeeds but the reservation list is genuinely empty (i.e. deleted).
        # (Proceeds below only when no exception was raised and an empty list [] was returned.)

        # Find reservations that are currently active (start_time <= now <= end_time)
        active_gpu_ids = set()
        for res in reservations:
            res_id = res["id"]
            gpu_id = res["gpu_id"]

            try:
                st = datetime.fromisoformat(res["start_time"].replace("Z", "+00:00"))
                et = datetime.fromisoformat(res["end_time"].replace("Z", "+00:00"))
            except ValueError:
                continue

            # Case A: reservation currently in use
            if st <= now <= et:
                active_gpu_ids.add(gpu_id)
                gpu_db = gpus_data.get(gpu_id)
                if not gpu_db: continue

                new_password = gpu_db.get("password") or ""

                # Only apply if the password hasn't been applied yet, or changed mid-session
                if new_password and applied_session_pass.get(gpu_id) != new_password:
                    gpu_cfg = cfg["gpus"].get(gpu_id)
                    if gpu_cfg:
                        log.info("GPU #%d: attempting to apply password within reservation window (Container: %s)", gpu_id, gpu_cfg["container"])
                        try:
                            apply_password(gpu_cfg["container"], new_password)
                            applied_session_pass[gpu_id] = new_password
                            log.info("GPU #%d: password applied successfully", gpu_id)
                        except Exception as e:
                            log.error("GPU #%d: failed to apply password: %s", gpu_id, e)

            # Case B: reservation ended -> reset
            elif now > et and res_id not in reset_done:
                gpu_cfg = cfg["gpus"].get(gpu_id)
                if gpu_cfg:
                    log.info("GPU #%d: reservation end detected (Session: %s) -> starting reset", gpu_id, res_id)
                    try:
                        reset_container(cfg, gpu_id)
                        reset_done.add(res_id)
                        applied_session_pass.pop(gpu_id, None) # Clear session state for this GPU
                    except Exception as e:
                        log.error("GPU #%d: reset failed: %s", gpu_id, e)

        # 3. Handle CPU project deployments
        try:
            cpu_projects = fetch_cpu_projects(cfg)
        except Exception as e:
            log.warning("Failed to fetch CPU projects: %s. Keeping current state.", e)
            cpu_projects = []

        for proj in cpu_projects:
            proj_id = proj["id"]

            # Deleted project -> remove container
            if proj["status"] == "deleted":
                if proj_id not in cpu_cleaned:
                    log.info("CPU project '%s' deletion detected -> removing container", proj.get("name"))
                    try:
                        stop_cpu_container(proj)
                        apply_firewall(proj["host_port"], proj.get("access_scope", "private"), "delete")
                        cpu_cleaned.add(proj_id)
                    except Exception as e:
                        log.error("CPU project '%s' container removal failed: %s", proj.get("name"), e)
                continue

            # Approved project -> check whether it needs a deploy or redeploy
            deploy_requested = proj.get("deploy_requested_at")
            deployed         = proj.get("deployed_at")

            needs_deploy = not cpu_container_running(proj_id) or deployed is None or (
                deploy_requested is not None and deploy_requested > deployed
            )

            if needs_deploy:
                log.info("CPU project '%s' starting %s", proj.get("name"), "redeploy" if deployed else "initial deploy")
                try:
                    apply_firewall(proj["host_port"], proj.get("access_scope", "private"), "allow")
                    start_cpu_container(proj)
                    update_cpu_deployed_at(cfg, proj_id)
                    cpu_cleaned.discard(proj_id)
                except Exception as e:
                    log.error("CPU project '%s' deploy failed: %s", proj.get("name"), e)


if __name__ == "__main__":
    main()
