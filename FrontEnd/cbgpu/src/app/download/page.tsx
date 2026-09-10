'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Cpu, Printer, Server, CalendarDays, UtensilsCrossed, LayoutGrid,
} from 'lucide-react';
import { isNativeApp, onNativeBridgeReady } from '@/lib/nativeBridge';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.cbgpu.cbgpu_app';

const FEATURES = [
  { Icon: Cpu, label: 'GPU 예약', desc: '실시간 상태 확인하고 바로 예약' },
  { Icon: Printer, label: '3D프린터 · 레이저', desc: '신청부터 완료까지 진행 상황 확인' },
  { Icon: Server, label: '서버 배포', desc: 'Docker/Git으로 프로젝트 올리기' },
  { Icon: CalendarDays, label: '시간표', desc: '대강까지 반영되는 실시간 시간표' },
  { Icon: UtensilsCrossed, label: '급식', desc: '오늘 급식 메뉴 바로 확인' },
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
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">충북과학고 동아리</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic">CBGPU 앱</h1>
          <p className="text-muted-foreground font-medium max-w-md mx-auto">
            GPU 예약부터 시간표, 급식, 제작 신청까지 — 동아리 자원을 앱 하나로.
          </p>
        </div>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-black text-sm uppercase tracking-widest px-8 py-4 rounded-2xl shadow-xl shadow-primary/20 transition-transform active:scale-95 hover:scale-[1.02]"
        >
          Google Play에서 다운로드
        </a>
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

      <p className="text-center text-xs text-muted-foreground">
        충북과학고등학교 학생 전용 서비스입니다.
      </p>
    </main>
  );
}
