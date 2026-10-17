---
name: cbgpu-gpu-ssh
description: 충북과학고 CBGPU GPU 예약자가 개인 SSH 키로 예약 GPU 컨테이너에 접속하도록 설정하고 문제를 확인할 때 사용한다. 호스트 서버 관리 SSH에는 적용하지 않는다.
---

# CBGPU GPU SSH

예약자의 기기에서 공개키를 만들고 CBGPU 프로필에 등록한 뒤, 승인된 예약 시간에 해당 GPU **컨테이너**로 접속하도록 돕는다.

## 꼭 지킬 점

- 사용자의 **개인키**(`id_ed25519`, `.pem` 등)를 읽거나 채팅·웹사이트·저장소에 올리지 않는다. CBGPU에 등록하는 값은 `ssh-ed25519`로 시작하는 `.pub` 파일 내용뿐이다.
- 이미 있는 키 파일을 덮어쓰지 않는다. 새 키가 필요하면 다른 파일 이름으로 생성한다.
- `ssh cbgpu@100.100.136.37`은 호스트 관리용 22번 포트다. GPU 예약 접속에 이 계정을 사용하거나 호스트 비밀번호를 요청하지 않는다.
- GPU SSH의 `root`는 컨테이너 내부 권한이다. 호스트의 `sudo`, Docker, `systemctl` 권한을 의미하지 않는다.
- 공개 경유지 `cbgpu-gateway`는 포트 전달만 허용한다. 셸 접속이나 다른 서버로의 전달을 시도하지 않는다.
- 인증 오류를 없애려고 SSH 호스트 키 검증을 끄지 않는다. 호스트 키가 갑자기 바뀌었다면 관리자에게 확인한다.

## 설정 절차

1. 사용자의 기기에서 Ed25519 공개키가 있는지 확인한다. 기본 위치는 macOS·Linux에서 `~/.ssh/id_ed25519.pub`, Windows에서 `%USERPROFILE%\.ssh\id_ed25519.pub`다.
2. 키가 없으면 사용자 기기의 터미널 또는 PowerShell에서 `ssh-keygen -t ed25519`를 실행하도록 안내한다. 저장 위치와 암호 문구는 사용자가 정한다. 기존 파일 덮어쓰기 메시지가 나오면 중단한다.
3. 공개키 **한 줄**을 복사한다. macOS: `pbcopy < ~/.ssh/id_ed25519.pub`; Linux: `cat ~/.ssh/id_ed25519.pub`의 출력 복사; Windows PowerShell: `Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub | Set-Clipboard`.
4. 사용자가 로그인한 CBGPU의 `/profile#gpu-ssh-key`에서 공개키를 붙여 넣고 저장한다. 브라우저 조작을 맡았더라도 개인키는 열지 않는다.
5. `openssl version`을 실행해 OpenSSL이 있는지 확인한다. 사용자의 `~/.ssh/config`에 아래 설정을 **추가**한다. Windows는 Git Bash에서 실행한다. 기존 설정을 덮어쓰지 않는다.

   ```sshconfig
   Host cbgpu-gateway
     HostName cbshoj.taild105d1.ts.net
     User gateway
     Port 10000
     ProxyCommand openssl s_client -quiet -verify_return_error -verify_hostname cbshoj.taild105d1.ts.net -connect cbshoj.taild105d1.ts.net:10000 -servername cbshoj.taild105d1.ts.net

   Host cbgpu-gpu1
     HostName 100.100.136.37
     Port 2201
     User root
     ProxyJump cbgpu-gateway

   Host cbgpu-gpu2
     HostName 100.100.136.37
     Port 2202
     User root
     ProxyJump cbgpu-gateway

   Host cbgpu-gpu3
     HostName 100.100.136.37
     Port 2203
     User root
     ProxyJump cbgpu-gateway

   Host cbgpu-gpu4
     HostName 100.100.136.37
     Port 2204
     User root
     ProxyJump cbgpu-gateway
   ```

6. GPU 예약이 **승인**되고 현재 시간이 예약 구간 안인지 확인한 뒤 `ssh cbgpu-gpu1`처럼 예약 GPU 번호의 별칭으로 접속한다. Tailscale 초대는 필요하지 않다. 다른 경로의 키를 사용했다면 게이트웨이와 GPU 설정에 `IdentityFile`을 추가한다. 개인키 내용은 출력하지 않는다.

## 접속되지 않을 때

- 연결 시간 초과: OpenSSL 실행 여부, 공개 경유지 `cbshoj.taild105d1.ts.net:10000` 접속, 예약 시간, 해당 GPU의 SSH 포트 응답을 확인한다.
- 첫 게이트웨이 연결의 호스트 키 지문은 `SHA256:f0MfUHiEtvydl+erJ8c79MkiuUDvqdamm1X9jVB+n8k`다. 다르게 표시되면 접속을 멈춘다.
- `Permission denied (publickey)`: 등록한 `.pub` 키와 로컬에서 사용하는 개인키가 한 쌍인지, 예약이 승인되어 현재 활성 상태인지 확인한다. 데몬 반영에는 약 30초가 걸릴 수 있다.
- SSH 호스트 키 경고: 검증을 건너뛰지 말고 관리자에게 해당 GPU의 호스트 키를 확인한다.

사용자 안내 화면: `/dashboard/ssh-guide`.
