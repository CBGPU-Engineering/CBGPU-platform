# 자습신청 알림 설치

1. Supabase Vault에 `cbgpu_service_role_key` 이름으로 프로젝트 서비스 롤 키를 저장합니다. 이 키를 브라우저 환경 변수나 Git에 넣지 않습니다.
2. `FrontEnd/cbgpu_app/supabase/selfstudy_reminder_migration.sql`을 Supabase SQL Editor에서 실행합니다. 기존의 기본 켜짐 상태는 모두 꺼지고, 이후 명시적으로 선택한 계정만 알림을 받습니다.
3. Edge Function `selfstudy-reminder`를 배포하고 `EDUSET_TOKEN_SECRET`, `FIREBASE_SERVICE_ACCOUNT_JSON` 서버 비밀 값을 설정합니다. 함수 호출은 서비스 롤 키로만 허용합니다.
4. Android 앱은 기존 FCM 설정을 사용합니다. iOS 푸시에는 Firebase의 APNs 설정 및 iOS용 Firebase 앱 등록이 추가로 필요합니다.

웹과 앱 모두 자습신청 페이지의 **신청 알림**에서 설정을 저장할 수 있습니다. 푸시 알림은 등록된 Android/iOS 앱으로만 전송됩니다. 매 15분마다 예약 함수가 실행되지만 실제 EduSet 조회는 그 시각에 알림이 필요한 사용자가 있을 때만 진행합니다. 첫 알림은 08:00~15:15의 15분 단위로 선택하며, 재알림도 15:15 이후에는 보내지 않습니다.
