#!/bin/bash
# ==============================================================================
# CBGPU integrated install & environment setup script (setup.sh)
# After a fresh Ubuntu 22.04 LTS install on identical hardware (4x Quadro RTX 5000),
# this single script completes the full setup (NVIDIA driver, Docker, CUDA,
# Node.js, Tailscale, the Daemon service, and the FrontEnd build/service).
#
# Usage: sudo bash setup.sh
# ==============================================================================

set -e

# Force English output from apt/dpkg/systemctl/etc., and never block on
# interactive debconf prompts during this unattended provisioning run.
export LANG=C
export LC_ALL=C
export DEBIAN_FRONTEND=noninteractive

# Must run as root
if [ "$EUID" -ne 0 ]; then
  echo "[ERROR] This script must be run with sudo (sudo bash setup.sh)."
  exit 1
fi

# Detect the real invoking user and home directory (for dynamic paths)
REAL_USER="${SUDO_USER:-$USER}"
USER_HOME=$(eval echo "~$REAL_USER")
PROJECT_DIR="$USER_HOME/CBGPU"

echo "================================================================"
echo " Starting CBGPU automated setup."
echo " - Home directory: $USER_HOME"
echo " - Project directory: $PROJECT_DIR"
echo "================================================================"
echo ""

echo "--- Applying lightweight server tuning ---"

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

echo "[OK] Lightweight tuning applied."
echo ""

# 1. System package update and base tools
echo ">>> [1/10] Updating system packages and installing base tools..."
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git build-essential ufw software-properties-common python3 python3-pip python3-venv jq
echo "[OK] Base tools installed."
echo ""

# 2. NVIDIA GPU driver install
echo ">>> [2/10] Installing the NVIDIA GPU driver..."
# Auto-install the recommended driver via ubuntu-drivers
apt-get install -y ubuntu-drivers-common
echo "Attempting automatic install of the recommended NVIDIA driver..."
ubuntu-drivers install
echo "[OK] NVIDIA driver install scheduled. (a reboot is required for it to take effect)"
echo ""

# 3. Docker CE install
echo ">>> [3/10] Installing Docker CE..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm get-docker.sh
fi
# Add the current user to the docker group (usable without sudo after reboot)
usermod -aG docker "$REAL_USER"
systemctl enable docker
systemctl start docker
echo "[OK] Docker installed."
echo ""

# 4. NVIDIA Container Toolkit install (enables Docker GPU access)
echo ">>> [4/10] Installing the NVIDIA Container Toolkit and wiring it into Docker..."
# Register the official GPG key and repository
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

apt-get update
apt-get install -y nvidia-container-toolkit

# Register the NVIDIA toolkit with the Docker runtime and restart
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker
echo "[OK] NVIDIA Container Toolkit configured."
echo ""

# 5. Tailscale install
echo ">>> [5/10] Installing Tailscale VPN..."
if ! command -v tailscale &> /dev/null; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
echo "[OK] Tailscale installed."
echo ""

# 6. Node.js (v22 LTS) install
echo ">>> [6/10] Installing Node.js v22..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "[OK] Node.js: $(node -v) / npm: $(npm -v) installed."
echo ""

# 7. FrontEnd (Next.js) build and env setup
echo ">>> [7/10] Configuring and building the FrontEnd..."
FRONTEND_DIR="$PROJECT_DIR/FrontEnd/cbgpu"

if [ -d "$FRONTEND_DIR" ]; then
  # Auto-generate the Supabase connection file (.env.local) by parsing
  # values out of config.yaml
  CONFIG_YAML="$PROJECT_DIR/Daemon/config.yaml"
  if [ -f "$CONFIG_YAML" ]; then
    SUPABASE_URL=$(python3 -c "import yaml; print(yaml.safe_load(open('$CONFIG_YAML'))['supabase_url'])")
    SUPABASE_ANON_KEY=$(python3 -c "import yaml; print(yaml.safe_load(open('$CONFIG_YAML'))['supabase_anon_key'])")
  else
    # Fallback defaults
    SUPABASE_URL="https://fclbzjlcepoaifvcoxdw.supabase.co/"
    SUPABASE_ANON_KEY="sb_publishable_fgrXxcwq2FC-G4YWzB7Y2A_M93BlQ4X"
  fi

  cat << EOF > "$FRONTEND_DIR/.env.local"
NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
EOF
  chown "$REAL_USER":"$REAL_USER" "$FRONTEND_DIR/.env.local"

  echo "Installing dependencies and building..."
  cd "$FRONTEND_DIR"
  sudo -u "$REAL_USER" npm install
  sudo -u "$REAL_USER" npm run build

  # Create and register the FrontEnd systemd service
  cat << EOF > /etc/systemd/system/cbgpu-frontend.service
[Unit]
Description=CBGPU FrontEnd - Next.js Web App
After=network.target

[Service]
Type=simple
User=$REAL_USER
WorkingDirectory=$FRONTEND_DIR
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable cbgpu-frontend
  systemctl start cbgpu-frontend
  echo "[OK] FrontEnd built and service (cbgpu-frontend) registered."
else
  echo "[WARN] FrontEnd folder not found: $FRONTEND_DIR"
fi
echo ""

# 8. Daemon and Jupyter container initial setup
echo ">>> [8/10] Installing Daemon dependencies, pulling the Jupyter image, and registering the service..."
DAEMON_DIR="$PROJECT_DIR/Daemon"

