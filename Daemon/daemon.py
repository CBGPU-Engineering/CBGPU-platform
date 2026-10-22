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
import base64
import struct
import ipaddress
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
        key_file = os.environ.get("CBGPU_SUPABASE_SERVICE_ROLE_KEY_FILE", "/home/cbgpu/.config/cbgpu/service_role_key")
        if os.path.exists(key_file):
            with open(key_file, encoding="utf-8") as secret_file:
                key = secret_file.read().strip()
    if not key:
        raise RuntimeError("CBGPU_SUPABASE_SERVICE_ROLE_KEY is not configured")
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def fetch_gpus(cfg: dict) -> list[dict]:
    url = cfg["supabase_url"].rstrip("/") + "/rest/v1/gpus?select=id,password"
    resp = requests.get(url, headers=supabase_headers(cfg), timeout=10)
    resp.raise_for_status()
    return resp.json()


def fetch_active_reservations(cfg: dict) -> list[dict]:
    """Fetch approved reservations, including the owner for SSH key lookup."""
    url = (
        cfg["supabase_url"].rstrip("/")
        + "/rest/v1/reservations?select=id,gpu_id,user_id,start_time,end_time,status&status=eq.approved"
    )
    resp = requests.get(url, headers=cpu_headers(), timeout=10)
    resp.raise_for_status()
    return resp.json()


def validate_public_key(value: str) -> str:
    """Accept only a plain Ed25519 key, never authorized_keys options or commands."""
    fields = value.strip().split()
    if len(fields) < 2 or fields[0] != "ssh-ed25519":
        raise ValueError("Only ssh-ed25519 public keys are supported")
    raw = base64.b64decode(fields[1], validate=True)
    def read_part(offset: int):
        if offset + 4 > len(raw):
            raise ValueError("Invalid public key")
        size = struct.unpack(">I", raw[offset:offset + 4])[0]
        end = offset + 4 + size
        if end > len(raw):
            raise ValueError("Invalid public key")
        return raw[offset + 4:end], end
    algorithm, position = read_part(0)
    public_bytes, position = read_part(position)
    if algorithm != b"ssh-ed25519" or len(public_bytes) != 32 or position != len(raw):
        raise ValueError("Invalid Ed25519 public key")
    return "ssh-ed25519 " + fields[1]


def fetch_ssh_keys(cfg: dict, user_ids: set[str]) -> dict[str, str]:
    if not user_ids:
        return {}
    url = cfg["supabase_url"].rstrip("/") + "/rest/v1/gpu_ssh_keys"
    resp = requests.get(url, headers=cpu_headers(), params={
        "select": "user_id,public_key", "user_id": "in.(" + ",".join(sorted(user_ids)) + ")",
    }, timeout=10)
    resp.raise_for_status()
    keys = {}
    for row in resp.json():
        try:
            keys[row["user_id"]] = validate_public_key(row["public_key"])
        except (ValueError, KeyError) as exc:
            log.warning("Ignoring malformed SSH key for user %s: %s", row.get("user_id"), exc)
    return keys


def write_ssh_keys(container: str, keys: list[str]):
    """Provision keys inside the isolated GPU container, never on the host."""
    script = (
        "import os,sys\n"
        "os.makedirs('/root/.ssh', mode=0o700, exist_ok=True)\n"
        "os.chmod('/root/.ssh', 0o700)\n"
        "fd=os.open('/root/.ssh/authorized_keys', os.O_WRONLY|os.O_CREAT|os.O_TRUNC, 0o600)\n"
        "with os.fdopen(fd, 'w') as f: f.write(sys.stdin.read())\n"
        "os.chmod('/root/.ssh/authorized_keys', 0o600)\n"
    )
    proc = subprocess.run(["docker", "exec", "-i", container, "python3", "-c", script],
                          input="\n".join(keys) + ("\n" if keys else ""), capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip())


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


