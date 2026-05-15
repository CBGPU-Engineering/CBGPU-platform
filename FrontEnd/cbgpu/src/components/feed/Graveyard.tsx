'use client';
import { useState, useEffect, useMemo } from 'react';

// ─── types ────────────────────────────────────────────────────────────────────
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
  domain: string;
}

// ─── data ─────────────────────────────────────────────────────────────────────
const GRAVEYARD: DeadService[] = [
  // January
  { name:"Python 2",              month:1,  day:1,  year:2020, born:2000, category:"Python",         desc:"20년간 우리 곁을 지킨 언어. 마이그레이션 안 한 레거시 코드는 아직도 운다.",          epitaph:"print 'goodbye'  ←  SyntaxError in Python 3",      emoji:"🐍", domain:"python.org" },
  { name:"Google Stadia",         month:1,  day:18, year:2023, born:2019, category:"Google",          desc:"클라우드 게이밍의 꿈. 하드웨어도 없이 도전하다 산화했다.",                            epitaph:"The input lag was the real killer",                  emoji:"🎮", domain:"google.com" },
  { name:"Google Glass Consumer", month:1,  day:19, year:2015, born:2013, category:"Google",          desc:"미래의 안경. 사람들은 Glass-hole이라 불렀고, 구글은 조용히 접었다.",                  epitaph:"The future looked different through these lenses",   emoji:"👓", domain:"google.com" },
  { name:"Parse",                 month:1,  day:28, year:2017, born:2011, category:"Facebook",        desc:"개발자들의 BaaS 성지. 페이스북이 인수 후 무료 서비스를 종료시켰다.",                  epitaph:"Parse this: you were great",                         emoji:"⚙️", domain:"back4app.com" },
  { name:"Firefox OS",            month:1,  day:26, year:2016, born:2013, category:"Mozilla",         desc:"개방형 웹 기술로 만든 모바일 OS. 스마트폰 시장의 현실에 무릎을 꿇었다.",             epitaph:"about:dead",                                         emoji:"🦊", domain:"mozilla.org" },
  // February
  { name:"HipChat",               month:2,  day:15, year:2019, born:2010, category:"Atlassian",       desc:"Slack 이전의 팀 채팅 강자. Atlassian이 키워놓고 Slack에 팔아버렸다.",                epitaph:"We were Slacking before Slack existed",              emoji:"💬", domain:"atlassian.com" },
  { name:"Mailbox",               month:2,  day:26, year:2016, born:2013, category:"Dropbox",         desc:"스와이프로 inbox zero를 달성하던 혁명적 앱. Dropbox가 인수하고 조용히 묻었다.",       epitaph:"Swiped left for the very last time",                 emoji:"📬", domain:"dropbox.com" },
  { name:"Twitter API Free Tier", month:2,  day:9,  year:2023, born:2006, category:"Elon Musk",       desc:"무료 API 종료. 수천 개의 봇, 알림 서비스, 연구 프로젝트가 하루아침에 죽었다.",        epitaph:"Error 402: Payment Required to tweet",               emoji:"🐦", domain:"x.com" },
  { name:"Twitch Korea",          month:2,  day:27, year:2024, born:2011, category:"Amazon",          desc:"망 사용료 폭탄을 버티지 못하고 한국 철수. 구독자들이 거리로 나왔다.",                 epitaph:"Network neutrality is not a given",                  emoji:"🎥", domain:"twitch.tv" },
  // March
  { name:"Picasa",                month:3,  day:15, year:2016, born:2002, category:"Google",          desc:"구글 포토 이전의 사진 관리 왕. 14년을 버텼지만 구글에게 중복이었다.",                 epitaph:"A picture is worth a thousand memories",             emoji:"🖼️", domain:"google.com" },
  { name:"Google Allo",           month:3,  day:12, year:2019, born:2016, category:"Google",          desc:"Google Assistant 내장 메신저. 아무도 안 썼다. 3년만에 조용히 사라졌다.",             epitaph:"Smart messaging, dumb strategy",                     emoji:"💬", domain:"google.com" },
  { name:"goo.gl URL Shortener",  month:3,  day:30, year:2019, born:2009, category:"Google",          desc:"구글 단축 URL 서비스. 신규 생성 중단 → 완전 폐쇄.",                                 epitaph:"Short in name, shorter in lifespan",                 emoji:"🔗", domain:"google.com" },
  { name:"Adobe Muse",            month:3,  day:26, year:2020, born:2012, category:"Adobe",           desc:"코딩 없이 웹사이트를 만들던 Adobe의 툴. 구독 경제가 단종시켰다.",                     epitaph:"No code, no future",                                 emoji:"🎨", domain:"adobe.com" },
  // April
  { name:"Google+",               month:4,  day:2,  year:2019, born:2011, category:"Google",          desc:"수십억 달러짜리 Facebook 도전. 보안 취약점이 쐐기를 박았다. +1 개 받음.",            epitaph:"+1 for effort",                                      emoji:"➕", domain:"google.com" },
  { name:"Google Inbox",          month:4,  day:2,  year:2019, born:2014, category:"Google",          desc:"이메일을 진짜로 재발명했다. Gmail 팀이 질투해서 죽였다는 설이 있다.",                 epitaph:"Inbox zero. Forever.",                               emoji:"📥", domain:"google.com" },
  { name:"Posterous",             month:4,  day:30, year:2013, born:2008, category:"Twitter",         desc:"이메일로 블로그 포스팅하던 플랫폼. 트위터 인수 후 방치됐다.",                         epitaph:"Posted its last post",                               emoji:"✍️", domain:"twitter.com" },
  { name:"Grooveshark",           month:4,  day:30, year:2015, born:2007, category:"Independent",     desc:"Spotify보다 먼저였다. 저작권 소송에 항복했다.",                                     epitaph:"The music played until the lawyers arrived",         emoji:"🦈", domain:"grooveshark.com" },
  { name:"Adobe Brackets",        month:4,  day:1,  year:2021, born:2012, category:"Adobe",           desc:"Adobe가 만든 오픈소스 웹 에디터. VS Code에 무릎을 꿇고 아카이브됐다.",               epitaph:"{ code: 'was_beautiful', status: 'archived' }",      emoji:"✏️", domain:"adobe.com" },
  // May
  { name:"Yahoo Answers",         month:5,  day:4,  year:2021, born:2005, category:"Yahoo",           desc:"인터넷 지식의 혼돈. How is babby formed? 영원히 답 없음.",                          epitaph:"How is babby formed? We'll never know.",             emoji:"❓", domain:"yahoo.com" },
  { name:"Bintray / JCenter",     month:5,  day:1,  year:2021, born:2010, category:"JFrog",           desc:"Android 개발자 필수 Maven 저장소. 갑작스러운 종료 공지에 전 세계 빌드가 깨졌다.",   epitaph:"Could not resolve com.example:library:1.0.0",        emoji:"📦", domain:"jfrog.com" },
  { name:"Daum 마이피플",          month:5,  day:1,  year:2015, born:2010, category:"Daum/카카오",     desc:"카카오톡 이전 국민 메신저 후보. 카카오에 완패하고 서비스를 접었다.",                   epitaph:"마이피플이 사라졌습니다",                              emoji:"🇰🇷", domain:"daum.net" },
  { name:"Skype",                 month:5,  day:5,  year:2025, born:2003, category:"Microsoft",       desc:"화상통화를 대중화했다. Zoom과 Teams에 잠식되어 22년만에 종료.",                      epitaph:"Can you hear me now? No.",                           emoji:"📞", domain:"skype.com" },
  // June
  { name:"Yahoo Pipes",           month:6,  day:30, year:2015, born:2007, category:"Yahoo",           desc:"웹 데이터 파이프라인의 선구자. RSS와 API를 GUI로 조합하던 마법.",                    epitaph:"Piped to /dev/null",                                 emoji:"🔧", domain:"yahoo.com" },
  { name:"Google Code",           month:6,  day:25, year:2016, born:2006, category:"Google",          desc:"GitHub 이전의 코드 호스팅. SVN과 Mercurial을 품었지만 GitHub에 졌다.",             epitaph:"GitHub was just better. Sorry.",                     emoji:"💻", domain:"google.com" },
  { name:"Internet Explorer",     month:6,  day:15, year:2022, born:1995, category:"Microsoft",       desc:"27년간 웹 개발자를 괴롭혔다. 최후의 IE를 기다리며 많은 CSS hack이 묻혔다.",          epitaph:"Please use a different browser to view this tombstone", emoji:"🌐", domain:"microsoft.com" },
  { name:"Me2Day",                month:6,  day:30, year:2014, born:2007, category:"NHN",             desc:"한국의 트위터. 네이버가 인수 후 미투데이라 불렸다. 2천만 포스팅과 함께 문을 닫았다.", epitaph:"미투!",                                               emoji:"🇰🇷", domain:"naver.com" },
  { name:"Delicious",             month:6,  day:15, year:2017, born:2003, category:"AVOS",            desc:"소셜 북마크의 원조. Yahoo, AVOS를 거쳐 Pinboard에 흡수됐다.",                        epitaph:"Bookmarked for deletion",                            emoji:"🔖", domain:"del.icio.us" },
  // July
  { name:"Google Reader",         month:7,  day:1,  year:2013, born:2005, category:"Google",          desc:"RSS 리더의 왕. 종료 발표 당일 온 인터넷이 울었다. 지금도 대안은 없다.",             epitaph:"You had us at 'mark all as read'",                   emoji:"📰", domain:"google.com" },
  // August
  { name:"Vine",                  month:8,  day:27, year:2016, born:2013, category:"Twitter",         desc:"6초 영상의 전설. TikTok의 아버지. 트위터가 방치해 스스로 죽었다.",                  epitaph:"6 seconds was never enough",                         emoji:"🎬", domain:"twitter.com" },
  { name:"Stack Overflow Docs",   month:8,  day:2,  year:2017, born:2016, category:"Stack Overflow",  desc:"Stack Overflow의 문서화 실험. 1년만에 실패를 인정하고 철수했다.",                   epitaph:"Documentation: null",                               emoji:"📚", domain:"stackoverflow.com" },
  // September
  { name:"Google Wave",           month:9,  day:30, year:2010, born:2009, category:"Google",          desc:"이메일과 채팅의 재발명. 아무도 이해하지 못했다. 1년만에 사라졌다.",                  epitaph:"We're still not sure what it was",                   emoji:"🌊", domain:"google.com" },
  { name:"Orkut",                 month:9,  day:30, year:2014, born:2004, category:"Google",          desc:"구글의 첫 소셜 네트워크. 브라질 전체가 애도했다.",                                   epitaph:"Saudade",                                            emoji:"🤝", domain:"google.com" },
  { name:"BlackBerry Phones",     month:9,  day:28, year:2016, born:1999, category:"BlackBerry",      desc:"물리 키보드의 제왕. 보안의 상징이었다. 스마트폰 시대에 적응 실패.",                 epitaph:"QWERTY, and gone",                                   emoji:"⌨️", domain:"blackberry.com" },
  { name:"Google Code Jam",       month:9,  day:4,  year:2023, born:2003, category:"Google",          desc:"20년간 전 세계 개발자들이 경쟁했던 구글 코딩 대회. 채용 연계도 끊기고 폐지됐다.",   epitaph:"Wrong Answer — life.exe has stopped",               emoji:"🏆", domain:"google.com" },
  // October
  { name:"Yahoo GeoCities",       month:10, day:26, year:2009, born:1994, category:"Yahoo",           desc:"개인 홈페이지의 성지. ★Under Construction★ 방문자 카운터 ★ 반짝이는 GIF ★",       epitaph:"Under construction... forever",                      emoji:"🏠", domain:"yahoo.com" },
  { name:"Windows Live Messenger",month:10, day:31, year:2014, born:1999, category:"Microsoft",       desc:"MSN 메신저의 후계자. Nudge 기능이 그립다. Skype에 합병당해 죽었다.",               epitaph:"Nudge... nudge... goodbye",                          emoji:"🟡", domain:"microsoft.com" },
  { name:"Google Daydream VR",    month:10, day:15, year:2019, born:2016, category:"Google",          desc:"구글의 모바일 VR 플랫폼. 3년 만에 조용히 중단. 아무도 몰랐다.",                     epitaph:"Reality was just too competitive",                   emoji:"🥽", domain:"google.com" },
  { name:"Microsoft Band",        month:10, day:30, year:2019, born:2014, category:"Microsoft",       desc:"Microsoft의 스마트밴드. 센서는 많았지만 오래 못 갔다.",                             epitaph:"Heart rate: 0",                                      emoji:"⌚", domain:"microsoft.com" },
  // November
  { name:"AIM",                   month:11, day:15, year:2017, born:1997, category:"AOL",             desc:"인터넷 메신저의 원조. 띵동 소리가 그립다. 20년 만에 영원히 자리를 비웠다.",         epitaph:"brb... actually gone this time",                     emoji:"🟠", domain:"aol.com" },
  { name:"Heroku Free Tier",      month:11, day:28, year:2022, born:2010, category:"Salesforce",      desc:"학생과 사이드 프로젝트의 낙원. 30분 수면 dyno가 이제는 영원히 잠든다.",             epitaph:"App sleeping... permanently",                        emoji:"☁️", domain:"heroku.com" },
  { name:"Zune",                  month:11, day:15, year:2015, born:2006, category:"Microsoft",       desc:"iPod을 이기려던 Microsoft의 MP3 플레이어. '뮤직 니즈 어 소울' 광고가 걸작이었다.", epitaph:"Squirting files into the void",                      emoji:"🎵", domain:"microsoft.com" },
  { name:"Silverlight",           month:11, day:12, year:2021, born:2007, category:"Microsoft",       desc:"Microsoft의 Flash 대항마. 넷플릭스가 버리자 존재이유가 사라졌다.",                  epitaph:"This content requires Microsoft Silverlight",        emoji:"🪨", domain:"microsoft.com" },
  { name:"Google Kick Start",     month:11, day:8,  year:2023, born:2013, category:"Google",          desc:"코드잼과 함께 폐지된 구글의 또 다른 코딩 대회. 취준생들의 이력서 한 줄이 사라졌다.", epitaph:"Compilation error: career not found",               emoji:"🚀", domain:"google.com" },
  // December
  { name:"Tumblr NSFW",           month:12, day:17, year:2018, born:2007, category:"Verizon",         desc:"Adult 콘텐츠 금지령 발동. 그날 Tumblr의 영혼이 떠났다. 트래픽 80% 증발.",          epitaph:"Flagged for removal from existence",                 emoji:"🔞", domain:"tumblr.com" },
  { name:"GitHub Atom",           month:12, day:15, year:2022, born:2014, category:"GitHub",          desc:"Hackable text editor. VS Code에 완패. GitHub이 만들고 GitHub이 죽였다.",           epitaph:"A hackable text editor, hacked to death",            emoji:"⚛️", domain:"atom.io" },
  { name:"Google Buzz",           month:12, day:15, year:2011, born:2010, category:"Google",          desc:"Gmail에 강제 주입된 소셜 미디어. 프라이버시 논란에 1년만에 철수.",                  epitaph:"The only buzz it created was outrage",               emoji:"🐝", domain:"google.com" },
  { name:"AIM (Final)",           month:12, day:15, year:2017, born:1997, category:"AOL",             desc:"공식 종료일. 세대를 연결했던 메신저가 역사 속으로.",                                epitaph:"BRB... for real this time",                          emoji:"💬", domain:"aol.com" },
  { name:"Flash",                 month:12, day:31, year:2020, born:1996, category:"Adobe",           desc:"24년간 인터넷 엔터테인먼트를 지배했다. Newgrounds, 뮤직비디오, 미니게임의 시대.",    epitaph:"This content requires Adobe Flash Player",           emoji:"⚡", domain:"adobe.com" },
  { name:"Google Play Music",     month:12, day:31, year:2020, born:2011, category:"Google",          desc:"YouTube Music으로 강제 이전됐다. 대부분은 더 나쁜 쪽으로 이주했다.",               epitaph:"Replaced by something worse",                        emoji:"🎶", domain:"google.com" },
  { name:"Rdio",                  month:12, day:22, year:2015, born:2010, category:"Independent",     desc:"Spotify보다 UI가 좋았다. 디자인이 사업을 구해주진 못했다.",                         epitaph:"Better than Spotify, worse at business",            emoji:"🎧", domain:"rdio.com" },
  { name:"Quibi",                 month:12, day:1,  year:2020, born:2020, category:"Independent",     desc:"1.75조 원 투자, 186일 만에 폭망. 모바일 전용 스트리밍의 역대급 실패.",             epitaph:"$1.75B raised. $0 in subscribers.",                  emoji:"📱", domain:"quibi.com" },
  { name:"AngularJS",             month:12, day:31, year:2021, born:2010, category:"Google",          desc:"Angular(2+)에게 왕좌를 물려줬다. 11년간의 $scope와 $http를 추모한다.",             epitaph:"$scope.$broadcast('goodbye')",                       emoji:"🔴", domain:"angularjs.org" },
  { name:"Windows Phone",         month:12, day:10, year:2019, born:2010, category:"Microsoft",       desc:"타일 UI의 혁신가. 앱 생태계 부재로 자멸했다. 시장점유율 0.1%.",                    epitaph:"Live tile: permanently frozen",                      emoji:"📱", domain:"microsoft.com" },
  { name:"Visual Studio App Center", month:3, day:31, year:2025, born:2017, category:"Microsoft",    desc:"모바일 앱 CI/CD 플랫폼. 8년간 iOS/Android 빌드를 담당했다. Azure로 강제 이전.",    epitaph:"Build succeeded. Deployment: cancelled.",            emoji:"📲", domain:"microsoft.com" },
];

