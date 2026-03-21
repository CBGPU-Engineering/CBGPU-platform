#!/bin/bash
# CBGPU Daemon 설치 스크립트
# 실행: sudo bash setup.sh

set -e

echo "=== CBGPU Daemon 설치 시작 ==="

# Python 3 확인
if ! command -v python3 &> /dev/null; then
    echo "[오류] python3가 설치되어 있지 않습니다."
    exit 1
fi
echo "[OK] Python: $(python3 --version)"

# pip 확인
if ! command -v pip3 &> /dev/null; then
    echo "pip3 설치 중..."
    apt-get install -y python3-pip
fi

# 의존성 설치
echo "의존성 설치 중..."
pip3 install -r requirements.txt
echo "[OK] 의존성 설치 완료"

# config.yaml 초기 설정 안내
if grep -q "YOUR_PROJECT" config.yaml; then
    echo ""
    echo "================================================================"
    echo "  config.yaml 설정이 필요합니다!"
    echo "  아래 항목을 채워주세요:"
    echo ""
    echo "  supabase_url      : Supabase 프로젝트 URL"
    echo "  supabase_anon_key : Supabase anon key"
    echo "  gpus              : 각 GPU의 container 이름 확인 (docker ps)"
    echo "================================================================"
    echo ""
fi

# systemd 서비스 등록
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cat > /etc/systemd/system/cbgpu-daemon.service << EOF
[Unit]
Description=CBGPU Daemon - GPU reservation password manager
After=network.target docker.service

[Service]
Type=simple
User=root
ExecStart=python3 ${SCRIPT_DIR}/daemon.py ${SCRIPT_DIR}/config.yaml
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

echo ""
echo "=== 설치 완료 ==="
echo ""
echo "  상태 확인 : sudo systemctl status cbgpu-daemon"
echo "  로그 보기 : sudo journalctl -u cbgpu-daemon -f"
echo "  재시작    : sudo systemctl restart cbgpu-daemon"
echo "  중지      : sudo systemctl stop cbgpu-daemon"
echo ""
