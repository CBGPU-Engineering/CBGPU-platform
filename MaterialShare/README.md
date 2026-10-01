# 자료 공유 파일 API

자료의 제목, 태그, 소유권, 공개 상태는 Supabase `public.shared_materials`에 저장합니다. 파일은 서버의 `/home/cbgpu/cbgpu-materials`에 UUID 파일명으로 저장합니다. 웹은 Supabase 로그인 토큰으로 이 API에 직접 업로드, 다운로드, 삭제를 요청합니다.

## 현재 배포

- 서버: `cbgpu@100.100.136.37`
- Docker 컨테이너: `cbgpu-materials` (`--restart unless-stopped`)
- 서버 내부: `127.0.0.1:8421`
- 공개 HTTPS: `https://cbshoj.taild105d1.ts.net:8443`
- Tailscale Funnel 443번 포트의 기존 서비스는 별도로 유지합니다.

`FrontEnd/cbgpu_app/supabase/materials_migration.sql`을 Supabase 프로젝트에 적용해야 합니다. 웹의 `NEXT_PUBLIC_MATERIALS_API_URL` 환경 변수로 공개 API 주소를 바꿀 수 있습니다. 현재 기본값은 위 HTTPS 주소입니다.

서버의 `/home/cbgpu/cbgpu-materials-api/service.env`에는 Supabase URL, 공개 anon 키, 허용할 웹 Origin, 저장 디렉터리를 둡니다. 이 파일은 Git에 넣지 않습니다. 키가 변경되면 이 파일을 갱신하고 컨테이너를 다시 만들어야 합니다.

```sh
docker build -t cbgpu-materials:latest .
docker run -d --restart unless-stopped --name cbgpu-materials \
  --env-file /home/cbgpu/cbgpu-materials-api/service.env \
  -v /home/cbgpu/cbgpu-materials:/data \
  -p 127.0.0.1:8421:8421 cbgpu-materials:latest
```

상태 확인: `curl https://cbshoj.taild105d1.ts.net:8443/health`. 파일 크기 제한은 200MB입니다. 서비스는 로그인 토큰을 Supabase Auth에 검증하고, 자료 접근 권한은 Supabase RLS로 확인합니다.
