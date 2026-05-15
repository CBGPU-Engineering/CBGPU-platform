-- ============================================================
-- CBGPU 투표 시스템 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

create table if not exists polls (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  title       text not null,
  description text default '',
  options     jsonb not null default '[]', -- [{id: uuid, text: string}]
  ends_at     timestamptz,
  is_active   boolean default true,
  created_by  uuid references auth.users(id),
  allow_multiple boolean default false
);

create table if not exists poll_votes (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  poll_id    uuid references polls(id) on delete cascade not null,
  user_id    uuid references auth.users(id) not null,
  option_ids jsonb not null default '[]',
  unique(poll_id, user_id)
);

-- RLS 활성화
alter table polls      enable row level security;
alter table poll_votes enable row level security;

-- polls: 로그인 여부와 무관하게 읽기 가능
create policy "polls_read"        on polls for select using (true);
-- polls: 어드민만 생성/수정/삭제
create policy "polls_admin_write" on polls for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- votes: 로그인한 사용자 읽기
create policy "votes_read"   on poll_votes for select using (auth.uid() is not null);
-- votes: 본인 투표 삽입
create policy "votes_insert" on poll_votes for insert with check (user_id = auth.uid());
-- votes: 본인 투표 삭제 (철회)
create policy "votes_delete" on poll_votes for delete using (user_id = auth.uid());