def has_jupyter_password_config(container: str) -> bool:
    proc = subprocess.run(["docker", "exec", container, "test", "-s", "/root/.jupyter/jupyter_server_config.py"],
                          capture_output=True)
    return proc.returncode == 0


def reset_container(cfg: dict, gpu_id: int):
    """Prepare the replacement before stopping the old container; restore it on failure."""
    gpu_cfg = cfg["gpus"][gpu_id]
    container = gpu_cfg["container"]
    device = gpu_cfg["device"]
    host_port = gpu_cfg["host_port"]
    ssh_port = gpu_cfg.get("ssh_port")
    container_port = cfg["docker"]["container_port"]
    image = cfg["docker"]["image"]
    host_keys_dir = os.path.join(cfg["docker"].get("ssh_host_keys_dir", "/home/cbgpu/.local/share/cbgpu/gpu-ssh"), str(gpu_id))

    if ssh_port:
        os.makedirs(host_keys_dir, mode=0o700, exist_ok=True)
        private_key = os.path.join(host_keys_dir, "ssh_host_ed25519_key")
        if not os.path.exists(private_key):
            keygen = subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", private_key],
                                    capture_output=True, text=True)
            if keygen.returncode != 0:
                raise RuntimeError(f"SSH host key generation failed: {keygen.stderr.strip()}")
            os.chmod(private_key, 0o600)

    log.info("GPU #%d: starting reset of container '%s'", gpu_id, container)

    image_check = subprocess.run(["docker", "image", "inspect", image], capture_output=True, text=True)
    if image_check.returncode != 0:
        raise RuntimeError(f"GPU image is unavailable: {image}")

    suffix = secrets.token_hex(4)
    candidate = f"{container}_next_{suffix}"
    backup = f"{container}_previous_{suffix}"

    # Create without starting: this checks the image/configuration before
    # touching the running container. Ports are allocated only on start.
    run_args = [
            "docker","create",
            "--name", candidate,
            "--gpus", f"device={device}",
            "--shm-size", "32g",
            "-e", "JUPYTER_SKIP_TRASH=yes",
            "--restart", "always",
    ]
    # The host-side Cloudflare tunnels use localhost, school clients use the
    # school NIC, and existing Tailscale clients use the VPN address. Avoid
    # Docker's all-interface binding (including public IPv6).
    for address in dict.fromkeys(("127.0.0.1", school_bind_address(cfg), private_bind_address())):
        run_args.extend(["-p", f"{address}:{host_port}:{container_port}"])
    if ssh_port:
        run_args.extend(["-p", f"{private_bind_address()}:{ssh_port}:22"])
        run_args.extend(["-v", f"{host_keys_dir}:/etc/ssh/hostkeys:ro"])
    run_args.append(image)
    proc = subprocess.run(
        run_args,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"docker create failed: {proc.stderr.strip()}")

    old_renamed = False
    candidate_renamed = False
    old_running = False
    old_stopped = False
    try:
        inspect = subprocess.run(
            ["docker", "inspect", "--format", "{{.State.Running}}", container],
            capture_output=True, text=True,
        )
        if inspect.returncode == 0:
            old_running = inspect.stdout.strip() == "true"
        elif not any(message in inspect.stderr.lower() for message in ("no such object", "no such container")):
            raise RuntimeError(f"Cannot inspect existing container: {inspect.stderr.strip()}")

        if inspect.returncode == 0:
            if old_running:
                stopped = subprocess.run(["docker", "stop", container], capture_output=True, text=True)
                if stopped.returncode != 0:
                    raise RuntimeError(f"Cannot stop existing container: {stopped.stderr.strip()}")
                old_stopped = True
            renamed = subprocess.run(["docker", "rename", container, backup], capture_output=True, text=True)
            if renamed.returncode != 0:
                raise RuntimeError(f"Cannot preserve existing container: {renamed.stderr.strip()}")
            old_renamed = True

        renamed = subprocess.run(["docker", "rename", candidate, container], capture_output=True, text=True)
        if renamed.returncode != 0:
            raise RuntimeError(f"Cannot activate replacement: {renamed.stderr.strip()}")
        candidate_renamed = True
        started = subprocess.run(["docker", "start", container], capture_output=True, text=True)
        if started.returncode != 0:
            raise RuntimeError(f"Cannot start replacement: {started.stderr.strip()}")
        # A successful 'docker start' can still be followed by an immediate exit.
        time.sleep(2)
        running = subprocess.run(["docker", "inspect", "--format", "{{.State.Running}}", container],
                                 capture_output=True, text=True)
        if running.returncode != 0 or running.stdout.strip() != "true":
            raise RuntimeError(f"Replacement exited after start: {running.stderr.strip()}")
    except Exception as exc:
        failed_name = container if candidate_renamed else candidate
        removed = subprocess.run(["docker", "rm", "-f", failed_name], capture_output=True, text=True)
        if removed.returncode != 0:
            log.error("GPU #%d: failed to remove replacement %s: %s", gpu_id, failed_name, removed.stderr.strip())
        if old_renamed:
            restored = subprocess.run(["docker", "rename", backup, container], capture_output=True, text=True)
            if restored.returncode != 0:
                raise RuntimeError(f"{exc}; restore existing container failed: {restored.stderr.strip()}") from exc
        if old_stopped:
            restarted = subprocess.run(["docker", "start", container], capture_output=True, text=True)
            if restarted.returncode != 0:
                raise RuntimeError(f"{exc}; restart existing container failed: {restarted.stderr.strip()}") from exc
        raise

    if old_renamed:
        removed = subprocess.run(["docker", "rm", backup], capture_output=True, text=True)
        if removed.returncode != 0:
            log.warning("GPU #%d: old container preserved as %s: %s", gpu_id, backup, removed.stderr.strip())
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


