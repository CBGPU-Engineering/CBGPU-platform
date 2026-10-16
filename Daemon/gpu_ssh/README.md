# GPU 컨테이너 SSH

2026-10-17 기존 GPU 1~4의 파일과 설치 환경을 이미지로 보존하고 SSH가 포함된
새 컨테이너로 교체했습니다. 원본 컨테이너는
`jupiterhub_gpu<번호>_backup_20261017` 이름으로 중지 상태로 보관합니다.
실행 중이던 커널 프로세스는 새 컨테이너로 이어지지 않습니다.
보존 이미지는 `cbgpu/gpu-ssh-preserved:gpu<번호>-20261017`이며 서버에만
저장합니다. 원본 컨테이너와 보존 이미지에는 사용자 파일과 Jupyter 인증
설정이 들어 있으므로 접근을 제한하고, 이용자 확인 전에는 삭제하지 않습니다.

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
5. 기존 예약의 파일과 설치 환경을 유지해야 할 때는 컨테이너별 이미지를
   `docker commit`으로 만든 뒤 새 컨테이너를 구성합니다. 이때 원본 컨테이너는
   삭제하지 않고 이름을 바꿔 중지 상태로 보관합니다. 새 컨테이너는 Jupyter
   포트와 SSH 포트를 직접 게시하며, 다음 예약 초기화부터는 데몬이 표준
   `cbgpu/gpu-ssh:latest` 이미지로 재생성합니다.

SSH 호스트 키는 GPU별로 서버의
`/home/cbgpu/.local/share/cbgpu/gpu-ssh/<GPU 번호>`에 유지합니다. 개인키가
아닌 서버 호스트 키이며, 해당 GPU 컨테이너에 읽기 전용으로 연결됩니다.

## 호스트 SSH 인증 정책

2026-10-15부터 호스트의 22번 포트는 기본적으로 공개키 인증만 허용합니다.
`/etc/ssh/sshd_config.d/40-cbgpu-auth.conf`에 `PasswordAuthentication no`를
두고, `/etc/ssh/sshd_config` 끝의 `Match LocalAddress 10.138.23.12`에서
학교 LAN 주소로 접속한 경우에만 비밀번호 인증을 허용합니다. 따라서
Tailscale 주소 `100.100.136.37`과 Tailscale IPv6 주소는 공개키 전용입니다.
이 설정은 GPU 컨테이너 SSH 포트 2201~2204에는 영향을 주지 않습니다.

적용 전 설정은 `/etc/ssh/sshd_config.bak-cbgpu-20261015`에 보관했습니다.
LAN 주소가 바뀌면 `Match LocalAddress`도 수정한 후 `sshd -t`로 검사하고
SSH 서비스를 다시 읽혀야 합니다. 이 정책은 서버가 받은 **목적지 주소**를
구분하므로, 학교 LAN 주소가 다른 네트워크로 라우팅되거나 포워딩되는 경우에는
그 경로에서도 비밀번호 인증이 허용됩니다.
