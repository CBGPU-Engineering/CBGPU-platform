# GPU 컨테이너 SSH

`ssh cbgpu@100.100.136.37`은 서버 호스트의 22번 포트에 접속합니다. 예약 GPU에는
`ssh -p 2201 root@100.100.136.37`처럼 GPU 번호별 2201~2204번으로 접속합니다.
Tailscale 네트워크에 연결된 기기에서만 해당 포트에 접근할 수 있습니다.

프로필 페이지에는 사용자의 `ssh-ed25519` **공개키**만 저장합니다. 데몬은 승인된
예약의 시작·종료 시각을 확인해 현재 예약자의 공개키만 해당 GPU 컨테이너의
`authorized_keys`에 넣습니다. 취소 또는 종료 시 컨테이너를 재생성하여 기존 SSH
세션과 컨테이너 안의 변경 사항을 제거합니다. Supabase 연결이 끊겨도 이미 확인한
예약 종료 시각이 지나면 재생성합니다. 컨테이너 안의 `root`는 호스트의 `sudo`나
`systemctl` 권한을 주지 않습니다.

## 서버 적용 순서

1. `FrontEnd/cbgpu/supabase_gpu_ssh_migration.sql`을 Supabase에 적용합니다.
2. 서비스 키를 서버의 `/home/cbgpu/.config/cbgpu/service_role_key`에 0600 권한으로
   저장합니다. Git 또는 브라우저에 넣지 않습니다.
3. `docker build -t cbgpu/gpu-ssh:latest Daemon/gpu_ssh`로 이미지를 만듭니다.
4. `Daemon/daemon.py`와 `Daemon/config.yaml`을 서버의 데몬 경로에 배포하고
   `sudo systemctl restart cbgpu-daemon`을 실행합니다.
5. **현재 사용 중인 GPU 컨테이너는 교체하지 않습니다.** 예약 종료 후 데몬이
   새 이미지와 Tailscale IP에 바인딩된 SSH 포트로 재생성합니다.

SSH 호스트 키는 GPU별로 서버의
`/home/cbgpu/.local/share/cbgpu/gpu-ssh/<GPU 번호>`에 유지합니다. 개인키가
아닌 서버 호스트 키이며, 해당 GPU 컨테이너에 읽기 전용으로 연결됩니다.