def cpu_collision_prefixes(projects: list[dict]) -> set[str]:
    """A deleted project must never resolve to another project's container."""
    owners: dict[str, set[str]] = {}
    for project in projects:
        owners.setdefault(project["id"][:8], set()).add(project["id"])
    return {prefix for prefix, ids in owners.items() if len(ids) > 1}


def cpu_container_running(project_id: str) -> bool:
    proc = subprocess.run(
        ["docker", "inspect", "--format", "{{.State.Running}}", cpu_container_name(project_id)],
        capture_output=True, text=True,
    )
    return proc.returncode == 0 and proc.stdout.strip() == "true"


def wait_for_cpu_container(project_id: str, git_mode: bool, timeout_seconds: int = 180):
    """A detached docker run only means Docker accepted the request."""
    container = cpu_container_name(project_id)
    started_at = time.monotonic()
    deadline = started_at + timeout_seconds
    ready_since = None
    while time.monotonic() < deadline:
        state = subprocess.run(
            ["docker", "inspect", "--format", "{{.State.Running}}|{{.RestartCount}}", container],
            capture_output=True, text=True,
        )
        running, _, restart_count = state.stdout.strip().partition("|")
        if state.returncode != 0 or running != "true" or not restart_count.isdigit() or int(restart_count) > 0:
            logs = subprocess.run(["docker", "logs", "--tail", "20", container], capture_output=True, text=True)
            raise RuntimeError(f"CPU container exited or restarted during startup: {logs.stderr[-1000:] or logs.stdout[-1000:]}")
        if git_mode:
            ready = subprocess.run(["docker", "exec", container, "test", "-f", "/tmp/cbgpu-ready"], capture_output=True)
            if ready.returncode == 0:
                if ready_since is None:
                    ready_since = time.monotonic()
                elif time.monotonic() - ready_since >= 3:
                    return
            else:
                ready_since = None
        elif time.monotonic() - started_at < 10:
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