// ─── LogoImage ────────────────────────────────────────────────────────────────
function LogoImage({ domain, emoji, alt, size }: { domain: string; emoji: string; alt: string; size: number }) {
  const [src, setSrc] = useState(`https://logo.clearbit.com/${domain}`);
  const [step, setStep] = useState(0); // 0=clearbit, 1=favicon, 2=emoji

  const handleError = () => {
    if (step === 0) {
      setSrc(`https://www.google.com/s2/favicons?domain=${domain}&sz=256`);
      setStep(1);
    } else {
      setStep(2);
    }
  };

  if (step === 2) {
    return (
      <span style={{ fontSize: size * 0.5 }} className="select-none">
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={handleError}
      style={{
        width: size, height: size,
        objectFit: 'contain',
        filter: 'sepia(15%) brightness(0.95)',
        borderRadius: 4,
      }}
    />
  );
}

// ─── Candle ───────────────────────────────────────────────────────────────────
function Candle({ delay = 0, h = 44 }: { delay?: number; h?: number }) {
  return (
    <div className="flex flex-col items-center select-none">
      {/* glow halo */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', marginBottom: -16,
        background: 'radial-gradient(circle, rgba(251,191,36,0.55) 0%, transparent 70%)',
        animation: `candle-glow ${1.9 + delay * 0.4}s ease-in-out infinite`,
        animationDelay: `${delay * 0.25}s`,
      }} />
      {/* flame */}
      <div style={{
        width: 10, height: 20,
        background: 'linear-gradient(to top, #92400e, #f59e0b, #fcd34d, #fef9c3)',
        borderRadius: '50% 50% 30% 30%',
        boxShadow: '0 0 8px 3px rgba(251,191,36,0.45)',
        animation: `candle-flicker ${1.4 + delay * 0.35}s ease-in-out infinite`,
        animationDelay: `${delay * 0.2}s`,
        transformOrigin: '50% 100%',
      }} />
      {/* core */}
      <div style={{ width: 5, height: 11, marginTop: -10, borderRadius: '50% 50% 20% 20%', background: 'rgba(255,255,240,0.8)' }} />
      {/* wick */}
      <div style={{ width: 1, height: 6, background: '#78716c' }} />
      {/* body */}
      <div style={{
        width: 16, height: h, borderRadius: 2,
        background: 'linear-gradient(to right, #e7e0d4 0%, #fafaf5 38%, #fafaf5 62%, #e7e0d4 100%)',
        boxShadow: '0 0 10px rgba(251,191,36,0.12)',
      }}>
        <div style={{ width: 6, height: 10, margin: '3px auto 0', background: 'rgba(251,200,100,0.2)', borderRadius: '0 0 50% 50%' }} />
      </div>
      <div style={{ width: 20, height: 4, borderRadius: '50%', background: 'rgba(251,191,36,0.15)', filter: 'blur(3px)' }} />
    </div>
  );
}

