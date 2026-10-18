'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight } from 'lucide-react';

const PAGES = [
  { title: '교내 대회', description: '행사 개설, 참가 신청, 운영과 작품 제출', href: '/contests', keywords: '교내 대회 행사 공모전 참가 신청 체크인 제출 파일 링크 호스트' },
  { title: '전체 서비스', description: '학교생활·연구·도구 한눈에 보기', href: '/services', keywords: '전체 메뉴 기능' },
  { title: '기상송', description: '듣고 싶은 노래 신청과 플레이리스트', href: '/wakeup', keywords: '음악 노래 스포티파이' },
  { title: '자습신청', description: '신청 현황과 자리 확인', href: '/study', keywords: '자습 edu-set' },
  { title: '시간표', description: '수업 시간표 보기', href: '/timetable', keywords: '수업' },
  { title: '급식', description: '오늘의 식단 확인', href: '/meal', keywords: '밥 식단' },
  { title: '스터디 매칭', description: '함께 공부할 사람 찾기', href: '/match', keywords: '모임' },
  { title: 'GPU 예약', description: 'GPU 사용 일정과 예약', href: '/dashboard', keywords: '컴퓨팅' },
  { title: '서버 배포', description: '내 서버 관리', href: '/server', keywords: '호스팅' },
  { title: '제작', description: '3D 프린터와 레이저 신청', href: '/manufacturing', keywords: '프린터 레이저' },
  { title: '연구노트', description: '노트 작성과 공유', href: '/notes', keywords: '메모 기록' },
  { title: '자료 공유', description: '파일을 올리고 내려받기', href: '/materials', keywords: '파일 태그 학습자료' },
  { title: '도구', description: '타이머와 디데이', href: '/tools', keywords: '타이머 디데이' },
  { title: '투표', description: '의견을 모으는 투표', href: '/polls', keywords: '설문' },
  { title: 'Feed', description: '학교 소식과 글', href: '/feed', keywords: '피드' },
  { title: 'Arcade', description: '게임', href: '/games', keywords: '게임' },
  { title: '내 프로필', description: '계정 정보 확인', href: '/profile', keywords: '계정' },
  { title: '문의하기', description: '문제와 제안 보내기', href: '/contact', keywords: '문의 도움말' },
];

export default function SiteSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const normalized = query.trim().toLocaleLowerCase();
  const results = normalized
    ? PAGES.filter(page => `${page.title} ${page.description} ${page.keywords}`.toLocaleLowerCase().includes(normalized))
    : PAGES;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [open, onOpenChange]);

  const navigate = (href: string) => {
    onOpenChange(false);
    setQuery('');
    setSelected(0);
    router.push(href);
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={() => onOpenChange(false)}
      onClick={event => { if (event.target === dialogRef.current) onOpenChange(false); }}
      aria-label="기능 찾기"
      className="site-search fixed inset-0 m-auto w-[min(92vw,34rem)] max-h-[min(80vh,42rem)] rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl"
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={event => { setQuery(event.target.value); setSelected(0); }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setSelected(index => Math.min(index + 1, Math.max(results.length - 1, 0))); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setSelected(index => Math.max(index - 1, 0)); }
            if (event.key === 'Enter' && results[selected]) navigate(results[selected].href);
          }}
          placeholder="어떤 기능을 찾으세요?"
          aria-label="기능 검색"
          data-no-focus-ring
          className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground"
        />
        <button type="button" onClick={() => onOpenChange(false)} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">닫기</button>
      </div>
      <div className="thin-scroll max-h-[min(65vh,34rem)] overflow-y-auto p-2">
        {results.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">검색 결과가 없어요. 다른 단어로 찾아보세요.</p>
        ) : results.map((page, index) => (
          <button
            key={page.href}
            type="button"
            style={{ '--i': Math.min(index, 8) } as React.CSSProperties}
            onClick={() => navigate(page.href)}
            onMouseEnter={() => setSelected(index)}
            className={`site-search-item flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors ${selected === index ? 'bg-primary/10' : 'hover:bg-muted'}`}
          >
            <span className="min-w-0">
              <span className="block font-bold">{page.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{page.description}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        ))}
      </div>
    </dialog>
  );
}
