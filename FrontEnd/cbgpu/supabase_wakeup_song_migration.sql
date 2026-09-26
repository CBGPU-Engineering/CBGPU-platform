-- ============================================================
-- CBGPU 기상송(wake-up song) request migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Replaces the manual "담당자가 매일 유튜브에서 플레이리스트를 직접 골라 재생" workflow —
-- students submit a YouTube link themselves (with which morning it's for),
-- it's live in that day's queue immediately, and an admin/manager only steps
-- in to reject something inappropriate — there's no separate pre-approval
-- gate slowing every request down.

-- 기상송 담당자: 사이트 전체 관리자(is_admin)가 아니어도 이 신청을 검토/승인할 수
-- 있는 별도 권한 — printer_managers/is_laser_manager와 같은 패턴 (관리자 권한과
-- 담당자 권한은 완전히 분리되고, 담당자 지정은 /admin/wakeup에서 진짜 관리자만 할 수 있음).
alter table profiles add column if not exists is_wakeup_manager boolean default false;

create or replace function public.is_wakeup_manager(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_wakeup_manager from public.profiles p where p.id = uid), false);
$$;

-- 청운학사/사름학사는 완전히 별도 큐 — 기숙사마다 스피커/재생 담당이 다르고, 그날
-- 그 기숙사에 있는 사람만 그 기숙사 신청곡을 듣게 되니 섞이면 안 된다.
--
-- play_date: 신청자가 직접 고르는 "어느 날 아침에 틀지" — /admin/wakeup은 이
-- 값이 오늘인 것만 보여준다. status 기본값이 'approved'라 신청 즉시 그날 대기열에
-- 올라가고, 관리자/담당자는 부적절한 것만 골라서 사후에 거절한다('pending'은
-- 과거 승인제 흐름의 흔적으로 체크 제약에만 남아 있음).
create table if not exists wakeup_songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  dorm text not null check (dorm in ('청운학사', '사름학사')),
  play_date date not null,
  youtube_video_id text not null,
  title text not null,
  channel_title text,
  thumbnail_url text,
  message text default '',
  status text not null default 'approved'
    check (status in ('pending', 'approved', 'playing', 'rejected', 'played')),
  reject_reason text,
  played_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists wakeup_songs_status_idx on wakeup_songs (dorm, play_date, status);

alter table wakeup_songs enable row level security;

-- Anyone signed in can see the public queue (approved/played); a submitter
-- can also see their own pending/rejected rows to track their request; an
-- admin or wakeup manager can see everything (including others' pending rows,
-- to review them).
drop policy if exists "wakeup_songs_select" on wakeup_songs;
create policy "wakeup_songs_select" on wakeup_songs for select
  using (
    status in ('approved', 'played')
    or user_id = auth.uid()
    or public.is_admin(auth.uid())
    or public.is_wakeup_manager(auth.uid())
  );

-- 신청은 항상 'approved'로만 들어올 수 있다 — 클라이언트가 'played'나
-- 'rejected'를 자기 걸로 조작해 넣을 수 없게.
drop policy if exists "wakeup_songs_insert" on wakeup_songs;
create policy "wakeup_songs_insert" on wakeup_songs for insert
  with check (user_id = auth.uid() and status = 'approved');

-- Only an admin or a designated wakeup manager can change a row at all —
-- approve/reject, and marking a song 'played' once it actually finishes
-- playing (playback itself lives on /admin/wakeup, not the public page, so
-- this is the same audience either way).
drop policy if exists "wakeup_songs_update" on wakeup_songs;
drop policy if exists "wakeup_songs_admin_update" on wakeup_songs;
drop policy if exists "wakeup_songs_mark_played" on wakeup_songs;
create policy "wakeup_songs_admin_update" on wakeup_songs for update
  using (public.is_admin(auth.uid()) or public.is_wakeup_manager(auth.uid()));

-- A submitter can delete their own request any time (withdraw a request they
-- regret, in any status — it's their own row); admins/managers can remove any.
drop policy if exists "wakeup_songs_delete" on wakeup_songs;
create policy "wakeup_songs_delete" on wakeup_songs for delete
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
    or public.is_wakeup_manager(auth.uid())
  );
