'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Cpu, Printer, Server, CalendarDays, UtensilsCrossed, LayoutGrid, Smartphone, ShieldCheck,
} from 'lucide-react';
import { isNativeApp, onNativeBridgeReady } from '@/lib/nativeBridge';

// 아직 Play Store 심사 전이라 APK를 직접 배포한다. 스토어에 올라가면 이 링크만
// Play Store URL로 바꿔주면 됨 — 나머지 UI/문구는 그대로 재사용 가능하게 짜둠.
const APK_URL = '/downloads/cbgpu.apk';

const FEATURES = [
  { Icon: CalendarDays, label: '시간표', desc: '대강까지 반영되는 실시간 시간표' },
  { Icon: UtensilsCrossed, label: '급식', desc: '오늘 급식 메뉴 바로 확인' },
  { Icon: Cpu, label: 'GPU 예약', desc: '실시간 상태 확인하고 바로 예약' },
  { Icon: Printer, label: '3D프린터 · 레이저', desc: '신청부터 완료까지 진행 상황 확인' },
  { Icon: Server, label: '서버 배포', desc: 'Docker/Git으로 프로젝트 올리기' },
  { Icon: LayoutGrid, label: '홈 화면 위젯', desc: 'GPU·프린터·시간표·급식을 앱 안 열고도' },
];

/**
 * "지금 다운로드하세요" 페이지 — 웹 방문자라면 로그인 여부와 상관없이
 * 보여야 하지만, 앱(WebViewShellScreen) 안에서는 볼 이유가 없다(이미 쓰고
 * 있으니까). window.CBGPUNative 브릿지가 있으면 즉시 홈으로 돌려보낸다.
 */
export default function DownloadPage() {
  const router = useRouter();

  useEffect(() => {
    if (isNativeApp()) {
      router.replace('/');
      return;
    }
    return onNativeBridgeReady(() => router.replace('/'));
  }, [router]);

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 space-y-16">
      <div className="text-center space-y-6">
        <Image src="/img/cbgpu-logo.png" alt="CBGPU" width={96} height={96} className="mx-auto" />
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">충북과학고 학생 종합 플랫폼</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic">CBGPU 앱</h1>
          <p className="text-muted-foreground font-medium max-w-md mx-auto">
            시간표, 급식부터 GPU 예약, 제작 신청까지 — 학교생활을 앱 하나로.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <a
            href={APK_URL}
            download
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-black text-sm uppercase tracking-widest px-8 py-4 rounded-2xl shadow-xl shadow-primary/20 transition-transform active:scale-95 hover:scale-[1.02]"
          >
            APK 다운로드
          </a>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-bold">
            <Smartphone className="size-3" /> 안드로이드 전용 · iOS는 아직 준비 중이에요
          </p>
        </div>
      </div>

      <div className="flex gap-3 p-4 rounded-2xl bg-muted/40 ring-1 ring-foreground/5 text-left">
        <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-black">Play 스토어 출시 전이라 APK로 직접 설치해요</p>
          <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
            다운로드한 APK를 열면 &quot;출처를 알 수 없는 앱&quot; 설치를 허용해달라는 안내가 떠요.
            학교 동아리에서 직접 서명한 정식 빌드이니 안심하고 설치를 허용해 주세요.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {FEATURES.map(({ Icon, label, desc }) => (
          <div key={label} className="tilt-3d p-5 rounded-2xl bg-card ring-1 ring-foreground/5 shadow-sm space-y-2">
            <span className="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" strokeWidth={2} />
            </span>
            <p className="font-black text-sm">{label}</p>
            <p className="text-[11px] text-muted-foreground font-medium leading-snug">{desc}</p>
          </div>
        ))}
      </div>

      {/* 컴퓨터로 보고 있는 경우를 위한 QR — 모바일에선 굳이 필요 없어서 숨김 */}
      <div className="hidden md:flex flex-col items-center gap-3 py-8 border-y border-border/50">
        <Image
          src="/img/cbgpu-apk-qr.png"
          alt="APK 다운로드 QR코드"
          width={140}
          height={140}
          className="rounded-xl ring-1 ring-foreground/10"
        />
        <p className="text-xs text-muted-foreground font-bold">휴대폰으로 QR코드를 스캔해서 설치하세요</p>
      </div>

      <div className="text-center space-y-3">
        <p className="text-xs text-muted-foreground">
          충북과학고등학교 학생 전용 서비스입니다.
        </p>
        <div className="flex items-center justify-center gap-4 text-[11px] font-bold text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors underline underline-offset-2">
            설치 없이 웹으로 계속하기
          </Link>
          <span className="opacity-30">·</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors underline underline-offset-2">
            개인정보처리방침
          </Link>
        </div>
      </div>
    </main>
  );
}
