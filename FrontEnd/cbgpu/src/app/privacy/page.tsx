export const metadata = {
  title: '개인정보처리방침',
  description: 'CBGPU 서비스의 개인정보 수집, 이용 및 보호에 관한 안내입니다.',
  alternates: { canonical: '/privacy' },
  openGraph: { title: '개인정보처리방침 | CBGPU', url: 'https://cbgpu.com/privacy' },
};

export default function PrivacyPage() {
  return (
    <section className="cb-page-content max-w-2xl mx-auto px-6 py-16 space-y-10">
      <div className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">CBGPU</p>
        <h1 className="text-3xl font-black tracking-tight">개인정보처리방침</h1>
        <p className="text-sm text-muted-foreground">시행일: 2026년 9월 10일</p>
      </div>

      <p className="text-sm leading-relaxed text-foreground/90">
        CBGPU(이하 &ldquo;서비스&rdquo;)는 충북과학고등학교 학생을 위한 종합 플랫폼입니다.
        서비스 이용을 위해 아래와 같이 개인정보를 수집·이용하며, 관련 법령을 준수합니다.
      </p>

      <Section title="1. 수집하는 정보">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><b>계정 정보</b> — 이메일 주소, 비밀번호(암호화 저장), 이름, 학번</li>
          <li><b>프로필 정보</b> — 프로필 사진(선택)</li>
          <li><b>서비스 이용 기록</b> — GPU 예약 내역, 3D프린터/레이저 커팅 신청 내역, 서버 배포 신청 내역, 자습신청 조회 내역, 투표 참여 내역, 작성한 노트/게시글</li>
          <li><b>기기 정보(앱 사용 시)</b> — 푸시 알림 발송을 위한 기기 토큰(FCM). 위젯·알림 기능을 쓰지 않으면 수집되지 않습니다.</li>
        </ul>
      </Section>

      <Section title="2. 수집 목적">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>회원 식별 및 로그인 유지</li>
          <li>GPU/3D프린터/레이저 커팅/서버 등 동아리 자원의 예약·신청 처리 및 담당자 승인</li>
          <li>시간표·급식·자습신청 등 학사 정보 조회</li>
          <li>새 신청/승인 등 상태 변화에 대한 푸시 알림 발송(설정에서 개별적으로 끌 수 있음)</li>
          <li>서비스 오남용 방지 및 계정 승인(학번·이름 확인)</li>
        </ul>
      </Section>

      <Section title="3. 보관 및 처리 위탁">
        <p>
          데이터는 <b>Supabase</b>(데이터베이스·인증)와 <b>Firebase Cloud Messaging</b>(안드로이드 푸시 알림 발송)를 통해
          처리·저장됩니다. 두 서비스 모두 해당 업체의 자체 보안 정책에 따라 데이터를 보호합니다. 이 두 곳 외의
          제3자에게 개인정보를 판매하거나 광고 목적으로 제공하지 않습니다.
        </p>
      </Section>

      <Section title="4. 보유 기간 및 삭제">
        <p>
          회원 탈퇴 시 이름·학번·프로필 사진 등 식별 정보는 즉시 삭제되고 로그인이 비활성화됩니다.
          프로필 &gt; 계정 삭제 메뉴에서 직접 탈퇴할 수 있으며, 관리자를 통한 계정 삭제도 가능합니다.
          예약/신청 등 이용 기록은 동아리 자원 운영 기록 보존을 위해 개인 식별 정보와 분리된 형태로 남을 수 있습니다.
        </p>
      </Section>

      <Section title="5. 이용자의 권리">
        <p>
          본인의 개인정보 열람·수정은 프로필 페이지에서 직접 할 수 있으며, 삭제(탈퇴)도 언제든 가능합니다.
          그 외 문의사항은 아래 연락처로 문의해주세요.
        </p>
      </Section>

      <Section title="6. 서비스 이용 통계">
        <p>방문 수와 서비스 상태를 확인하기 위해 임의의 브라우저 식별자를 최대 30일 동안 쿠키에 저장합니다. 방문 통계에는 이메일 주소, IP 주소, 페이지 내용이 저장되지 않으며, 일별로 변환된 식별자와 방문 횟수만 최대 30일 보관합니다. 브라우저의 추적 거부 설정을 지원합니다.</p>
      </Section>

      <Section title="7. 문의처">
        <p className="text-muted-foreground">
          <a className="underline underline-offset-4" href="mailto:info@cbgpu.com">info@cbgpu.com</a>
        </p>
      </Section>

      <p className="text-xs text-muted-foreground pt-4 border-t">
        이 방침은 서비스 변경에 따라 갱신될 수 있으며, 변경 시 이 페이지에 최신 내용이 반영됩니다.
      </p>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-black tracking-tight">{title}</h2>
      <div className="text-sm leading-relaxed text-foreground/80 space-y-2">{children}</div>
    </div>
  );
}
