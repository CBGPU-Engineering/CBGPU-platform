'use client';
import { useState, useEffect, useMemo } from 'react';

interface DeadService {
  name: string;
  month: number;
  day: number;
  year: number;
  born?: number;
  category: string;
  desc: string;
  epitaph: string;
  emoji: string;
}

const GRAVEYARD: DeadService[] = [
  // January
  { name: "Python 2",              month: 1,  day: 1,  year: 2020, born: 2000, category: "Python",        desc: "20년간 우리 곁을 지킨 언어. 마이그레이션 안 한 레거시 코드는 아직도 살아있다.",        epitaph: "print 'goodbye' — SyntaxError in Python 3",           emoji: "🐍" },
  { name: "Google Stadia",         month: 1,  day: 18, year: 2023, born: 2019, category: "Google",        desc: "클라우드 게이밍의 꿈. 하드웨어도 없이 도전하다 산화했다.",                               epitaph: "The input lag was the real killer",                    emoji: "🎮" },
  { name: "Google Glass Consumer", month: 1,  day: 19, year: 2015, born: 2013, category: "Google",        desc: "미래의 안경. 사람들은 Glass-hole이라 불렀고, 구글은 조용히 접었다.",                    epitaph: "The future looked different through these lenses",     emoji: "👓" },
  { name: "Parse",                 month: 1,  day: 28, year: 2017, born: 2011, category: "Facebook",      desc: "개발자들의 BaaS 성지. 페이스북이 인수 후 무료 서비스를 종료시켰다.",                    epitaph: "Parse this: you were great",                          emoji: "⚙️" },

  // February
  { name: "HipChat",               month: 2,  day: 15, year: 2019, born: 2010, category: "Atlassian",     desc: "Slack 이전의 팀 채팅 강자. Atlassian이 키워놓고 Slack에 팔아버렸다.",                   epitaph: "We were Slacking before Slack existed",               emoji: "💬" },
  { name: "Mailbox",               month: 2,  day: 26, year: 2016, born: 2013, category: "Dropbox",       desc: "스와이프로 inbox zero를 달성하던 혁명적 앱. Dropbox가 인수하고 조용히 묻었다.",         epitaph: "Swiped left for the very last time",                  emoji: "📬" },
  { name: "Twitch Korea",          month: 2,  day: 27, year: 2024, born: 2011, category: "Amazon",        desc: "망 사용료 폭탄을 버티지 못하고 한국 철수. 구독자들이 거리로 나왔다.",                   epitaph: "Network neutrality is not a given",                   emoji: "🎥" },

  // March
  { name: "Picasa",                month: 3,  day: 15, year: 2016, born: 2002, category: "Google",        desc: "구글 포토 이전의 사진 관리 왕. 14년을 버텼지만 구글에게 중복이었다.",                   epitaph: "A picture is worth a thousand memories",              emoji: "🖼️" },
  { name: "Google Allo",           month: 3,  day: 12, year: 2019, born: 2016, category: "Google",        desc: "Google Assistant 내장 메신저. 아무도 안 썼다. 3년만에 조용히 사라졌다.",               epitaph: "Smart messaging, dumb strategy",                      emoji: "💬" },
  { name: "goo.gl URL Shortener",  month: 3,  day: 30, year: 2019, born: 2009, category: "Google",        desc: "구글 단축 URL 서비스. bit.ly의 구글판. 조용히 신규 생성 중단.",                         epitaph: "Short in name, shorter in lifespan",                  emoji: "🔗" },
  { name: "Adobe Muse",            month: 3,  day: 26, year: 2020, born: 2012, category: "Adobe",         desc: "코딩 없이 웹사이트를 만들던 Adobe의 툴. 구독 경제가 단종시켰다.",                       epitaph: "No code, no future",                                  emoji: "🎨" },

  // April
  { name: "Google+",               month: 4,  day: 2,  year: 2019, born: 2011, category: "Google",        desc: "수십억 달러짜리 Facebook 도전. 보안 취약점이 쐐기를 박았다. +1 개 받음.",              epitaph: "+1 for effort",                                       emoji: "➕" },
  { name: "Google Inbox",          month: 4,  day: 2,  year: 2019, born: 2014, category: "Google",        desc: "이메일을 진짜로 재발명했다. Gmail 팀이 질투해서 죽였다는 설이 있다.",                   epitaph: "Inbox zero. Forever.",                                emoji: "📥" },
  { name: "Posterous",             month: 4,  day: 30, year: 2013, born: 2008, category: "Twitter",       desc: "이메일로 블로그 포스팅하던 플랫폼. 트위터 인수 후 방치됐다.",                           epitaph: "Posted its last post",                                emoji: "✍️" },
  { name: "Grooveshark",           month: 4,  day: 30, year: 2015, born: 2007, category: "Independent",   desc: "Spotify보다 먼저였다. 저작권 소송에 항복했다.",                                       epitaph: "The music played until the lawyers arrived",          emoji: "🦈" },
  { name: "CodeSchool",            month: 4,  day: 4,  year: 2019, born: 2010, category: "Pluralsight",   desc: "웹 개발 코딩 교육 플랫폼. Pluralsight에 인수되어 브랜드가 지워졌다.",                  epitaph: "class School extends RIP {}",                         emoji: "🏫" },

  // May
  { name: "Yahoo Answers",         month: 5,  day: 4,  year: 2021, born: 2005, category: "Yahoo",         desc: "인터넷 지식의 혼돈. How is babby formed? 영원히 답 없음.",                            epitaph: "How is babby formed? We'll never know.",              emoji: "❓" },
  { name: "Bintray / JCenter",     month: 5,  day: 1,  year: 2021, born: 2010, category: "JFrog",         desc: "Android 개발자 필수 Maven 저장소. 갑작스러운 종료 공지에 전 세계 빌드가 깨졌다.",     epitaph: "Could not resolve com.example:library:1.0.0",         emoji: "📦" },
  { name: "Skype",                 month: 5,  day: 5,  year: 2025, born: 2003, category: "Microsoft",     desc: "화상통화를 대중화했다. Zoom과 Teams에 잠식되어 22년만에 종료.",                        epitaph: "Can you hear me now? No.",                            emoji: "📞" },

  // June
  { name: "Yahoo Pipes",           month: 6,  day: 30, year: 2015, born: 2007, category: "Yahoo",         desc: "웹 데이터 파이프라인의 선구자. RSS와 API를 GUI로 조합하던 마법.",                      epitaph: "Piped to /dev/null",                                  emoji: "🔧" },
  { name: "Google Code",           month: 6,  day: 25, year: 2016, born: 2006, category: "Google",        desc: "GitHub 이전의 코드 호스팅. SVN과 Mercurial을 품었지만 GitHub에 졌다.",               epitaph: "GitHub was just better. Sorry.",                      emoji: "💻" },
  { name: "Internet Explorer",     month: 6,  day: 15, year: 2022, born: 1995, category: "Microsoft",     desc: "27년간 웹 개발자를 괴롭혔다. 최후의 IE를 기다리며 많은 CSS hack이 묻혔다.",          epitaph: "Please use a different browser to view this tombstone", emoji: "🌐" },
  { name: "Me2Day",                month: 6,  day: 30, year: 2014, born: 2007, category: "NHN",           desc: "한국의 트위터. 네이버가 인수 후 미투데이라 불렸다. 2천만 포스팅과 함께 문을 닫았다.", epitaph: "미투!", emoji: "🇰🇷" },
  { name: "Delicious",             month: 6,  day: 15, year: 2017, born: 2003, category: "AVOS",          desc: "소셜 북마크의 원조. Yahoo, AVOS를 거쳐 Pinboard에 흡수됐다.",                          epitaph: "Bookmarked for deletion",                             emoji: "🔖" },

  // July
  { name: "Google Reader",         month: 7,  day: 1,  year: 2013, born: 2005, category: "Google",        desc: "RSS 리더의 왕. 종료 발표 당일 온 인터넷이 울었다. 지금도 대안은 없다.",               epitaph: "You had us at 'mark all as read'",                    emoji: "📰" },

  // August
  { name: "Vine",                  month: 8,  day: 27, year: 2016, born: 2013, category: "Twitter",       desc: "6초 영상의 전설. TikTok의 아버지. 트위터가 방치해 스스로 죽었다.",                    epitaph: "6 seconds was never enough",                          emoji: "🎬" },
  { name: "Stack Overflow Docs",   month: 8,  day: 2,  year: 2017, born: 2016, category: "Stack Overflow",desc: "Stack Overflow의 문서화 실험. 1년만에 실패를 인정하고 철수했다.",                     epitaph: "Documentation: null",                                 emoji: "📚" },

  // September
  { name: "Google Wave",           month: 9,  day: 30, year: 2010, born: 2009, category: "Google",        desc: "이메일과 채팅의 재발명. 아무도 이해하지 못했다. 1년만에 사라졌다.",                    epitaph: "We're still not sure what it was",                    emoji: "🌊" },
  { name: "Orkut",                 month: 9,  day: 30, year: 2014, born: 2004, category: "Google",        desc: "구글의 첫 소셜 네트워크. 브라질 전체가 애도했다.",                                     epitaph: "Saudade",                                             emoji: "🤝" },
  { name: "BlackBerry Phones",     month: 9,  day: 28, year: 2016, born: 1999, category: "BlackBerry",    desc: "물리 키보드의 제왕. 보안의 상징이었다. 스마트폰 시대에 적응 실패.",                   epitaph: "QWERTY, and gone",                                    emoji: "⌨️" },

  // October
  { name: "Yahoo GeoCities",       month: 10, day: 26, year: 2009, born: 1994, category: "Yahoo",         desc: "개인 홈페이지의 성지. ★Under Construction★ 방문자 카운터 ★ 반짝이는 GIF ★",         epitaph: "Under construction... forever",                       emoji: "🏠" },
  { name: "Windows Live Messenger",month: 10, day: 31, year: 2014, born: 1999, category: "Microsoft",     desc: "MSN 메신저의 후계자. Nudge 기능이 그립다. Skype에 합병당해 죽었다.",                  epitaph: "Nudge... nudge... goodbye",                           emoji: "🟡" },
  { name: "Google Daydream VR",    month: 10, day: 15, year: 2019, born: 2016, category: "Google",        desc: "구글의 모바일 VR 플랫폼. 3년 만에 조용히 중단. 아무도 몰랐다.",                       epitaph: "Reality was just too competitive",                    emoji: "🥽" },
  { name: "Microsoft Band",        month: 10, day: 30, year: 2019, born: 2014, category: "Microsoft",     desc: "Microsoft의 스마트밴드. 센서는 많았지만 오래 못 갔다.",                               epitaph: "Heart rate: 0",                                       emoji: "⌚" },

  // November
  { name: "AIM (AOL Instant Messenger)", month: 11, day: 15, year: 2017, born: 1997, category: "AOL",    desc: "인터넷 메신저의 원조. 띵동 소리가 그립다. 20년 만에 영원히 자리를 비웠다.",             epitaph: "brb... actually gone this time",                      emoji: "🟠" },
  { name: "Heroku Free Tier",      month: 11, day: 28, year: 2022, born: 2010, category: "Salesforce",    desc: "학생과 사이드 프로젝트의 낙원. 30분 수면 dyno가 이제는 영원히 잠든다.",               epitaph: "App sleeping... permanently",                         emoji: "☁️" },
  { name: "Zune",                  month: 11, day: 15, year: 2015, born: 2006, category: "Microsoft",     desc: "iPod을 이기려던 Microsoft의 MP3 플레이어. '나는 갈고 싶은 사람이야' 광고가 걸작이었다.", epitaph: "Squirting files into the void",                      emoji: "🎵" },
  { name: "Silverlight",           month: 11, day: 12, year: 2021, born: 2007, category: "Microsoft",     desc: "Microsoft의 Flash 대항마. 넷플릭스가 버리자 존재이유가 사라졌다.",                    epitaph: "This content requires Microsoft Silverlight",         emoji: "🪨" },

  // December
  { name: "Tumblr NSFW",           month: 12, day: 17, year: 2018, born: 2007, category: "Verizon",       desc: "Adult 콘텐츠 금지령 발동. 그날 Tumblr의 영혼이 떠났다. 트래픽 80% 증발.",            epitaph: "Flagged for removal from existence",                  emoji: "🔞" },
  { name: "AIM",                   month: 12, day: 15, year: 2017, born: 1997, category: "AOL",           desc: "공식 종료일. 세대를 연결했던 메신저가 역사 속으로.",                                  epitaph: "BRB... for real this time",                           emoji: "💬" },
  { name: "GitHub Atom",           month: 12, day: 15, year: 2022, born: 2014, category: "GitHub",        desc: "Hackable text editor. VS Code에 완패. GitHub이 만들고 GitHub이 죽였다.",             epitaph: "A hackable text editor, hacked to death",             emoji: "⚛️" },
  { name: "Google Buzz",           month: 12, day: 15, year: 2011, born: 2010, category: "Google",        desc: "Gmail에 강제 주입된 소셜 미디어. 프라이버시 논란에 1년만에 철수.",                    epitaph: "The only buzz it created was outrage",                emoji: "🐝" },
  { name: "Flash",                 month: 12, day: 31, year: 2020, born: 1996, category: "Adobe",         desc: "24년간 인터넷 엔터테인먼트를 지배했다. Newgrounds, 뮤직비디오, 미니게임의 시대.",      epitaph: "This content requires Adobe Flash Player",            emoji: "⚡" },
  { name: "Google Play Music",     month: 12, day: 31, year: 2020, born: 2011, category: "Google",        desc: "YouTube Music으로 강제 이전됐다. 대부분은 더 나쁜 쪽으로 이주했다.",                  epitaph: "Replaced by something worse",                         emoji: "🎶" },
  { name: "Rdio",                  month: 12, day: 22, year: 2015, born: 2010, category: "Independent",   desc: "Spotify보다 UI가 좋았다. 디자인이 사업을 구해주진 못했다.",                           epitaph: "Better than Spotify, worse at business",             emoji: "🎧" },
  { name: "Quibi",                 month: 12, day: 1,  year: 2020, born: 2020, category: "Independent",   desc: "1.75조 원 투자, 186일 만에 폭망. 모바일 전용 스트리밍의 역대급 실패.",               epitaph: "$1.75B raised. $0 in subscribers.",                   emoji: "📱" },
  { name: "AngularJS",             month: 12, day: 31, year: 2021, born: 2010, category: "Google",        desc: "Angular(2+)에게 왕좌를 물려줬다. 11년간의 $scope와 $http를 추모한다.",              epitaph: "$scope.$broadcast('goodbye')",                        emoji: "🔴" },
  { name: "Pebble Smartwatch",     month: 12, day: 31, year: 2016, born: 2012, category: "Fitbit",        desc: "e-ink 스마트워치의 선구자. 킥스타터 신화를 만들었다. Fitbit에 인수되어 종료.",        epitaph: "Time ran out",                                        emoji: "⌚" },
  { name: "Google Code Jam",       month: 9,  day: 4,  year: 2023, born: 2003, category: "Google",        desc: "20년간 전 세계 개발자들이 경쟁했던 구글 코딩 대회. 채용 연계도 끊기고 폐지됐다.",    epitaph: "Wrong Answer — life.exe has stopped",                 emoji: "🏆" },
  { name: "Google Kick Start",     month: 11, day: 8,  year: 2023, born: 2013, category: "Google",        desc: "코드잼과 함께 폐지된 구글의 또 다른 코딩 대회. 취준생들의 이력서 한 줄이 사라졌다.", epitaph: "Compilation error: career not found",                  emoji: "🚀" },
  { name: "Twitter API Free Tier", month: 2,  day: 9,  year: 2023, born: 2006, category: "Elon Musk",     desc: "무료 API 종료. 수천 개의 봇, 알림 서비스, 연구 프로젝트가 하루아침에 죽었다.",        epitaph: "Error 402: Payment Required to tweet",                emoji: "🐦" },
  { name: "Visual Studio App Center", month: 3, day: 31, year: 2025, born: 2017, category: "Microsoft",  desc: "모바일 앱 CI/CD 플랫폼. 8년간 iOS/Android 빌드를 담당했다. Azure로 이전 강요.",     epitaph: "Build succeeded. Deployment: cancelled.",             emoji: "📲" },
  { name: "Windows Phone",         month: 12, day: 10, year: 2019, born: 2010, category: "Microsoft",     desc: "타일 UI의 혁신가. 앱 생태계 부재로 자멸했다. 시장점유율 0.1%.",                      epitaph: "Live tile: permanently frozen",                       emoji: "📱" },
  { name: "Firefox OS",            month: 1,  day: 26, year: 2016, born: 2013, category: "Mozilla",       desc: "개방형 웹 기술로 만든 모바일 OS. 스마트폰 시장의 현실에 무릎을 꿇었다.",             epitaph: "about:dead",                                          emoji: "🦊" },
  { name: "Google Fusion Tables",  month: 12, day: 3,  year: 2019, born: 2009, category: "Google",        desc: "데이터 시각화와 협업 스프레드시트의 선구자. 10년만에 조용히 종료.",                  epitaph: "Data not found",                                      emoji: "📊" },
];

