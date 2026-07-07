-- ============================================================
-- CBGPU 보안 강화 마이그레이션
-- Supabase SQL Editor에서 실행하세요.
--
-- ⚠️ 실행 전에: Database → Tables → (profiles / cpu_projects / gpus) →
-- Policies 탭에서 기존에 만들어둔 정책 이름을 먼저 확인하세요. 이 파일은
-- 코드에서 실제로 쓰는 이름들만 추측해서 "if exists"로 지우지만, 다른 이름의
-- 기존 정책이 남아있으면 이 마이그레이션과 충돌하거나 무력화될 수 있습니다.
-- 특히 profiles/cpu_projects/gpus에 "select/update using (true)" 같은
-- 전체 허용 정책이 이미 있다면 반드시 지우고 아래 정책으로 교체하세요.
-- ============================================================

-- ── 1. profiles: 본인 프로필은 수정 가능하되, is_admin/is_approved는
--    본인이 스스로 바꿀 수 없게 한다. 클라이언트(anon key)에서 직접
--    supabase.from('profiles').update({is_admin:true})를 호출해도
--    이 체크에 걸려서 거부된다. ────────────────────────────────────
alter table profiles enable row level security;

drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin     = (select p.is_admin     from profiles p where p.id = auth.uid())
    and is_approved  = (select p.is_approved  from profiles p where p.id = auth.uid())
  );

drop policy if exists "profiles_admin_all" on profiles;
create policy "profiles_admin_all" on profiles for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

-- 회원가입 직후 본인 행 삽입은 허용하되, is_admin/is_approved는 항상 false로 강제한다.
drop policy if exists "profiles_insert_self" on profiles;
create policy "profiles_insert_self" on profiles for insert
  with check (auth.uid() = id and is_admin = false and is_approved = false);

-- ── 2. cpu_projects: 소유자 또는 관리자만 수정/삭제 가능. UI에서만
--    막던 것을 실제 DB 레벨에서도 강제한다. ──────────────────────────
alter table cpu_projects enable row level security;

drop policy if exists "cpu_projects_owner_update" on cpu_projects;
create policy "cpu_projects_owner_update" on cpu_projects for update
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true)
  );

drop policy if exists "cpu_projects_owner_delete" on cpu_projects;
create policy "cpu_projects_owner_delete" on cpu_projects for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- ── 3. gpus: password 컬럼이 있는 테이블이므로 직접 SELECT는 관리자만
--    가능하게 막고, 일반 사용자는 자신이 승인받은 예약의 GPU 비밀번호만
--    돌려주는 함수를 통해서만 조회한다. (프론트엔드는 이미 이 함수를
--    쓰도록 수정됨: get_active_gpu_password) ─────────────────────────
alter table gpus enable row level security;

drop policy if exists "gpus_select_all" on gpus;
drop policy if exists "gpus_admin_select" on gpus;
create policy "gpus_admin_select" on gpus for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "gpus_admin_write" on gpus;
create policy "gpus_admin_write" on gpus for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin = true));

create or replace function get_active_gpu_password(p_gpu_id int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_password text;
begin
  if not exists (
    select 1 from reservations r
    where r.gpu_id = p_gpu_id
      and r.user_id = auth.uid()
      and r.status = 'approved'
  ) then
    return null;
  end if;

  select password into v_password from gpus where id = p_gpu_id;
  return v_password;
end;
$$;

grant execute on function get_active_gpu_password(int) to authenticated;
