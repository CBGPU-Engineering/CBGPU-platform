# 일반 계정의 CPU 프로젝트 생성 RLS 오류

2026-10-21 운영 Supabase DB와 API 로그를 확인했다.

## 운영 정책

`authenticated` 역할은 `public.cpu_projects`에 INSERT 권한이 있고 RLS가 켜져 있다. INSERT 정책 `cpu_projects_owner_insert`는 다음을 모두 요구한다.

1. `user_id = auth.uid()`
2. `status = 'pending'`
3. `deployed_at IS NULL`
4. 로그인한 사용자와 같은 ID의 `profiles` 행이 존재하고 `is_approved IS DISTINCT FROM false`

웹과 앱의 신규 프로젝트 폼은 `user_id`를 로그인 계정으로 보내며, `status`와 `deployed_at`은 각각 DB 기본값 `pending`과 `NULL`을 사용한다.

운영 DB 집계에서 프로필 146건 중 승인 136건, 제한 10건이며, `auth.users` 중 프로필이 없는 계정이 8건이다.

## 최온유 계정의 원인과 결과

최온유 계정은 `profiles.is_approved=true`인 일반 사용자이고 인증 계정과 연결돼 있다. 2026-10-21 06:18:41, 06:18:45, 06:28:22 UTC의 프로젝트 생성 요청은 모두 **이 계정의 인증된 JWT**로 들어왔지만 403과 `cpu_projects` RLS 오류가 발생했다. 따라서 이 사례의 원인은 계정이 관리자 계정이 아니거나 프로필이 제한 상태였기 때문이 아니다.

동일한 날 07:47 UTC에 다른 기여자가 [`20261021074549_cpu_projects_student_insert_policy.sql`](../FrontEnd/cbgpu/supabase/migrations/20261021074549_cpu_projects_student_insert_policy.sql)을 운영 DB에 적용해 일반 사용자 SELECT/INSERT 권한과 정책, UPDATE 보호 트리거를 재설정했다. 그 뒤 07:57:54 UTC에 **최온유 계정의 POST가 201로 성공**했고, 해당 계정에 `pending` 프로젝트 1건이 저장된 것을 확인했다. 운영 RLS 설정 문제는 복구됐다. 변경 전 정책의 어느 조건이 거짓으로 평가됐는지 보여 주는 상세 로그는 없어 그 세부 원인까지 단정할 수는 없다.

## 코드와 DB 정책의 차이

웹 `useAuth`는 프로필 조회가 실패해 `profile=null`이어도 `isApproved=true`로 계산한다. 앱의 프로젝트 생성 화면도 프로필 조회 결과가 `null`이면 제한 상태가 아니라고 간주했다. 이는 최온유 계정에서 확인된 원인은 아니지만 다른 계정에는 같은 오류를 유발할 수 있다.

웹과 앱의 프로젝트 생성 화면에 프로필 확인 실패 안내를 추가하고, `42501`을 권한 확인 메시지로 바꿨다. `Migrations/cpu_projects_deployment_fix.sql`의 INSERT 정책도 현재 운영 DB의 프로필 조건과 일치시켰다. 운영 DB 정책 자체는 완화하지 않았다.