if [ -d "$DAEMON_DIR" ]; then
  cd "$DAEMON_DIR"

  # Install Python dependencies
  pip3 install -r requirements.txt

  # Create and register the Daemon systemd service
  cat << EOF > /etc/systemd/system/cbgpu-daemon.service
[Unit]
Description=CBGPU Daemon - GPU reservation password manager
After=network.target docker.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 $DAEMON_DIR/daemon.py $DAEMON_DIR/config.yaml
WorkingDirectory=$DAEMON_DIR
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
  echo "[OK] Daemon service (cbgpu-daemon) registered."

  # Pull the Jupyter Docker base image and start the initial 4 containers
  echo "Pulling the Jupyter GPU base image (tensorflow/tensorflow:latest-gpu-jupyter)..."
  docker pull tensorflow/tensorflow:latest-gpu-jupyter || echo "[WARN] Image pull failed (retry once internet access and the GPU driver are in place)"

  echo "Creating and starting the initial 4 jupiterhub GPU containers..."
  # Initial setup for 4 GPUs (assumes 4x RTX 5000)
  for i in {1..4}; do
    device=$((i-1))
    port=$((8000+i))
    container="jupiterhub_gpu$i"

    # Safely remove any existing container before recreating it
    docker rm -f "$container" &>/dev/null || true

    docker run -d \
      --name "$container" \
      --gpus "device=$device" \
      --shm-size "32g" \
      -e "JUPYTER_SKIP_TRASH=yes" \
      -p "$port:8888" \
      --restart always \
      tensorflow/tensorflow:latest-gpu-jupyter || echo "[WARN] Failed to create $container (will work once the GPU driver loads after reboot)"
  done
  echo "[OK] Jupyter containers initialized."
else
  echo "[WARN] Daemon folder not found: $DAEMON_DIR"
fi
echo ""

# 9. First-boot finisher: the NVIDIA driver only becomes active after a
# reboot, so the GPU container creation above likely just failed. Register a
# one-shot systemd service that retries it automatically on every boot until
# it succeeds, then disables itself.
echo ">>> [9/10] Registering the first-boot GPU finisher service..."
FIRST_BOOT_SCRIPT="$PROJECT_DIR/cbgpu-first-boot.sh"

cat << EOF > "$FIRST_BOOT_SCRIPT"
#!/bin/bash
# Auto-generated by setup.sh. Runs at boot to (re)create the GPU containers
# once the NVIDIA driver - only active after a reboot - is actually loaded.
set -e
export LANG=C
export LC_ALL=C

if ! command -v nvidia-smi &> /dev/null || ! nvidia-smi &> /dev/null; then
  echo "[cbgpu-first-boot] NVIDIA driver not active yet, will retry next boot."
  exit 0
fi

echo "[cbgpu-first-boot] NVIDIA driver is active - (re)creating GPU containers."
docker pull tensorflow/tensorflow:latest-gpu-jupyter || true

for i in {1..4}; do
  device=\$((i-1))
  port=\$((8000+i))
  container="jupiterhub_gpu\$i"
  docker rm -f "\$container" &>/dev/null || true
  docker run -d \\
    --name "\$container" \\
    --gpus "device=\$device" \\
    --shm-size "32g" \\
    -e "JUPYTER_SKIP_TRASH=yes" \\
    -p "\$port:8888" \\
    --restart always \\
    tensorflow/tensorflow:latest-gpu-jupyter
done

echo "[cbgpu-first-boot] GPU containers created. Disabling this one-shot service."
systemctl disable cbgpu-first-boot.service
EOF

chmod +x "$FIRST_BOOT_SCRIPT"

cat << EOF > /etc/systemd/system/cbgpu-first-boot.service
[Unit]
Description=CBGPU first-boot finisher (retries GPU container creation until the NVIDIA driver is active)
After=network.target docker.service
Wants=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=$FIRST_BOOT_SCRIPT

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cbgpu-first-boot.service
echo "[OK] First-boot finisher registered (self-disables once GPU containers are created successfully)."
echo ""

# 10. UFW firewall and base network policy
echo ">>> [10/10] Configuring the UFW firewall and network block policy..."
NETWORK_SCRIPT="$PROJECT_DIR/cbgpu-network.sh"
if [ -f "$NETWORK_SCRIPT" ]; then
  chmod +x "$NETWORK_SCRIPT"
  # Apply the default internal-network and Tailscale VPN access rules
  bash "$NETWORK_SCRIPT" internal

  # Enable the firewall
  ufw --force enable
  echo "[OK] ufw firewall enabled and default internal rules applied."
else
  echo "[WARN] Network control script not found: $NETWORK_SCRIPT"
fi
echo ""

# Reclaim disk from the apt cache now that every install is done
apt-get clean
rm -rf /var/lib/apt/lists/*

# 11. Completion notice and reboot recommendation
echo "================================================================"
echo " Setup complete!"
echo "================================================================"
echo " 1. [Required] Reboot the system to activate the NVIDIA driver."
echo "    The cbgpu-first-boot service will then create the GPU"
echo "    containers automatically - no manual step needed."
echo "    Command: sudo reboot"
echo ""
echo " 2. [Required] Finish the Tailscale VPN login by running:"
echo "    Command: sudo tailscale up"
echo ""
echo " 3. Service status commands:"
echo "    - FrontEnd status    : sudo systemctl status cbgpu-frontend"
echo "    - Daemon status      : sudo systemctl status cbgpu-daemon"
echo "    - First-boot finisher: sudo systemctl status cbgpu-first-boot"
echo "    - Network status     : bash $PROJECT_DIR/cbgpu-network.sh status"
echo "================================================================"
