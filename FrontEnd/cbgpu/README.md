This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 기존 기능의 AI 보조 설정

기존 화면 안에서 AI가 동작합니다. 홈의 오늘 브리핑, 학교·기술 뉴스 제목 흐름, 시간표의 복습 힌트, 연구노트와 스터디 모집글의 추천 태그, 투표 결과의 한 줄 경향을 제공합니다. 기존 화면은 AI 응답을 기다리지 않습니다. 홈·뉴스·시간표 결과는 브라우저에 24시간 캐시됩니다. 서버 환경변수 `NVIDIA_API_KEY`에 NVIDIA NIM API 키를 설정해야 작동합니다. 브라우저에 노출되는 `NEXT_PUBLIC_` 접두어를 붙이지 마세요. 배포 시 Vercel 프로젝트의 Environment Variables에도 키를 등록해야 합니다.

기본 모델은 병렬 토큰 생성에 최적화된 `google/diffusiongemma-26b-a4b-it`이며 출력을 128토큰으로 제한합니다. NVIDIA 무료 추론 서비스의 지연은 일정하지 않으므로 AI는 항상 비동기로 표시되며 실패하면 기본 화면만 남습니다. 한국어 품질과 실제 응답 속도는 배포 환경에서 확인해야 합니다.

요청은 로그인한 사용자만 보낼 수 있으며 입력은 최대 4,000자입니다. 서버 인스턴스별로 분당 8회 제한을 적용하지만, 여러 인스턴스에 걸친 사용량·비용 상한은 보장하지 않습니다. 공개 배포 전에 영속적 제한과 NVIDIA 사용량 알림을 설정하세요. 연구노트의 태그 추천은 편집기를 벗어날 때 노트 내용을 NVIDIA API로 전송합니다. 스터디 모집글 태그 추천은 제목과 설명을 전송합니다. 투표 결과에서는 개인별 답변이 아닌 집계 수치만 전송합니다. AI 응답 자체는 DB에 저장하지 않으며, 사용자가 선택한 추천 태그만 노트나 모집글에 저장됩니다.

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
