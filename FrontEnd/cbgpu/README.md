# CBGPU web

서비스 주소, 현재 화면 캡처, 전체 구조와 설치 안내는 [루트 README](../../README.md)를 참고하세요.

Next.js 16 / React 19 기반의 사용자 웹, 모바일 웹, Docs, arXiv와 API입니다. 호스트에 따라 워크스페이스를 선택하며, 운영자 화면은 별도의 인증 게이트웨이를 사용합니다.

```bash
npm ci
cp .env.example .env.local
# 개발 환경 변수 입력
npm run dev
```

`npm run build`는 문서 기능 누락 검사와 프로덕션 빌드를 실행합니다. 환경 파일, `.next-*` 릴리스와 실제 운영 비밀키는 Git에 포함하지 않습니다.

## 현재 운영 방식

자체 호스팅 백엔드는 `/backend`로 연결하고 자료 공유는 `/api/files`를 통해 프록시합니다. 프로덕션의 실제 빌드 경로는 systemd 프론트엔드 서비스의 `NEXT_BUILD_DIR`로 지정합니다. Vercel 배포는 현재 기본 호스팅 방식이 아닙니다.


## 기존 기능의 AI 보조 설정

기존 화면 안에서 AI가 동작합니다. 홈의 오늘 브리핑, 학교·기술 뉴스 제목 흐름, 시간표의 복습 힌트, 연구노트와 스터디 모집글의 추천 태그, 투표 결과의 한 줄 경향을 제공합니다. 기존 화면은 AI 응답을 기다리지 않습니다. 홈·뉴스·시간표 결과는 브라우저에 24시간 캐시됩니다. 서버 환경변수 `NVIDIA_API_KEY`에 NVIDIA NIM API 키를 설정해야 작동합니다. 브라우저에 노출되는 `NEXT_PUBLIC_` 접두어를 붙이지 마세요. 배포 시 프론트엔드 서버의 비공개 환경 설정에도 키를 등록해야 합니다.

기본 모델은 병렬 토큰 생성에 최적화된 `google/diffusiongemma-26b-a4b-it`이며 출력을 128토큰으로 제한합니다. NVIDIA 무료 추론 서비스의 지연은 일정하지 않으므로 AI는 항상 비동기로 표시되며 실패하면 기본 화면만 남습니다. 한국어 품질과 실제 응답 속도는 배포 환경에서 확인해야 합니다.

요청은 로그인한 사용자만 보낼 수 있으며 입력은 최대 4,000자입니다. 서버 인스턴스별로 분당 8회 제한을 적용하지만, 여러 인스턴스에 걸친 사용량·비용 상한은 보장하지 않습니다. 공개 배포 전에 영속적 제한과 NVIDIA 사용량 알림을 설정하세요. 연구노트의 태그 추천은 편집기를 벗어날 때 노트 내용을 NVIDIA API로 전송합니다. 스터디 모집글 태그 추천은 제목과 설명을 전송합니다. 투표 결과에서는 개인별 답변이 아닌 집계 수치만 전송합니다. AI 응답 자체는 DB에 저장하지 않으며, 사용자가 선택한 추천 태그만 노트나 모집글에 저장됩니다.

## 대회 제출

`/contests`에서 로그인한 사용자가 대회를 만들고 제출 링크를 공유할 수 있습니다. 제출 항목은 파일·링크·텍스트로 구성하며 필수 여부, 안내, 순서를 정합니다. 파일 항목마다 `.ppt,.pptx` 또는 `.pdf,.hwp,.hwpx`처럼 원하는 확장자를 직접 입력할 수 있고, 최대 용량은 1~50MB로 지정합니다. 확장자를 비워두면 모든 확장자를 허용합니다. 확장자 제한은 파일명 기준이며 파일 내용의 형식을 분석하는 기능은 아닙니다.

대회 생성 시 로고를 미리 보고 업로드할 수 있으며, 호스트는 기존 대회의 로고를 교체·제거할 수 있습니다. PNG·JPG·WebP, 최대 2MB를 지원합니다. 로고는 공개 표시용 `contest-logos` 버킷에 저장하며 참가자의 비공개 제출 파일과 분리합니다. `supabase/migrations/20261018052904_contest_logos.sql`에 로고 컬럼·버킷·권한 검증이 포함됩니다. 모든 마이그레이션을 순서대로 적용해야 합니다.

마감은 한국 시간으로 초 단위까지 설정합니다. 호스트와 참가자 화면은 DB의 `contest_server_time()`과 30초마다 동기화하며, 기기 시계가 바뀌어도 남은 시간을 유지합니다. DB 트리거와 RLS가 실제 마감 시각·접수 상태·필수 항목·파일 확장자·실제 저장 용량을 검증합니다. 호스트는 접수를 중지·재개하거나 마감을 변경할 수 있습니다. 계정당 한 건을 제출하며 마감 전 재제출로 수정합니다. 생성한 제출 항목은 고정됩니다.

테이블·RLS·비공개 버킷·RPC는 `supabase/migrations/20261018051657_contest_submissions.sql`에 있습니다. 새 Supabase 환경에는 프런트엔드 사용 전에 이 SQL을 적용해야 합니다. 파일과 응답은 본인과 해당 대회 호스트만 읽을 수 있습니다.

검증 명령:

```bash
node --test tests/contests/helpers.test.mjs
bash scripts/test-contests-db.sh # Podman 필요; CONTEST_TEST_RUNTIME=docker도 지원
npm run build
npx next start --port 3147
# 다른 터미널에서 실행. Supabase 요청을 모두 모의 처리하므로 실제 데이터는 만들지 않습니다.
node tests/contests/browser.mjs
```

SQL 테스트의 `bootstrap.sql`은 비어 있는 일회용 PostgreSQL 전용입니다. 실제 Supabase에 실행하지 마세요.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
