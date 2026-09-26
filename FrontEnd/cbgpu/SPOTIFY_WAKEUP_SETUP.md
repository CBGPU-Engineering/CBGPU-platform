# Spotify 기상송 설정

기상송 신청은 Spotify 카탈로그에서 검색하고, 교내 화면의 실제 재생은 기존
YouTube 플레이어를 그대로 사용합니다. 기상송 담당자는 관리자 화면에서 그날
신청곡의 Spotify 플레이리스트를 만들고 공유 링크를 발급할 수 있습니다.

## 1. Spotify Dashboard

Spotify Developer Dashboard의 **cbgpu** 앱 설정에서 Redirect URI에 아래 주소를
정확히 추가하세요. 현재 등록된 사이트 루트(`https://cbgpu.vercel.app/`)만으로는
OAuth 콜백을 받을 수 없습니다.

```
https://cbgpu.vercel.app/api/wakeup/spotify/callback
```

개발 환경에서도 확인하려면 개발 서버 주소에 같은 경로를 붙여 별도로 등록하세요.
Spotify는 등록된 URI와 요청 URI가 글자 단위로 일치해야 합니다.

## 2. Vercel 환경 변수

Vercel 프로젝트의 Production 환경 변수에 다음 값을 넣습니다. Client secret은
브라우저에 노출하면 안 되므로 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.

```
SPOTIFY_CLIENT_ID=efa2ce3d55ec4b9e9d1fd7ec7a6b78da
SPOTIFY_CLIENT_SECRET=<Spotify Dashboard Settings의 Client secret>
SPOTIFY_REDIRECT_URI=https://cbgpu.vercel.app/api/wakeup/spotify/callback
```

`SPOTIFY_CLIENT_SECRET`이 없으면 학생용 Spotify 검색이 의도적으로 동작하지
않습니다. 연결 후에는 기상송 담당자가 `/admin/wakeup`에서 **Spotify 플레이리스트
만들기**를 눌러 자신의 Spotify 계정을 한 번 승인하면 됩니다. Spotify refresh token은
해당 담당자 브라우저의 HTTP-only 쿠키에만 저장됩니다.

관리 화면은 당일 신청곡이 8곡보다 적으면 기존 신청곡의 분위기와 아티스트를
바탕으로 AI가 Spotify 곡을 추천해 빈 자리를 자동으로 채웁니다. 이 기능에는 기존
`NVIDIA_API_KEY`와 `YOUTUBE_API_KEY`도 필요합니다. AI 추천곡 역시 Spotify에서
확인한 뒤 YouTube 재생용 영상만 별도로 매칭하므로, 신청곡의 기준은 Spotify입니다.

## 3. Supabase SQL

`supabase_wakeup_song_migration.sql`을 Supabase SQL Editor에서 다시 실행하세요.
기존 `wakeup_songs`에 Spotify 식별자 컬럼을 더하고, 공개 플레이리스트 링크를 저장하는
`wakeup_playlists` 테이블과 RLS 정책을 생성합니다.
