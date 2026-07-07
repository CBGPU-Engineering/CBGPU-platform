#!/bin/bash
# CBGPU Daemon installer for Ubuntu servers
# Usage: sudo bash setup.sh

set -e

# Force English output from apt/dpkg/systemctl/etc. This server may not have
# the Korean locale installed at all, so letting locale-aware tools emit
# anything but plain C/English output risks garbled text in the logs.
export LANG=C
export LC_ALL=C

echo "=== CBGPU Daemon setup starting ==="

# Must run as root (writes to /etc/systemd/system and installs apt packages)
if [ "$(id -u)" -ne 0 ]; then
    echo "[ERROR] This script must be run as root: sudo bash setup.sh"
    exit 1
fi

# Warn (but don't abort) if this isn't Ubuntu
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [ "$ID" != "ubuntu" ]; then
        echo "[WARN] This script targets Ubuntu; detected OS: ${PRETTY_NAME:-$ID}. Continuing anyway."
    fi
else
    echo "[WARN] Could not detect the OS (/etc/os-release missing). Continuing anyway."
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/venv"

echo "--- Applying lightweight server tuning ---"

# Never block on interactive dpkg/debconf prompts (e.g. config-file diffs,
# grub/openssh prompts on a headless box).
export DEBIAN_FRONTEND=noninteractive

# Keep installs lean: skip recommended/suggested packages this box doesn't need
cat > /etc/apt/apt.conf.d/99-cbgpu-no-recommends << 'EOF'
APT::Install-Recommends "false";
APT::Install-Suggests "false";
EOF

# Skip installing man pages/docs (saves disk and install time on a headless server)
cat > /etc/dpkg/dpkg.cfg.d/01-cbgpu-nodoc << 'EOF'
path-exclude=/usr/share/doc/*
path-exclude=/usr/share/man/*
path-exclude=/usr/share/groff/*
path-exclude=/usr/share/info/*
path-include=/usr/share/doc/*/copyright
EOF

# Disable background services this dedicated GPU box doesn't need:
# automatic update timers, the "message of the day" news fetcher, and snapd
# (a security tradeoff for a leaner footprint - re-enable if you rely on
# unattended-upgrades or snap packages).
for svc in apt-daily.timer apt-daily-upgrade.timer unattended-upgrades.service motd-news.timer snapd.socket snapd.service; do
    systemctl disable --now "$svc" &> /dev/null || true
done

echo "[OK] Lightweight tuning applied"

echo "Updating apt package index..."
apt-get update -qq

# Python 3
if ! command -v python3 &> /dev/null; then
    echo "Installing python3..."
    apt-get install -y python3
fi
echo "[OK] Python: $(python3 --version)"

# venv module (needed below to sidestep Ubuntu's PEP 668
# "externally-managed-environment" restriction on system-wide pip installs)
if ! python3 -c "import venv" &> /dev/null; then
    echo "Installing python3-venv..."
    apt-get install -y python3-venv
fi

# Create (or reuse) a dedicated virtualenv for the daemon's dependencies
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtualenv at ${VENV_DIR}..."
    python3 -m venv "$VENV_DIR"
fi

echo "Installing dependencies..."
"${VENV_DIR}/bin/pip" install -q --upgrade pip
"${VENV_DIR}/bin/pip" install -q -r "${SCRIPT_DIR}/requirements.txt"
echo "[OK] Dependencies installed"

# Nudge the user to fill in config.yaml before first run
if grep -q "YOUR_PROJECT" "${SCRIPT_DIR}/config.yaml" 2>/dev/null; then
    echo ""
    echo "================================================================"
    echo "  config.yaml needs to be configured!"
    echo "  Please fill in the following fields:"
    echo ""
    echo "  supabase_url      : Supabase project URL"
    echo "  supabase_anon_key : Supabase anon key"
    echo "  gpus              : each GPU's container name (check via docker ps)"
    echo "================================================================"
    echo ""
fi

# The daemon shells out to `docker`; install Docker Engine if it's missing
if ! command -v docker &> /dev/null; then
    echo "Installing Docker Engine..."
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    . /etc/os-release
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
        ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list

    apt-get update -qq
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
    echo "[OK] Docker installed: $(docker --version)"
else
    echo "[OK] Docker: $(docker --version)"
fi

# GPU containers need the NVIDIA Container Toolkit (adds `docker run --gpus`).
# Only attempt this if an NVIDIA driver is already present - installing the
# driver itself is out of scope here (it usually needs a reboot).
if command -v nvidia-smi &> /dev/null; then
    if ! dpkg -l | grep -q nvidia-container-toolkit; then
        echo "NVIDIA GPU detected - installing NVIDIA Container Toolkit..."
        curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
            | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
        curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
            | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
            > /etc/apt/sources.list.d/nvidia-container-toolkit.list

        apt-get update -qq
        apt-get install -y nvidia-container-toolkit
        nvidia-ctk runtime configure --runtime=docker
        systemctl restart docker
        echo "[OK] NVIDIA Container Toolkit installed"
    else
        echo "[OK] NVIDIA Container Toolkit already installed"
    fi
else
    echo "[WARN] nvidia-smi not found - no NVIDIA driver detected on this host."
    echo "       Install the NVIDIA driver first if this server has GPUs; the daemon's"
    echo "       'docker run --gpus' calls will fail without it."
fi

# Register the systemd service
cat > /etc/systemd/system/cbgpu-daemon.service << EOF
[Unit]
Description=CBGPU Daemon - GPU reservation password manager
After=network.target docker.service

[Service]
Type=simple
User=root
ExecStart=${VENV_DIR}/bin/python3 ${SCRIPT_DIR}/daemon.py ${SCRIPT_DIR}/config.yaml
WorkingDirectory=${SCRIPT_DIR}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cbgpu-daemon
systemctl start cbgpu-daemon

# Reclaim disk from the apt cache now that every install is done
apt-get clean
rm -rf /var/lib/apt/lists/*

echo ""
echo "=== Setup complete ==="
echo ""
echo "  Check status : sudo systemctl status cbgpu-daemon"
echo "  View logs    : sudo journalctl -u cbgpu-daemon -f"
echo "  Restart      : sudo systemctl restart cbgpu-daemon"
echo "  Stop         : sudo systemctl stop cbgpu-daemon"
echo ""
