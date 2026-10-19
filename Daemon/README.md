# CBGPU Daemon

GPU 예약 시스템의 서버 데몬입니다.
Supabase를 폴링하여 예약 승인 시 Docker 컨테이너 계정 비밀번호를 자동으로 변경하고,
예약 종료 시 컨테이너를 리셋합니다.

## 설치 (서버에서 실행)

```bash
sudo bash setup.sh
```

한 번만 실행하면 systemd 서비스로 등록되어 서버 재부팅 시에도 자동으로 시작됩니다.

## 설치 전 config.yaml 수정 필요

`setup.sh` 실행 전에 `config.yaml`을 편집하세요:

```bash
nano config.yaml
```

| 항목 | 설명 |
|------|------|
| `supabase_url` | Supabase 프로젝트 URL |
| `supabase_anon_key` | Supabase anon key |
| `auth_method` | `pam` (기본) 또는 `native` |
| `gpus.N.container` | `docker ps`로 확인한 컨테이너 이름 |
| `gpus.N.device` | GPU 디바이스 번호 (0~3) |
| `gpus.N.host_port` | 호스트 포트 (8001~8004) |
| `docker.image` | Docker 이미지 이름 |
| `docker.container_port` | 컨테이너 내부 포트 |
| `docker.school_bind_address` | 교내 전용 CPU 프로젝트를 게시할 서버의 교내망 IPv4 주소 |

## 서비스 관리

CPU 서버 배포 기능은 Supabase 서비스 롤 키가 필요합니다. 서버에서만
`/etc/cbgpu-daemon.env`에 `CBGPU_SUPABASE_SERVICE_ROLE_KEY=<key>`를 저장하고
권한을 `0600`으로 설정한 뒤 `setup.sh`를 다시 실행하거나 systemd 서비스에
`EnvironmentFile=-/etc/cbgpu-daemon.env`를 추가해 재시작하세요. 이 키를
`config.yaml`이나 Git에 넣지 마세요. Docker Git 배포는 컨테이너가 실행되고
저장소 설치가 끝난 뒤에만 `deployed_at`을 기록합니다.
Supabase에는 `Migrations/cpu_projects_deployment_fix.sql`을 적용해 소유자
조회/신청 정책과 승인 상태 보호 트리거를 설치해야 합니다.
교내 전용 CPU 프로젝트는 `docker.school_bind_address`에만 바인딩합니다.
GPU Jupyter 포트는 다음 컨테이너 재생성부터 loopback(호스트의 Cloudflare
터널용), `docker.school_bind_address`(교내 접속용), Tailscale IPv4(기존 VPN
접속용)에만 바인딩합니다. 이 변경은 현재 실행 중인 GPU 컨테이너에는 바로
적용되지 않습니다. 예약 중인 컨테이너를 포트 변경만을 위해 재생성하면 작업과
컨테이너 내부 파일이 사라질 수 있으므로, 예약 종료 시 초기화 또는 별도
보존·복구 절차를 거쳐 적용하세요.
Docker가 게시한 포트는 UFW 규칙을 우회할 수 있으므로, 실제 접근 범위는
서버의 Docker 방화벽 체인과 학교 라우팅 정책도 함께 확인해야 합니다.
서버에 설정된 학교 허용 대역 `10.138.26.0/24`는 다른 교내 대역
`10.138.25.0/24`를 포함하지 않습니다. 실제 허용 대역은 네트워크 담당자의
확인을 거쳐 수정해야 합니다.

웹에서 접속 주소를 표시하려면 `NEXT_PUBLIC_CPU_SERVER_TAILSCALE_HOST`,
`NEXT_PUBLIC_CPU_SERVER_SCHOOL_HOST`, `NEXT_PUBLIC_CPU_SERVER_PUBLIC_HOST`를
배포 환경에 설정할 수 있습니다. Private 프로젝트는 Tailscale 주소에만 바인딩하고,
School/Public 프로젝트는 UFW가 활성화되어 있어야 배포합니다.

2026-10-17 운영 서버에서 임시 Private CPU 프로젝트로 배포, 재배포, 삭제를
검증했습니다. 두 번의 배포에서 새 컨테이너의 `/health`가 HTTP 200을 반환했고,
삭제 후 임시 컨테이너와 프로젝트 레코드가 남지 않았습니다. 검증에는
`cbgpu-materials:latest` 이미지와 Tailscale에만 바인딩한 임시 포트를 사용했습니다.

```bash
# 상태 확인
sudo systemctl status cbgpu-daemon

# 실시간 로그
sudo journalctl -u cbgpu-daemon -f

# 재시작 (config.yaml 수정 후)
sudo systemctl restart cbgpu-daemon

# 중지
sudo systemctl stop cbgpu-daemon
```

## 트러블슈팅

### Supabase 연결 실패 (`failed to establish a new connection`)

Supabase key 문제가 아니라 **DNS 설정 누락**이 원인일 수 있습니다.
ping은 되는데 curl이 안 되면 `/etc/resolv.conf`를 확인하세요.

```bash
cat /etc/resolv.conf
```

DNS를 관리하는 서비스와 적용된 서버를 먼저 확인하세요:

```bash
resolvectl status
resolvectl query fclbzjlcepoaifvcoxdw.supabase.co
```

`/etc/resolv.conf`를 `chattr +i`로 고정하면 NetworkManager·systemd-resolved가
네트워크 변경을 반영하지 못할 수 있습니다. DNS는 해당 네트워크 관리 서비스에서
수정하고, 변경 뒤 Supabase 조회와 데몬 로그를 확인하세요.

---

## 동작 방식

1. **예약 승인 시**: 관리자가 승인하면 프론트엔드에서 랜덤 비밀번호 생성 → Supabase `gpus` 테이블 업데이트
2. **데몬이 감지**: 30초 간격으로 폴링 → 비밀번호 변경 감지
3. **컨테이너에 적용**: `docker exec` 으로 해당 GPU 컨테이너 계정 비밀번호 변경
4. **예약 종료 시**: 종료된 예약 감지 → 컨테이너 삭제 후 새로 생성 (흔적 제거)
