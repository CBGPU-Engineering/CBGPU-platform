-- ============================================================
-- CBGPU 기상송(wake-up song) request migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Replaces the manual "담당자가 매일 유튜브에서 플레이리스트를 직접 골라 재생" workflow —
-- students submit a YouTube link themselves, an admin approves/rejects, and
-- the queue plays itself back to back (see /wakeup). No dates/ordering
-- columns: the queue is just every 'approved' row in submission order, and
-- each becomes 'played' once it finishes — there's nothing to schedule.
create table if not exists wakeup_songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  youtube_video_id text not null,
  title text not null,
  channel_title text,
  thumbnail_url text,
  message text default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'played')),
  reject_reason text,
  played_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists wakeup_songs_status_idx on wakeup_songs (status, created_at);

alter table wakeup_songs enable row level security;

-- Anyone signed in can see the public queue (approved/played); a submitter
-- can also see their own pending/rejected rows to track their request.
drop policy if exists "wakeup_songs_select" on wakeup_songs;
create policy "wakeup_songs_select" on wakeup_songs for select
  using (
    status in ('approved', 'played')
    or user_id = auth.uid()
    or public.is_admin(auth.uid())
  );

drop policy if exists "wakeup_songs_insert" on wakeup_songs;
create policy "wakeup_songs_insert" on wakeup_songs for insert
  with check (user_id = auth.uid());

-- Only admins approve/reject. Anyone signed in can flip an already-approved
-- row to 'played' though — that's just "this finished playing" bookkeeping
-- from whoever's on wake-up-song duty that morning, not a moderation action,
-- and requiring a full admin account for it would defeat the point of
-- letting the queue play itself.
drop policy if exists "wakeup_songs_update" on wakeup_songs;
drop policy if exists "wakeup_songs_admin_update" on wakeup_songs;
create policy "wakeup_songs_admin_update" on wakeup_songs for update
  using (public.is_admin(auth.uid()));

drop policy if exists "wakeup_songs_mark_played" on wakeup_songs;
create policy "wakeup_songs_mark_played" on wakeup_songs for update
  using (status = 'approved')
  with check (status = 'played');

-- A submitter can cancel their own still-pending request; admins can remove any.
drop policy if exists "wakeup_songs_delete" on wakeup_songs;
create policy "wakeup_songs_delete" on wakeup_songs for delete
  using (
    (user_id = auth.uid() and status = 'pending')
    or public.is_admin(auth.uid())
  );