// ─── IncenseStick ─────────────────────────────────────────────────────────────
function IncenseStick({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex flex-col items-center select-none" style={{ marginTop: -8 }}>
      {/* smoke particles */}
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          width: 4, height: 4, borderRadius: '50%',
          background: 'rgba(200,200,180,0.5)',
          animation: `smoke-rise ${1.2 + i * 0.4}s ease-out infinite`,
          animationDelay: `${delay * 0.3 + i * 0.35}s`,
          marginBottom: 1,
        }} />
      ))}
      {/* stick */}
      <div style={{
        width: 2, height: 48,
        background: 'linear-gradient(to bottom, #92400e, #d97706, #78350f)',
        borderRadius: 1,
        animation: `incense-float ${2.5 + delay * 0.5}s ease-in-out infinite`,
        animationDelay: `${delay * 0.3}s`,
      }} />
      <div style={{ width: 8, height: 6, borderRadius: '50%', background: 'rgba(120,80,30,0.4)' }} />
    </div>
  );
}

// ─── MemorialPortrait ─────────────────────────────────────────────────────────
function MemorialPortrait({ s, large = false }: { s: DeadService; large?: boolean }) {
  const fw = large ? 200 : 160;
  const fh = large ? 250 : 200;
  const logoSize = large ? 96 : 76;

  return (
    <div className="flex flex-col items-center" style={{ gap: 10 }}>
      {/* outer frame */}
      <div style={{
        width: fw, height: fh,
        background: 'linear-gradient(145deg, #111, #1e1e1e, #111)',
        padding: 7,
        borderRadius: 4,
        boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        position: 'relative',
        flexShrink: 0,
      }}>
        {/* photo area */}
        <div style={{
          height: '100%', width: '100%',
          background: 'linear-gradient(160deg, #241e14, #1a1510, #241e14)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 2,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 8, overflow: 'hidden', position: 'relative',
        }}>
          {/* vignette */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.6) 100%)',
          }} />
          {/* sepia wash */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(60,35,5,0.1)', pointerEvents: 'none' }} />

          {/* logo */}
          <div style={{ position: 'relative', zIndex: 10 }}>
            <LogoImage domain={s.domain} emoji={s.emoji} alt={s.name} size={logoSize} />
          </div>

          {/* name + year inside photo */}
          <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '0 8px' }}>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: 900, fontFamily: 'serif', letterSpacing: '0.06em', lineHeight: 1.2 }}>
              {s.name}
            </p>
            <p style={{ color: 'rgba(180,150,80,0.65)', fontSize: 9, marginTop: 3 }}>
              {s.born ?? '??'} — {s.year}
            </p>
          </div>

          {/* corner ornaments */}
          {[
            { top: 4, left: 4, bt: '1px 0 0 1px' },
            { top: 4, right: 4, bt: '1px 1px 0 0' },
            { bottom: 4, left: 4, bt: '0 0 1px 1px' },
            { bottom: 4, right: 4, bt: '0 1px 1px 0' },
          ].map((c, i) => (
            <div key={i} style={{
              position: 'absolute', width: 10, height: 10,
              border: 'solid rgba(180,150,80,0.25)',
              borderWidth: c.bt,
              top: c.top, left: c.left, right: c.right, bottom: c.bottom,
            }} />
          ))}

          {/* ─── black mourning ribbon ─── */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 20, borderRadius: 2 }}>
            <div style={{
              position: 'absolute',
              width: '160%', height: 14,
              background: 'rgba(0,0,0,0.88)',
              top: '40%', left: '-30%',
              transform: 'rotate(-42deg)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }} />
            {/* thin gold stripe on ribbon */}
            <div style={{
              position: 'absolute',
              width: '160%', height: 1,
              background: 'rgba(180,150,60,0.3)',
              top: 'calc(40% + 5px)', left: '-30%',
              transform: 'rotate(-42deg)',
            }} />
          </div>
        </div>
      </div>

      {/* nameplate */}
      <div style={{
        padding: '5px 16px',
        background: 'linear-gradient(to bottom, #2a2010, #1a1508)',
        border: '1px solid rgba(180,150,60,0.25)',
        borderRadius: 2,
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}>
        <p style={{ color: 'rgba(220,185,100,0.9)', fontSize: 11, fontWeight: 900, fontFamily: 'serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {s.name}
        </p>
        <p style={{ color: 'rgba(150,120,60,0.65)', fontSize: 9, marginTop: 2, letterSpacing: '0.05em' }}>
          {String(s.month).padStart(2,'0')}.{String(s.day).padStart(2,'0')}.{s.year}
        </p>
      </div>
    </div>
  );
}

// ─── FuneralAltar ─────────────────────────────────────────────────────────────
function FuneralAltar({ services, label }: { services: DeadService[]; label: string }) {
  return (
    <div style={{
      background: 'linear-gradient(to bottom, #0a0a0a, #0f0d09, #0a0a0a)',
      border: '1px solid rgba(180,150,60,0.15)',
      borderRadius: 20,
      padding: '28px 20px 32px',
    }}>
      {/* altar header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span style={{ color: 'rgba(180,150,60,0.5)', fontSize: 10 }}>✦ ✦ ✦</span>
        </div>
        <h3 style={{
          color: 'rgba(220,185,100,0.85)',          fontSize: 13, fontWeight: 900, letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>
          {label}
        </h3>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span style={{ color: 'rgba(180,150,60,0.5)', fontSize: 10 }}>✦ ✦ ✦</span>
        </div>
      </div>

      {/* flower decoration */}
      <div className="flex justify-center gap-1 mb-5 select-none">
        {'🌸🌸🌸🌺🌸🌸🌸'.split('').map((f, i) => (
          <span key={i} style={{ fontSize: 16, opacity: i === 3 ? 1 : 0.7 }}>{f}</span>
        ))}
      </div>

      {/* portraits row */}
      <div className="flex justify-center gap-8 flex-wrap">
        {services.map(s => (
          <MemorialPortrait key={s.name + s.year} s={s} large={services.length === 1} />
        ))}
      </div>

      {/* incense + candles row */}
      <div className="flex items-end justify-center gap-6 mt-6">
        <Candle delay={0} h={52} />
        <div className="flex gap-3 items-end pb-1">
          <IncenseStick delay={0} />
          <IncenseStick delay={1} />
          <IncenseStick delay={2} />
        </div>
        <Candle delay={1} h={52} />
      </div>

      {/* flower decoration bottom */}
      <div className="flex justify-center gap-1 mt-5 select-none">
        {'🌸🌸🌸🌺🌸🌸🌸'.split('').map((f, i) => (
          <span key={i} style={{ fontSize: 14, opacity: i === 3 ? 0.9 : 0.5 }}>{f}</span>
        ))}
      </div>

      {/* service info */}
      {services.map(s => (
        <div key={s.name + 'info'} style={{
          marginTop: 20, padding: '16px 16px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(180,150,60,0.1)',
          borderRadius: 12,
        }}>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span style={{ fontSize: 20 }}>{s.emoji}</span>
            <span style={{ color: 'rgba(220,200,150,0.9)', fontSize: 13, fontWeight: 900 }}>{s.name}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, color: 'rgba(150,120,60,0.7)',
              background: 'rgba(180,150,60,0.08)', border: '1px solid rgba(180,150,60,0.15)',
              padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>{s.category}</span>
          </div>
          <p style={{ color: 'rgba(180,170,150,0.75)', fontSize: 12, lineHeight: 1.6 }}>{s.desc}</p>
          <p style={{
            color: 'rgba(160,140,100,0.5)', fontSize: 11,
            fontStyle: 'italic', marginTop: 10,
            borderTop: '1px solid rgba(180,150,60,0.08)', paddingTop: 10,
          }}>"{s.epitaph}"</p>
          {s.born && (
            <p style={{ color: 'rgba(130,110,70,0.4)', fontSize: 9, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
              {s.born} — {s.year} · 향년 {s.year - s.born}세
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── TombstoneCard ────────────────────────────────────────────────────────────
function TombstoneCard({ s }: { s: DeadService }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-2xl border border-border/40 bg-muted/10 hover:bg-muted/25 cursor-pointer transition-all"
      onClick={() => setOpen(o => !o)}
    >
      <div className="p-3.5 flex items-start gap-3">
        <span className="text-xl mt-0.5 select-none shrink-0">{s.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <h3 className="font-black text-sm leading-tight">{s.name}</h3>
            <span className="text-[9px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wide">{s.category}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{s.desc}</p>
          <p className="text-[10px] font-black text-muted-foreground/35 mt-1.5 uppercase tracking-widest">
            RIP {s.year} {s.born ? `· 향년 ${s.year - s.born}세` : ''}
          </p>
        </div>
        <span className="text-muted-foreground/30 text-xs shrink-0 mt-1 select-none">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="border-t border-border/20 px-4 py-6 flex flex-col items-center gap-4">
          <MemorialPortrait s={s} />
          <p className="text-[11px] italic text-muted-foreground/50 text-center max-w-xs">"{s.epitaph}"</p>
        </div>
      )}
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────
export default function Graveyard() {
  const [today, setToday] = useState<{ month: number; day: number } | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const d = new Date();
    setToday({ month: d.getMonth() + 1, day: d.getDate() });
  }, []);

  const { featured, label, rest } = useMemo(() => {
    const sorted = [...GRAVEYARD].sort(
      (a, b) => new Date(b.year, b.month - 1, b.day).getTime() - new Date(a.year, a.month - 1, a.day).getTime(),
    );
    if (!today) return { featured: [] as DeadService[], label: '', rest: sorted };

    const todayMatches = sorted.filter(s => s.month === today.month && s.day === today.day);
    if (todayMatches.length > 0) {
      const r = sorted.filter(s => !(s.month === today.month && s.day === today.day));
      return {
        featured: todayMatches,
        label: `${today.month}월 ${today.day}일 — 오늘의 장례식`,
        rest: r,
      };
    }
    return {
      featured: [sorted[0]],
      label: '가장 최근에 떠난 서비스',
      rest: sorted.slice(1),
    };
  }, [today]);

  const filtered = useMemo(() => {
    if (!filter) return rest;
    const q = filter.toLowerCase();
    return rest.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q) ||
      String(s.year).includes(q),
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

      {/* altar */}
      {featured.length > 0 && <FuneralAltar services={featured} label={label} />}

      {/* in memoriam list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground flex items-center gap-1.5">
            In Memoriam
            <span className="font-medium opacity-50">({filtered.length})</span>
          </h3>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="검색..."
            className="h-7 px-3 text-xs bg-muted border border-border/50 rounded-lg outline-none focus:border-primary w-28 font-medium"
          />
        </div>
        <p className="text-[10px] text-muted-foreground/40 font-medium">▼ 클릭하면 영정사진을 볼 수 있습니다</p>
        <div className="space-y-2">
          {filtered.map(s => <TombstoneCard key={s.name + s.year} s={s} />)}
        </div>
      </div>
    </div>
  );
}
