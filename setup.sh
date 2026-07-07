#!/bin/bash
# ==============================================================================
# CBGPU 통합 설치 및 환경 구성 스크립트 (setup.sh)
# 동일 하드웨어(4x Quadro RTX 5000)를 사용하는 Ubuntu 22.04 LTS PC 초기화 후
# 본 스크립트 하나로 모든 세팅(NVIDIA Driver, Docker, CUDA, Node.js, Tailscale,
# Daemon 서비스 및 FrontEnd 빌드/서비스 등록)을 완료합니다.
#
# 실행 방법: sudo bash setup.sh
# ==============================================================================

set -e

# 루트 권한 확인
if [ "$EUID" -ne 0 ]; then
  echo "[오류] 이 스크립트는 반드시 sudo 권한으로 실행해야 합니다 (sudo bash setup.sh)."
  exit 1
fi

# 실제 실행 사용자 및 홈 디렉토리 감지 (동적 경로 설정)
REAL_USER="${SUDO_USER:-$USER}"
USER_HOME=$(eval echo "~$REAL_USER")
PROJECT_DIR="$USER_HOME/CBGPU"

echo "================================================================"
echo " CBGPU 자동 셋업을 시작합니다."
echo " - 실행 계정: $REAL_USER"
echo " - 홈 디렉토리: $USER_HOME"
echo " - 프로젝트 디렉토리: $PROJECT_DIR"
echo "================================================================"
echo ""

# 1. 시스템 패키지 업데이트 및 기본 도구 설치
echo ">>> [1/9] 시스템 패키지 업데이트 및 필수 도구 설치 중..."
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git build-essential ufw software-properties-common python3 python3-pip python3-venv jq
echo "[OK] 필수 도구 설치 완료."
echo ""

# 2. NVIDIA GPU 드라이버 설치
echo ">>> [2/9] NVIDIA GPU 드라이버 설치 중..."
# ubuntu-drivers를 통한 자동 추천 드라이버 설치 진행
apt-get install -y ubuntu-drivers-common
echo "추천 NVIDIA 드라이버 자동 설치를 시도합니다..."
ubuntu-drivers install
echo "[OK] NVIDIA 드라이버 설치가 예약되었습니다. (적용을 위해 나중에 재부팅 필요)"
echo ""

# 3. Docker CE 설치
echo ">>> [3/9] Docker CE 설치 중..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm get-docker.sh
fi
# 현재 사용자를 docker 그룹에 추가 (재부팅 후 sudo 없이 사용 가능)
usermod -aG docker "$REAL_USER"
systemctl enable docker
systemctl start docker
echo "[OK] Docker 설치 완료."
echo ""

# 4. NVIDIA Container Toolkit 설치 (Docker GPU 사용 설정)
echo ">>> [4/9] NVIDIA Container Toolkit 설치 및 Docker 연동 설정 중..."
# 공식 GPG 키 및 저장소 등록
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

apt-get update
apt-get install -y nvidia-container-toolkit

# Docker 런타임에 NVIDIA Toolkit 등록 및 재시작
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker
echo "[OK] NVIDIA Container Toolkit 설정 완료."
echo ""

# 5. Tailscale 설치
echo ">>> [5/9] Tailscale VPN 설치 중..."
if ! command -v tailscale &> /dev/null; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
echo "[OK] Tailscale 설치 완료."
echo ""

# 6. Node.js (v22 LTS) 설치
echo ">>> [6/9] Node.js v22 설치 중..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "[OK] Node.js: $(node -v) / npm: $(npm -v) 설치 완료."
echo ""

# 7. FrontEnd (Next.js) 빌드 및 환경변수 설정
echo ">>> [7/9] FrontEnd 설정 및 빌드 중..."
FRONTEND_DIR="$PROJECT_DIR/FrontEnd/cbgpu"

if [ -d "$FRONTEND_DIR" ]; then
  # Supabase 연결 설정 파일 (.env.local) 자동 생성
  # config.yaml의 값을 파싱하여 자동으로 생성
  CONFIG_YAML="$PROJECT_DIR/Daemon/config.yaml"
  if [ -f "$CONFIG_YAML" ]; then
    SUPABASE_URL=$(python3 -c "import yaml; print(yaml.safe_load(open('$CONFIG_YAML'))['supabase_url'])")
    SUPABASE_ANON_KEY=$(python3 -c "import yaml; print(yaml.safe_load(open('$CONFIG_YAML'))['supabase_anon_key'])")
  else
    # 기본값 백업
    SUPABASE_URL="https://fclbzjlcepoaifvcoxdw.supabase.co/"
    SUPABASE_ANON_KEY="sb_publishable_fgrXxcwq2FC-G4YWzB7Y2A_M93BlQ4X"
  fi

  cat << EOF > "$FRONTEND_DIR/.env.local"
NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
EOF
  chown "$REAL_USER":"$REAL_USER" "$FRONTEND_DIR/.env.local"

  echo "의존성 패키지 설치 및 빌드 진행..."
  cd "$FRONTEND_DIR"
  sudo -u "$REAL_USER" npm install
  sudo -u "$REAL_USER" npm run build

  # FrontEnd systemd 서비스 생성 및 등록
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
  echo "[OK] FrontEnd 빌드 및 서비스(cbgpu-frontend) 등록 완료."
else
  echo "[경고] FrontEnd 폴더를 찾을 수 없습니다: $FRONTEND_DIR"
fi
echo ""

# 8. Daemon 및 Jupyter 컨테이너 초기 설정
echo ">>> [8/9] Daemon 의존성 설치, Jupyter 이미지 풀링 및 서비스 등록 중..."
DAEMON_DIR="$PROJECT_DIR/Daemon"

if [ -d "$DAEMON_DIR" ]; then
  cd "$DAEMON_DIR"
  
  # Python 라이브러리 설치
  pip3 install -r requirements.txt

  # Daemon systemd 서비스 생성 및 등록
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
  echo "[OK] Daemon 서비스(cbgpu-daemon) 등록 완료."

  # Jupyter Docker 베이스 이미지 다운로드 및 초기 컨테이너 4대 기동
  echo "Jupyter GPU 베이스 이미지 다운로드 중 (tensorflow/tensorflow:latest-gpu-jupyter)..."
  docker pull tensorflow/tensorflow:latest-gpu-jupyter || echo "[경고] 이미지 다운로드 실패 (인터넷 상태 및 GPU 드라이버 설치 후 진행 요망)"

  echo "초기 jupiterhub GPU 컨테이너 4대 생성 및 기동 중..."
  # GPU 4대 초기 설정 (RTX 5000 4대 기준)
  for i in {1..4}; do
    device=$((i-1))
    port=$((8000+i))
    container="jupiterhub_gpu$i"
    
    # 기존 컨테이너가 있으면 안전하게 제거 후 재생성
    docker rm -f "$container" &>/dev/null || true
    
    docker run -d \
      --name "$container" \
      --gpus "device=$device" \
      --shm-size "32g" \
      -e "JUPYTER_SKIP_TRASH=yes" \
      -p "$port:8888" \
      --restart always \
      tensorflow/tensorflow:latest-gpu-jupyter || echo "[경고] $container 컨테이너 생성 실패 (재부팅 후 GPU 드라이버가 로드되면 정상 실행됩니다)"
  done
  echo "[OK] Jupyter 컨테이너 초기화 완료."
else
  echo "[경고] Daemon 폴더를 찾을 수 없습니다: $DAEMON_DIR"
fi
echo ""

# 9. UFW 방화벽 및 네트워크 기본 설정
echo ">>> [9/9] UFW 방화벽 및 네트워크 차단 정책 설정 중..."
NETWORK_SCRIPT="$PROJECT_DIR/cbgpu-network.sh"
if [ -f "$NETWORK_SCRIPT" ]; then
  chmod +x "$NETWORK_SCRIPT"
  # 내부망 및 테일스케일 VPN 접근 규칙 기본 적용
  bash "$NETWORK_SCRIPT" internal
  
  # 방화벽 활성화
  ufw --force enable
  echo "[OK] ufw 방화벽 활성화 및 internal 규칙 기본 적용 완료."
else
  echo "[경고] 네트워크 제어 스크립트를 찾을 수 없습니다: $NETWORK_SCRIPT"
fi
echo ""

# 10. 완료 안내 및 재부팅 권고
echo "================================================================"
echo " 셋업이 완료되었습니다!"
echo "================================================================"
echo " 1. [필수] NVIDIA 드라이버 활성화 및 Docker 연동을 완료하기 위해"
echo "    시스템을 반드시 재부팅해 주시기 바랍니다."
echo "    명령어: sudo reboot"
echo ""
echo " 2. [필수] VPN 연동을 위해 아래 명령어를 실행하여 Tailscale 로그인을 마쳐주세요."
echo "    명령어: sudo tailscale up"
echo ""
echo " 3. 서비스 상태 확인 명령어:"
echo "    - FrontEnd 상태 : sudo systemctl status cbgpu-frontend"
echo "    - Daemon 상태   : sudo systemctl status cbgpu-daemon"
echo "    - 네트워크 상태 : bash $PROJECT_DIR/cbgpu-network.sh status"
echo "================================================================"