// ─── Candle ──────────────────────────────────────────────────────────────────
function Candle({ delay = 0, size = 'md' }: { delay?: number; size?: 'sm' | 'md' | 'lg' }) {
  const scale = size === 'sm' ? 0.7 : size === 'lg' ? 1.3 : 1;
  return (
    <div className="flex flex-col items-center select-none" style={{ transform: `scale(${scale})` }}>
      {/* glow halo */}
      <div
        className="w-8 h-8 rounded-full -mb-6 blur-md"
        style={{
          background: 'radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 70%)',
          animation: `candle-glow ${1.8 + delay * 0.4}s ease-in-out infinite`,
          animationDelay: `${delay * 0.25}s`,
        }}
      />
      {/* flame */}
      <div
        className="w-3 h-6 rounded-t-full rounded-b-sm"
        style={{
          background: 'linear-gradient(to top, #b45309, #f59e0b, #fcd34d, #fef9c3)',
          animation: `candle-flicker ${1.4 + delay * 0.3}s ease-in-out infinite`,
          animationDelay: `${delay * 0.2}s`,
          transformOrigin: '50% 100%',
          boxShadow: '0 0 6px 2px rgba(251,191,36,0.5)',
        }}
      />
      {/* flame core */}
      <div className="w-1.5 h-3 -mt-3 rounded-t-full" style={{ background: 'rgba(255,255,240,0.85)' }} />
      {/* wick */}
      <div className="w-px h-2 bg-gray-500" />
      {/* body */}
      <div
        className="w-5 rounded-sm"
        style={{
          height: size === 'lg' ? 52 : 40,
          background: 'linear-gradient(to right, #e8e0d0 0%, #fafaf5 40%, #fafaf5 60%, #e8e0d0 100%)',
          boxShadow: '0 0 10px rgba(251,191,36,0.15)',
        }}
      >
        {/* wax drip */}
        <div className="w-1.5 h-3 mx-auto bg-amber-50/40 rounded-b-full" />
      </div>
      {/* base glow */}
      <div className="w-6 h-1 rounded-full blur-sm" style={{ background: 'rgba(251,191,36,0.2)' }} />
    </div>
  );
}

