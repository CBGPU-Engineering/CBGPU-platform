'use client';
import { useState, useEffect, useMemo } from 'react';

interface DeadService {
  name: string;
  month: number;
  day: number;
  year: number;
  category: string;
  desc: string;
  epitaph: string;
  emoji: string;
}

const GRAVEYARD: DeadService[] = [
  // January
  { name: "Google Glass (Consumer)", month: 1, day: 19, year: 2015, category: "Google", desc: "미래의 안경. 사람들은 Glass-hole이라 불렀다.", epitaph: "The future looked different through these", emoji: "👓" },
  { name: "Parse", month: 1, day: 28, year: 2017, category: "Facebook", desc: "개발자들이 사랑한 BaaS. 무료였기에 더 슬프다.", epitaph: "Parse this: you were great", emoji: "⚙️" },
  { name: "Google Stadia", month: 1, day: 18, year: 2023, category: "Google", desc: "클라우드 게이밍의 꿈. 하드웨어도 없이 시작했다.", epitaph: "The input lag was the real killer", emoji: "🎮" },

  // February
  { name: "Mailbox", month: 2, day: 26, year: 2016, category: "Dropbox", desc: "스와이프로 받은메일함을 비우는 혁명적 앱.", epitaph: "Swiped left one last time", emoji: "📬" },
  { name: "Twitch Korea", month: 2, day: 27, year: 2024, category: "Amazon", desc: "망 사용료 폭탄에 쓰러진 한국 게임 스트리밍.", epitaph: "Network neutrality is not a given", emoji: "🎥" },

  // March
  { name: "Picasa", month: 3, day: 15, year: 2016, category: "Google", desc: "구글 포토 이전 사진 관리의 왕.", epitaph: "A picture is worth a thousand memories", emoji: "🖼️" },
  { name: "Google Allo", month: 3, day: 12, year: 2019, category: "Google", desc: "AI 어시스턴트 내장 메신저. 아무도 안 썼다.", epitaph: "Smart messaging, dumb strategy", emoji: "💬" },

  // April
  { name: "Google+", month: 4, day: 2, year: 2019, category: "Google", desc: "10억짜리 Facebook 도전. +1 개 받음.", epitaph: "+1 for effort", emoji: "➕" },
  { name: "Google Inbox", month: 4, day: 2, year: 2019, category: "Google", desc: "이메일을 재발명했다. Gmail이 질투해서 죽였다.", epitaph: "Inbox zero. Forever.", emoji: "📥" },
  { name: "Posterous", month: 4, day: 30, year: 2013, category: "Twitter", desc: "블로그 플랫폼. 트위터가 인수해서 조용히 묻었다.", epitaph: "Posted its last post", emoji: "✍️" },
  { name: "Grooveshark", month: 4, day: 30, year: 2015, category: "Independent", desc: "Spotify보다 먼저였지만, 저작권법이 먼저였다.", epitaph: "The music played until the lawyers arrived", emoji: "🦈" },

  // May
  { name: "Yahoo Answers", month: 5, day: 4, year: 2021, category: "Yahoo", desc: "인터넷 지식의 혼돈. 하지만 그것이 매력이었다.", epitaph: "How is babby formed? We'll never know.", emoji: "❓" },
  { name: "Skype", month: 5, day: 5, year: 2025, category: "Microsoft", desc: "화상통화를 대중화했다. Zoom에게 왕좌를 빼앗겼다.", epitaph: "Can you hear me now? No.", emoji: "📞" },

  // June
  { name: "Yahoo Pipes", month: 6, day: 30, year: 2015, category: "Yahoo", desc: "웹 데이터 파이프라인의 선구자. 너무 앞섰다.", epitaph: "Piped to /dev/null", emoji: "🔧" },
  { name: "Google Code", month: 6, day: 25, year: 2016, category: "Google", desc: "GitHub 이전의 코드 호스팅. 그냥 GitHub이 더 좋았다.", epitaph: "GitHub was just better. Sorry.", emoji: "💻" },
  { name: "Internet Explorer", month: 6, day: 15, year: 2022, category: "Microsoft", desc: "27년간 웹을 공포에 떨게 했던 브라우저.", epitaph: "Please use a different browser to view this tombstone", emoji: "🌐" },

  // July
  { name: "Google Reader", month: 7, day: 1, year: 2013, category: "Google", desc: "RSS 리더의 왕. 인터넷이 울었다. 지금도 운다.", epitaph: "You had us at 'mark all as read'", emoji: "📰" },

  // August
  { name: "Vine", month: 8, day: 27, year: 2016, category: "Twitter", desc: "6초 영상의 전설. TikTok의 아버지.", epitaph: "6 seconds was never enough", emoji: "🎬" },

  // September
  { name: "Google Wave", month: 9, day: 30, year: 2010, category: "Google", desc: "이메일의 재발명. 아무도 이해하지 못했다.", epitaph: "We're still not sure what it was", emoji: "🌊" },
  { name: "Orkut", month: 9, day: 30, year: 2014, category: "Google", desc: "구글의 첫 소셜 네트워크. 브라질의 사랑을 받았다.", epitaph: "Saudade", emoji: "🤝" },

  // October
  { name: "Yahoo GeoCities", month: 10, day: 26, year: 2009, category: "Yahoo", desc: "개인 홈페이지 시대의 성지. ★Under Construction★", epitaph: "Under construction... forever", emoji: "🏠" },
  { name: "Windows Live Messenger", month: 10, day: 31, year: 2014, category: "Microsoft", desc: "MSN 메신저의 후계자. Skype에 합병당했다.", epitaph: "Nudge... nudge... goodbye", emoji: "🟡" },

  // November
  { name: "Heroku Free Tier", month: 11, day: 28, year: 2022, category: "Salesforce", desc: "학생과 사이드 프로젝트의 낙원. 잠 안 자도 됐었는데.", epitaph: "App sleeping... permanently", emoji: "☁️" },
  { name: "BlackBerry OS", month: 11, day: 14, year: 2022, category: "BlackBerry", desc: "키보드 폰의 전설. 보안의 상징이었다.", epitaph: "QWERTY, and gone", emoji: "⌨️" },

  // December
  { name: "Tumblr NSFW", month: 12, day: 17, year: 2018, category: "Verizon", desc: "Adult 콘텐츠 금지령. Tumblr의 영혼이 그날 떠났다.", epitaph: "Flagged for removal from existence", emoji: "🔞" },
  { name: "AIM (AOL Instant Messenger)", month: 12, day: 15, year: 2017, category: "AOL", desc: "인터넷 대화의 시작. 띵동 소리가 그립다.", epitaph: "brb... actually gone this time", emoji: "💬" },
  { name: "GitHub Atom", month: 12, day: 15, year: 2022, category: "GitHub", desc: "해킹 가능한 텍스트 에디터. VS Code에게 패배.", epitaph: "A hackable text editor, hacked to death", emoji: "⚛️" },
  { name: "Google Buzz", month: 12, day: 15, year: 2011, category: "Google", desc: "구글의 첫 소셜 미디어. Gmail에 강제 주입됐다가 삭제됨.", epitaph: "The only buzz it created was outrage", emoji: "🐝" },
  { name: "Flash", month: 12, day: 31, year: 2020, category: "Adobe", desc: "인터넷 엔터테인먼트의 황금기. Newgrounds의 시대.", epitaph: "This content requires Adobe Flash Player", emoji: "⚡" },
  { name: "Google Play Music", month: 12, day: 31, year: 2020, category: "Google", desc: "YouTube Music에 자리를 내어줬다. 더 나쁜 걸로.", epitaph: "Replaced by something worse", emoji: "🎵" },
  { name: "Rdio", month: 12, day: 22, year: 2015, category: "Independent", desc: "Spotify보다 좋았지만 사업은 더 못 했다.", epitaph: "Better than Spotify, worse at business", emoji: "🎧" },
  { name: "Quibi", month: 12, day: 1, year: 2020, category: "Independent", desc: "1.75조 원 증발. 모바일 영상 스트리밍의 대참사.", epitaph: "$1.75B raised. $0 in subscribers.", emoji: "📱" },
];

