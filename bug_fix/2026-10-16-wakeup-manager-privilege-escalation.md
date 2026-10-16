# 기상송 담당자 권한 자체 획득 가능

- 발견: 2026-10-16
- 상태: 사용자가 운영 DB에 수정 SQL 실행을 알림, 권한 테스트 대기
- 영향: 로그인한 일반 사용자가 자신의 프로필에서 기상송 담당자 권한을 얻을 수 있음

## 현상과 정상 권한 모델

기상송 담당자는 사이트 전체 관리자와 **별도의 역할**이다. 사이트 관리자가
지정한 비관리자 담당자도 `/admin/wakeup`에 들어가 신청곡 검토·재생을 할 수
있다. 따라서 `is_admin = false`인 담당자가 있다는 사실만으로 침해나 오류라고
판단할 수 없다. 조사 시점에 비관리자 담당자 프로필은 2개였다. 누가, 언제,
어떤 경로로 이 권한을 받았는지 확인할 감사 기록은 발견하지 못했다.

## 원인

`FrontEnd/cbgpu/supabase_security_hardening_migration.sql`의
`profiles_update_self` 정책은 로그인한 사용자가 자신의 `profiles` 행을
수정하도록 허용한다. 변경 후 값은 `is_admin`과 `is_approved`만 기존 값과
비교한다. 이후 추가된 `is_wakeup_manager`와 `is_laser_cut_manager`는 이
검사에 포함되지 않았다. `profiles_insert_self` 정책도 이 두 담당자 값을
제한하지 않는다.

`FrontEnd/cbgpu/src/lib/useAuth.tsx`는 프로필의 `is_wakeup_manager`를 화면
접근 권한으로 사용한다. 기상송 관련 DB 정책과 API도 같은 값을 담당자
권한으로 신뢰한다. 따라서 자기 프로필에서 이 값을 `true`로 바꿀 수 있으면
기상송 관리 권한까지 얻는다. 관리자 화면에서만 담당자를 지정하도록 만든
버튼은 보안 경계가 아니다. 데이터베이스가 직접 변경도 막아야 한다.

같은 누락으로 `is_laser_cut_manager` 역시 자체 획득 가능성이 있다.

## 화면에서 가능한 경로와 확인 한계

일반 사용자 화면에는 `is_wakeup_manager`를 켜는 버튼이 없다. 담당자 지정
버튼은 사이트 전체 관리자에게만 보이는 `/admin`에 있다. `/profile`의
정보 저장도 `student_id`와 `full_name`만 전송한다. 일반 사용자가
이 결함을 이용했다면 로그인한 상태에서 개발자 도구나 별도 스크립트로
자신의 `profiles` 행에 직접 수정 요청을 보냈어야 한다. 화면에 들어간
것만으로 이런 요청을 했다고 단정할 수 없다. 기존 비관리자 담당자는
관리자가 정상 지정했을 수도 있으며, 현재 데이터만으로 두 경로를
구별할 수 없다.

## 수정

`FrontEnd/cbgpu/supabase_wakeup_manager_security_fix.sql`은 `profiles`에
`BEFORE INSERT OR UPDATE` 트리거를 설치한다. 사이트 관리자가 아닌 요청은
`is_admin`, `is_approved`, `is_wakeup_manager`,
`is_laser_cut_manager`를 지정하거나 변경할 수 없다. 관리자와 서버의
서비스 역할은 기존처럼 담당자를 지정할 수 있다. 기존 담당자 지정은
자동 변경하지 않는다.

RLS 정책만 하나 더 추가하면 기존의 허용 정책과 OR로 합쳐질 수 있으므로,
열 값 변경을 검사하는 트리거를 사용한다. Supabase SQL Editor에서 수정
SQL을 실행해야 운영 DB에 효력이 생긴다. Git 커밋만으로는 차단되지 않는다.

## 적용 후 확인

1. `pg_trigger`에서 `public.profiles`의
   `guard_profile_privileged_columns` 트리거가 활성화됐는지 확인한다.
2. 별도 테스트 일반 계정으로 자기 프로필의 이름 등 일반 필드 수정은
   성공하고 담당자 플래그 수정은 `42501`로 거부되는지 확인한다.
3. 사이트 관리자는 기존 관리 화면에서 담당자 지정과 해제를 할 수 있는지
   확인한다.
4. 기존 비관리자 담당자 2명은 지정 경위를 확인한 뒤 유지 또는 해제를
   결정한다. 이 수정만으로 과거 권한 취득 경로를 판별할 수는 없다.

## 운영 상태

2026-10-16 사용자가 SQL을 Supabase SQL Editor에서 실행했다고 알렸다.
위 권한 테스트 결과는 아직 확인되지 않았다.
