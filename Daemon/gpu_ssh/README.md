# GPU 컨테이너 SSH

2026-10-17 기존 GPU 1~4의 파일과 설치 환경을 이미지로 보존하고 SSH가 포함된
새 컨테이너로 교체했습니다. 원본 컨테이너는
`jupiterhub_gpu<번호>_backup_20261017` 이름으로 중지 상태로 보관합니다.
실행 중이던 커널 프로세스는 새 컨테이너로 이어지지 않습니다.
보존 이미지는 `cbgpu/gpu-ssh-preserved:gpu<번호>-20261017`이며 서버에만
저장합니다. 원본 컨테이너와 보존 이미지에는 사용자 파일과 Jupyter 인증
설정이 들어 있으므로 접근을 제한하고, 이용자 확인 전에는 삭제하지 않습니다.

`ssh cbgpu@100.100.136.37`은 서버 호스트의 22번 포트에 접속합니다. 예약 GPU에는
`ssh -p 2201 root@100.100.136.37`처럼 GPU 번호별 2201~2204번으로 직접
접속하려면 Tailscale 연결이 필요합니다. 외부 예약자는 아래 공개 게이트웨이를
경유하며, Tailscale 네트워크 초대가 필요하지 않습니다.

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

## 초대 없는 외부 SSH 게이트웨이

`gateway/`는 서버의 `127.0.0.1:22220`에서만 대기하는 별도 SSH 서비스입니다.
Tailscale Funnel의 TLS 종료 TCP 10000번 포트만 이 서비스로 연결합니다.
서비스는 매 SSH 인증 및 포트 전달 요청마다 운영 Supabase의 승인된 현재 예약과
등록 공개키를 조회합니다. 데이터베이스 오류, 다른 예약자와 겹친 GPU,
미예약 GPU 포트, 셸 요청은 거부합니다. 연결 중에는 15초마다 권한을 다시
확인하고 예약 종료 또는 취소 시 연결을 닫습니다. 전달 대상은 서버 자신의
Tailscale 주소의 GPU 2201~2204번 포트로 고정됩니다. 호스트 22번 포트와
Jupyter 포트는 이 게이트웨이를 통해 전달하지 않습니다.

서버에는 Go 바이너리를 `/home/cbgpu/.local/bin/cbgpu-ssh-gateway`에 놓고
`gateway/cbgpu-ssh-gateway.service`를 사용자 systemd에 등록합니다. 서비스 롤 키는
기존 `/home/cbgpu/.config/cbgpu/service_role_key` 파일을 읽으며 응답이나 로그에
출력하지 않습니다. SSH 호스트 키는
`/home/cbgpu/.local/share/cbgpu/ssh-gateway/host_ed25519_key`에 0600 권한으로
보관합니다. 최초 운영 키 지문은
`SHA256:f0MfUHiEtvydl+erJ8c79MkiuUDvqdamm1X9jVB+n8k`입니다.

```bash
systemctl --user status cbgpu-ssh-gateway.service
tailscale funnel status
```

외부 사용자는 SSH 설정의 `ProxyCommand`로 OpenSSL TLS를 연결한 뒤
`ProxyJump cbgpu-gateway`를 사용합니다. 웹의 `/dashboard/ssh-guide`에서
설정 예시를 복사할 수 있습니다. 공개 경로는 TLS와 SSH 공개키 인증을 모두
거칩니다. `tailscale funnel --tls-terminated-tcp=10000 off`로 이 공개 경로만
중지할 수 있으며 기존 HTTPS 443·8443 Funnel에는 영향을 주지 않습니다.

2026-10-17 실제 공개 릴레이 주소를 통해 임시 키로 GPU #1 컨테이너에
로그인했습니다. 같은 계정의 GPU #2 접속은 허용되고, 다른 계정이 예약한
GPU #3의 포트 전달은 거부됐습니다. 시험 후 임시 공개키를 DB에서 삭제했고,
게이트웨이와 GPU #1 컨테이너 모두 그 키의 재접속을 거부했습니다.
GPU 컨테이너를 재시작하거나 사용자 파일을 수정하지 않았습니다.

## 학교 LAN 게이트웨이

교내 DNS가 Funnel 주소를 `127.0.0.1`로 응답하거나 교내망에서 공개
`10000`번 포트 연결이 끊기는 경우를 위한 별도 경로입니다. 2026-10-19에
운영 서버에 설치했습니다. 기존 공개 게이트웨이와 별개로
`10.138.23.12:22220`에만 바인딩하며, 동일한 SSH 호스트 키와 Supabase 예약·공개키
검사를 사용합니다. 호스트 셸이나 비밀번호 인증은 제공하지 않습니다.

서버 적용 파일은 `gateway/cbgpu-ssh-gateway-lan.service`입니다. 적용 후에는
`systemctl --user is-active cbgpu-ssh-gateway-lan.service`와
`ss -lnt | grep 10.138.23.12:22220`을 확인했습니다. 서버에서 SSH 호스트 키
지문이 기존 키와 일치하고 미등록 공개키가 거절되는 것도 확인했습니다.
교내 Wi-Fi에 연결된 노트북(`10.138.25.124`)에서도 기존 SSH 설정·키·에이전트와
Tailscale 경로를 사용하지 않는 시험을 했습니다. 물리 Wi-Fi 경로로 TCP와 SSH
호스트 키 교환이 성공하고 미등록 키는 거부됐습니다. **등록 키로 예약 GPU에
로그인하는 종단 간 시험은 아직 하지 않았습니다.** 다른 교내 네트워크 구간의
방화벽 정책까지 이 시험으로 보장할 수 없습니다.

```sshconfig
Host cbgpu-gateway-school
  HostName 10.138.23.12
  Port 22220
  User gateway

Host cbgpu-gpu4-school
  HostName 100.100.136.37
  Port 2204
  User root
  ProxyJump cbgpu-gateway-school
```

교내 PC에는 이 경로를 쓸 때 Tailscale이나 OpenSSL이 필요하지 않습니다.
기존 공개 경로의 설정과 키는 그대로 두고 별칭을 추가합니다. 사용자가
등록한 개인키가 기본 경로 밖에 있다면 두 Host에 `IdentityFile`을 지정합니다.
서비스를 되돌릴 때는 `systemctl --user disable --now
cbgpu-ssh-gateway-lan.service`를 실행합니다. 기존 공개 서비스에는 영향이 없습니다.

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