function TombstoneCard({ s, isToday }: { s: DeadService; isToday: boolean }) {
  return (
    <div className={`relative p-5 rounded-2xl border transition-all ${
      isToday
        ? 'border-amber-500/40 bg-amber-500/5 shadow-lg shadow-amber-500/10'
        : 'border-border/50 bg-muted/20 hover:bg-muted/40'
    }`}>
      {isToday && (
        <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest rounded-full">
          오늘의 장례식
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="text-3xl mt-0.5 select-none">{s.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <h3 className="font-black text-sm leading-tight">{s.name}</h3>
            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">{s.category}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
          <p className="text-[11px] italic text-muted-foreground/60 mt-2 border-t border-border/30 pt-2">"{s.epitaph}"</p>
          <p className="text-[10px] font-black text-muted-foreground/40 mt-1.5 uppercase tracking-widest">
            RIP · {s.year}.{String(s.month).padStart(2, '0')}.{String(s.day).padStart(2, '0')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Graveyard() {
  const [today, setToday] = useState<{ month: number; day: number } | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const now = new Date();
    setToday({ month: now.getMonth() + 1, day: now.getDate() });
  }, []);

  const { todayDeaths, rest } = useMemo(() => {
    if (!today) return { todayDeaths: [], rest: GRAVEYARD };
    const td = GRAVEYARD.filter(s => s.month === today.month && s.day === today.day);
    const r = GRAVEYARD.filter(s => !(s.month === today.month && s.day === today.day))
      .sort((a, b) => b.year - a.year);
    return { todayDeaths: td, rest: r };
  }, [today]);

  const filtered = useMemo(() => {
    if (!filter) return rest;
    const q = filter.toLowerCase();
    return rest.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q)
    );
  }, [rest, filter]);

  return (
    <div className="w-full space-y-6">
      <div className="text-center space-y-1 py-2">
        <p className="text-3xl">🪦</p>
        <h2 className="font-black uppercase tracking-tighter text-lg">Digital Cemetery</h2>
        <p className="text-xs text-muted-foreground">우리가 사랑했던 서비스들의 안식처</p>
      </div>

      {today && todayDeaths.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🕯️</span>
            <h3 className="font-black uppercase tracking-widest text-sm">
              {today.month}월 {today.day}일 장례식
            </h3>
            <span className="text-lg">🕯️</span>
          </div>
          {todayDeaths.map(s => (
            <TombstoneCard key={s.name + s.year} s={s} isToday />
          ))}
        </div>
      )}

      {today && todayDeaths.length === 0 && (
        <div className="text-center py-4 px-4 border border-border/30 rounded-2xl bg-muted/10">
          <p className="text-2xl mb-1">☮️</p>
          <p className="text-sm font-black">오늘은 장례식이 없습니다</p>
          <p className="text-xs text-muted-foreground mt-0.5">평화로운 하루입니다</p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground">In Memoriam</h3>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="검색..."
            className="h-7 px-3 text-xs bg-muted border border-border/50 rounded-lg outline-none focus:border-primary w-32 font-medium"
          />
        </div>
        <div className="space-y-2">
          {filtered.map(s => (
            <TombstoneCard key={s.name + s.year} s={s} isToday={false} />
          ))}
        </div>
      </div>
    </div>
  );
}