// ─── Memorial Portrait ───────────────────────────────────────────────────────
function MemorialPortrait({ service, size = 'md' }: { service: DeadService; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? { w: 220, h: 260, emoji: '6xl', inner: 16 } :
              size === 'sm' ? { w: 140, h: 170, emoji: '4xl', inner: 10 } :
                              { w: 180, h: 220, emoji: '5xl', inner: 12 };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Portrait frame */}
      <div
        className="relative rounded-sm"
        style={{
          width: dim.w, height: dim.h,
          background: 'linear-gradient(145deg, #1a1a1a, #2d2d2d, #1a1a1a)',
          padding: 8,
          boxShadow: '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* inner matte */}
        <div
          className="relative h-full w-full flex flex-col items-center justify-center gap-2 overflow-hidden rounded-sm"
          style={{
            background: 'linear-gradient(160deg, #2a2218, #1e1a12, #2a2218)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* vignette overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)',
          }} />
          {/* sepia tint */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(80,50,10,0.12)' }} />

          {/* emoji "photo" */}
          <span
            className="relative z-10 select-none drop-shadow-lg"
            style={{ fontSize: size === 'lg' ? '3.5rem' : size === 'sm' ? '2.5rem' : '3rem', filter: 'sepia(20%)' }}
          >
            {service.emoji}
          </span>

          {/* name inside photo */}
          <div className="relative z-10 text-center px-2">
            <p className="text-white/90 font-black text-[11px] leading-tight" style={{ fontFamily: 'serif', letterSpacing: '0.05em' }}>
              {service.name}
            </p>
            <p className="text-amber-300/60 text-[9px] mt-0.5">
              {service.born ?? '??'} — {service.year}
            </p>
          </div>

          {/* corner ornaments */}
          <div className="absolute top-1 left-1 w-3 h-3 border-gray-600/40" style={{ borderWidth: '1px 0 0 1px' }} />
          <div className="absolute top-1 right-1 w-3 h-3 border-gray-600/40" style={{ borderWidth: '1px 1px 0 0' }} />
          <div className="absolute bottom-1 left-1 w-3 h-3 border-gray-600/40" style={{ borderWidth: '0 0 1px 1px' }} />
          <div className="absolute bottom-1 right-1 w-3 h-3 border-gray-600/40" style={{ borderWidth: '0 1px 1px 0' }} />
        </div>
      </div>

      {/* nameplate */}
      <div
        className="px-5 py-1.5 rounded-sm text-center"
        style={{
          background: 'linear-gradient(to bottom, #2d2418, #1e180e)',
          border: '1px solid rgba(180,140,60,0.3)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <p className="text-amber-200/90 font-black text-xs tracking-widest uppercase" style={{ fontFamily: 'serif' }}>
          {service.name}
        </p>
        <p className="text-amber-700/70 text-[9px] mt-0.5 font-medium">
          {service.month}.{String(service.day).padStart(2,'0')}.{service.year}
        </p>
      </div>

      {/* candles */}
      <div className="flex items-end gap-10 mt-1">
        <Candle delay={0} size={size} />
        <Candle delay={1} size={size} />
      </div>
    </div>
  );
}

// ─── TombstoneCard ────────────────────────────────────────────────────────────
function TombstoneCard({ s, featured }: { s: DeadService; featured?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`rounded-2xl border transition-all ${featured
        ? 'border-amber-500/30 bg-amber-500/5 shadow-md'
        : 'border-border/40 bg-muted/10 hover:bg-muted/30 cursor-pointer'
      }`}
      onClick={!featured ? () => setOpen(o => !o) : undefined}
    >
      <div className="p-4 flex items-start gap-3">
        <span className="text-2xl mt-0.5 select-none shrink-0">{s.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <h3 className="font-black text-sm leading-tight">{s.name}</h3>
            <span className="text-[9px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">{s.category}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
          <p className="text-[11px] italic text-muted-foreground/50 mt-2 border-t border-border/30 pt-1.5">"{s.epitaph}"</p>
          <p className="text-[10px] font-black text-muted-foreground/35 mt-1 uppercase tracking-widest">
            RIP · {s.year}.{String(s.month).padStart(2,'0')}.{String(s.day).padStart(2,'0')}
            {s.born ? ` · ${s.year - s.born}년 생애` : ''}
          </p>
        </div>
        {!featured && (
          <span className="text-muted-foreground/40 text-xs shrink-0 mt-1 select-none">{open ? '▲' : '▼'}</span>
        )}
      </div>

      {/* expandable portrait (non-featured) */}
      {!featured && open && (
        <div className="px-4 pb-6 flex justify-center border-t border-border/20 pt-6">
          <MemorialPortrait service={s} size="sm" />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Graveyard() {
  const [today, setToday] = useState<{ month: number; day: number } | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const d = new Date();
    setToday({ month: d.getMonth() + 1, day: d.getDate() });
  }, []);

  const { featured, rest } = useMemo(() => {
    const sorted = [...GRAVEYARD].sort((a, b) =>
      new Date(b.year, b.month - 1, b.day).getTime() - new Date(a.year, a.month - 1, a.day).getTime()
    );

    if (!today) return { featured: [], rest: sorted };

    const todayMatches = sorted.filter(s => s.month === today.month && s.day === today.day);

    if (todayMatches.length > 0) {
      const restItems = sorted.filter(s => !(s.month === today.month && s.day === today.day));
      return { featured: todayMatches, rest: restItems };
    }

    // No exact match — show the most recently dead service as featured
    return { featured: [sorted[0]], rest: sorted.slice(1) };
  }, [today]);

  const isTodayMatch = today != null && featured.length > 0
    && featured[0].month === today.month && featured[0].day === today.day;

  const filtered = useMemo(() => {
    if (!filter) return rest;
    const q = filter.toLowerCase();
    return rest.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q) ||
      String(s.year).includes(q)
    );
  }, [rest, filter]);

  return (
    <div className="w-full space-y-8">

      {/* header */}
      <div className="text-center space-y-1.5 py-2">
        <p className="text-4xl select-none">🪦</p>
        <h2 className="font-black uppercase tracking-tighter text-xl">Digital Cemetery</h2>
        <p className="text-xs text-muted-foreground font-medium">우리가 사랑했던 서비스들의 안식처 · {GRAVEYARD.length}위 안장</p>
      </div>

      {/* featured section */}
      {featured.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl select-none">🕯️</span>
            <h3 className="font-black uppercase tracking-widest text-sm text-center">
              {isTodayMatch
                ? `${today!.month}월 ${today!.day}일 — 오늘의 장례식`
                : '가장 최근에 떠난 서비스'}
            </h3>
            <span className="text-xl select-none">🕯️</span>
          </div>

          {/* portrait altar */}
          <div className="flex flex-col items-center gap-6 py-8 px-4 rounded-3xl border border-border/30 bg-gradient-to-b from-muted/5 to-muted/20">
            <div className={`flex gap-8 flex-wrap justify-center`}>
              {featured.map(s => (
                <MemorialPortrait key={s.name + s.year} service={s} size={featured.length === 1 ? 'lg' : 'md'} />
              ))}
            </div>
            {featured.map(s => (
              <div key={s.name + s.year + 'card'} className="w-full max-w-lg">
                <TombstoneCard s={s} featured />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* rest */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground flex items-center gap-1.5">
            <span>In Memoriam</span>
            <span className="font-medium opacity-50">({filtered.length})</span>
          </h3>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="검색..."
            className="h-7 px-3 text-xs bg-muted border border-border/50 rounded-lg outline-none focus:border-primary w-28 font-medium"
          />
        </div>
        <p className="text-[10px] text-muted-foreground/50 font-medium">▼ 클릭하면 영정사진을 볼 수 있습니다</p>
        <div className="space-y-2">
          {filtered.map(s => (
            <TombstoneCard key={s.name + s.year} s={s} />
          ))}
        </div>
      </div>
    </div>
  );
}