def school_bind_address(cfg: dict) -> str:
    """Bind school projects to the server's school NIC, never every interface."""
    address = cfg["docker"].get("school_bind_address", "")
    try:
        parsed = ipaddress.IPv4Address(address)
    except ipaddress.AddressValueError as exc:
        raise ValueError("docker.school_bind_address must be a private IPv4 address") from exc
    if not parsed.is_private or parsed.is_loopback or parsed.is_unspecified:
        raise ValueError("docker.school_bind_address must be a private IPv4 address")
    return address


def start_cpu_container(project: dict, cfg: dict):
    """Stage a CPU deployment and restore the previous container on failure."""
    project_id = project["id"]
    container  = cpu_container_name(project_id)
    suffix = secrets.token_hex(4)
    candidate = f"{container}_next_{suffix}"
    backup = f"{container}_previous_{suffix}"
    host_port  = project["host_port"]
    ctr_port   = project["container_port"]
    scope = project.get("access_scope", "private")
    if scope == "private":
        bind_address = private_bind_address()
    elif scope == "school":
        bind_address = school_bind_address(cfg)
    elif scope == "public":
        bind_address = "0.0.0.0"
    else:
        raise ValueError(f"Unknown access scope: {scope}")

    old = subprocess.run(["docker", "inspect", "--format", "{{.State.Running}}", container],
                         capture_output=True, text=True)
    if old.returncode != 0 and not any(message in old.stderr.lower() for message in ("no such object", "no such container")):
        raise RuntimeError(f"Cannot inspect existing CPU container: {old.stderr.strip()}")
    old_exists = old.returncode == 0
    old_running = old_exists and old.stdout.strip() == "true"

    cmd = [
        "docker", "create",
        "--name", candidate,
        "--cpus", str(project["cpu_limit"]),
        "-m", str(project["memory_limit"]),
        "-p", f"{bind_address}:{host_port}:{ctr_port}",
        "--restart", "unless-stopped",
    ]

    # Environment variables
    for k, v in (project.get("env_vars") or {}).items():
        cmd += ["-e", f"{k}={v}"]

    deploy_type = project.get("deploy_type", "docker")
    staged_volume = None
    source_volume = None
    base_image = None

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
        volume = cpu_volume_name(project_id)
        if old_exists:
            mount = subprocess.run(
                ["docker", "inspect", "--format", '{{range .Mounts}}{{if eq .Destination "/app"}}{{.Name}}{{end}}{{end}}', container],
                capture_output=True, text=True,
            )
            source_volume = mount.stdout.strip() if mount.returncode == 0 else ""
            if not source_volume:
                raise RuntimeError("Existing Git project has no /app volume; refusing unsafe redeploy")
            staged_volume = f"{volume}_next_{suffix}"
            volume = staged_volume

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
                "cd /app; if [ -f requirements.txt ]; then pip install -r requirements.txt -q; "
                "elif [ -f pyproject.toml ]; then pip install . -q; fi; "
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
        if staged_volume:
            subprocess.run(["docker", "volume", "rm", staged_volume], capture_output=True, text=True)
        raise RuntimeError(f"docker create failed: {proc.stderr.strip()}")

    old_stopped = False
    old_renamed = False
    candidate_renamed = False
    try:
        if old_running:
            stopped = subprocess.run(["docker", "stop", container], capture_output=True, text=True)
            if stopped.returncode != 0:
                raise RuntimeError(f"Cannot stop existing CPU container: {stopped.stderr.strip()}")
            old_stopped = True
        if source_volume:
            copied = subprocess.run(
                ["docker", "run", "--rm", "--network", "none",
                 "-v", f"{source_volume}:/source:ro", "-v", f"{staged_volume}:/target",
                 base_image, "sh", "-c", "cp -a /source/. /target/"],
                capture_output=True, text=True,
            )
            if copied.returncode != 0:
                raise RuntimeError(f"Cannot copy Git project volume: {copied.stderr.strip()}")
        if old_exists:
            renamed = subprocess.run(["docker", "rename", container, backup], capture_output=True, text=True)
            if renamed.returncode != 0:
                raise RuntimeError(f"Cannot preserve existing CPU container: {renamed.stderr.strip()}")
            old_renamed = True
        renamed = subprocess.run(["docker", "rename", candidate, container], capture_output=True, text=True)
        if renamed.returncode != 0:
            raise RuntimeError(f"Cannot activate CPU replacement: {renamed.stderr.strip()}")
        candidate_renamed = True
        started = subprocess.run(["docker", "start", container], capture_output=True, text=True)
        if started.returncode != 0:
            raise RuntimeError(f"Cannot start CPU replacement: {started.stderr.strip()}")
        wait_for_cpu_container(project_id, deploy_type == "git")
    except Exception as exc:
        failed_name = container if candidate_renamed else candidate
        removed = subprocess.run(["docker", "rm", "-f", failed_name], capture_output=True, text=True)
        if removed.returncode != 0:
            log.error("CPU replacement %s cleanup failed: %s", failed_name, removed.stderr.strip())
        if old_renamed:
            restored = subprocess.run(["docker", "rename", backup, container], capture_output=True, text=True)
            if restored.returncode != 0:
                raise RuntimeError(f"{exc}; restore existing CPU container failed: {restored.stderr.strip()}") from exc
        if old_stopped:
            restarted = subprocess.run(["docker", "start", container], capture_output=True, text=True)
            if restarted.returncode != 0:
                raise RuntimeError(f"{exc}; restart existing CPU container failed: {restarted.stderr.strip()}") from exc
        if staged_volume and removed.returncode == 0:
            subprocess.run(["docker", "volume", "rm", staged_volume], capture_output=True, text=True)
        raise

    if old_renamed:
        log.info("CPU project previous container preserved as %s", backup)

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
    reset_done: set[str] | None = None          # initialized from history on first successful fetch
    active_sessions: dict[int, tuple[set[str], datetime]] = {}
    applied_ssh_keys: dict[int, tuple[str, ...]] = {}
    initialized_idle_containers = False
    seeded_running_passwords = False
    cpu_cleaned: set[str] = set()               # deleted project ids whose container was already removed

    while True:
        time.sleep(cfg["poll_interval_seconds"])
        now = datetime.now(timezone.utc)

        # 1. Fetch data (fail-safe)
        try:
            gpus_data = {g["id"]: g for g in fetch_gpus(cfg)}
            reservations = fetch_active_reservations(cfg)
        except Exception as e:
            # A known reservation end is enforced locally even during a network outage.
            for gpu_id, (session_ids, deadline) in list(active_sessions.items()):
                if now >= deadline:
                    try:
                        reset_container(cfg, gpu_id)
                        del active_sessions[gpu_id]
                        if reset_done is not None:
                            reset_done.update(session_ids)
                        applied_session_pass.pop(gpu_id, None)
                        applied_ssh_keys.pop(gpu_id, None)
                    except Exception as reset_error:
                        log.error("GPU #%d: failed to enforce local expiry: %s", gpu_id, reset_error)
            log.warning("Supabase connection failed: %s. Retrying.", e)
            continue

        if reset_done is None:
            # Past reservations must not reset containers merely because the daemon restarted.
            reset_done = {r["id"] for r in reservations
                          if datetime.fromisoformat(r["end_time"].replace("Z", "+00:00")) < now}

        current_sessions: dict[int, list[dict]] = {}
        for reservation in reservations:
            start = datetime.fromisoformat(reservation["start_time"].replace("Z", "+00:00"))
            end = datetime.fromisoformat(reservation["end_time"].replace("Z", "+00:00"))
            if start <= now < end:
                current_sessions.setdefault(reservation["gpu_id"], []).append(reservation)

        if not seeded_running_passwords:
            # The previous daemon already configured these running notebooks. Avoid
            # restarting active training jobs merely because this daemon restarts.
            for gpu_id in current_sessions:
                gpu_cfg = cfg["gpus"].get(gpu_id)
                password = gpus_data.get(gpu_id, {}).get("password")
                if gpu_cfg and password and has_jupyter_password_config(gpu_cfg["container"]):
                    applied_session_pass[gpu_id] = password
            seeded_running_passwords = True

        if not initialized_idle_containers:
            for gpu_id in cfg["gpus"]:
                if gpu_id not in current_sessions:
                    try:
                        reset_container(cfg, gpu_id)
                    except Exception as reset_error:
                        log.error("GPU #%d: failed to initialize idle container: %s", gpu_id, reset_error)
                        continue
            initialized_idle_containers = True

        for gpu_id, (old_ids, _) in list(active_sessions.items()):
            new_ids = {r["id"] for r in current_sessions.get(gpu_id, [])}
            if new_ids != old_ids:
                try:
                    reset_container(cfg, gpu_id)
                    reset_done.update(old_ids)
                    del active_sessions[gpu_id]
                    applied_session_pass.pop(gpu_id, None)
                    applied_ssh_keys.pop(gpu_id, None)
                except Exception as reset_error:
                    log.error("GPU #%d: failed to close previous session: %s", gpu_id, reset_error)
                    current_sessions.pop(gpu_id, None)

        try:
            ssh_keys = fetch_ssh_keys(cfg, {r["user_id"] for group in current_sessions.values() for r in group})
        except Exception as e:
            log.warning("GPU SSH key lookup failed: %s", e)
            ssh_keys = {}

        for gpu_id, group in current_sessions.items():
            active_sessions[gpu_id] = ({r["id"] for r in group},
                                       max(datetime.fromisoformat(r["end_time"].replace("Z", "+00:00")) for r in group))
            owners = {r["user_id"] for r in group}
            if len(owners) > 1:
                log.error("GPU #%d: overlapping reservations have different owners; disabling SSH", gpu_id)
                desired = ()
            else:
                desired = tuple(sorted({ssh_keys[user_id] for user_id in owners if user_id in ssh_keys}))
            if applied_ssh_keys.get(gpu_id) != desired:
                try:
                    write_ssh_keys(cfg["gpus"][gpu_id]["container"], list(desired))
                    applied_ssh_keys[gpu_id] = desired
                except Exception as key_error:
                    log.error("GPU #%d: SSH key provisioning failed: %s", gpu_id, key_error)

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
            elif now > et and res_id not in reset_done and gpu_id not in current_sessions:
                gpu_cfg = cfg["gpus"].get(gpu_id)
                if gpu_cfg:
                    log.info("GPU #%d: reservation end detected (Session: %s) -> starting reset", gpu_id, res_id)
                    try:
                        reset_container(cfg, gpu_id)
                        reset_done.add(res_id)
                        applied_session_pass.pop(gpu_id, None) # Clear session state for this GPU
                        applied_ssh_keys.pop(gpu_id, None)
                    except Exception as e:
                        log.error("GPU #%d: reset failed: %s", gpu_id, e)

        # 3. Handle CPU project deployments
        try:
            cpu_projects = fetch_cpu_projects(cfg)
        except Exception as e:
            log.warning("Failed to fetch CPU projects: %s. Keeping current state.", e)
            cpu_projects = []

        collided_prefixes = cpu_collision_prefixes(cpu_projects)
        for prefix in collided_prefixes:
            log.error("CPU project ID prefix %s belongs to multiple projects; refusing all container actions for that prefix", prefix)

        for proj in cpu_projects:
            proj_id = proj["id"]
            if proj_id[:8] in collided_prefixes:
                continue

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
                    start_cpu_container(proj, cfg)
                    update_cpu_deployed_at(cfg, proj_id)
                    cpu_cleaned.discard(proj_id)
                except Exception as e:
                    log.error("CPU project '%s' deploy failed: %s", proj.get("name"), e)


if __name__ == "__main__":
    main()
