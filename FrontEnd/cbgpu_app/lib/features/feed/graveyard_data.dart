/// Static "Digital Cemetery" dataset mirroring the web app's
/// src/components/feed/Graveyard.tsx GRAVEYARD array exactly.
class DeadService {
  const DeadService({
    required this.name,
    required this.month,
    required this.day,
    required this.year,
    this.born,
    required this.category,
    required this.desc,
    this.epitaph,
    this.emoji,
    this.domain,
  });

  final String name;
  final int month;
  final int day;
  final int year;
  final int? born;
  final String category;
  final String desc;
  final String? epitaph;
  final String? emoji;
  final String? domain;
}

final List<DeadService> graveyard = [
  DeadService(name: 'Python 2', month: 1, day: 1, year: 2020, born: 2000, category: 'Python', desc: '20년간 우리 곁을 지킨 언어. 마이그레이션 안 한 레거시 코드는 아직도 운다.', epitaph: 'print \'goodbye\'  ←  SyntaxError in Python 3', emoji: '🐍', domain: 'python.org'),
  DeadService(name: 'Google Stadia', month: 1, day: 18, year: 2023, born: 2019, category: 'Google', desc: '클라우드 게이밍의 꿈. 하드웨어도 없이 도전하다 산화했다.', epitaph: 'The input lag was the real killer', emoji: '🎮', domain: 'google.com'),
  DeadService(name: 'Google Glass Consumer', month: 1, day: 19, year: 2015, born: 2013, category: 'Google', desc: '미래의 안경. 사람들은 Glass-hole이라 불렀고, 구글은 조용히 접었다.', epitaph: 'The future looked different through these lenses', emoji: '👓', domain: 'google.com'),
  DeadService(name: 'Parse', month: 1, day: 28, year: 2017, born: 2011, category: 'Facebook', desc: '개발자들의 BaaS 성지. 페이스북이 인수 후 무료 서비스를 종료시켰다.', epitaph: 'Parse this: you were great', emoji: '⚙️', domain: 'back4app.com'),
  DeadService(name: 'Firefox OS', month: 1, day: 26, year: 2016, born: 2013, category: 'Mozilla', desc: '개방형 웹 기술로 만든 모바일 OS. 스마트폰 시장의 현실에 무릎을 꿇었다.', epitaph: 'about:dead', emoji: '🦊', domain: 'mozilla.org'),
  DeadService(name: 'HipChat', month: 2, day: 15, year: 2019, born: 2010, category: 'Atlassian', desc: 'Slack 이전의 팀 채팅 강자. Atlassian이 키워놓고 Slack에 팔아버렸다.', epitaph: 'We were Slacking before Slack existed', emoji: '💬', domain: 'atlassian.com'),
  DeadService(name: 'Mailbox', month: 2, day: 26, year: 2016, born: 2013, category: 'Dropbox', desc: '스와이프로 inbox zero를 달성하던 혁명적 앱. Dropbox가 인수하고 조용히 묻었다.', epitaph: 'Swiped left for the very last time', emoji: '📬', domain: 'dropbox.com'),
  DeadService(name: 'Twitter API Free Tier', month: 2, day: 9, year: 2023, born: 2006, category: 'Elon Musk', desc: '무료 API 종료. 수천 개의 봇, 알림 서비스, 연구 프로젝트가 하루아침에 죽었다.', epitaph: 'Error 402: Payment Required to tweet', emoji: '🐦', domain: 'x.com'),
  DeadService(name: 'Twitch Korea', month: 2, day: 27, year: 2024, born: 2011, category: 'Amazon', desc: '망 사용료 폭탄을 버티지 못하고 한국 철수. 구독자들이 거리로 나왔다.', epitaph: 'Network neutrality is not a given', emoji: '🎥', domain: 'twitch.tv'),
  DeadService(name: 'Picasa', month: 3, day: 15, year: 2016, born: 2002, category: 'Google', desc: '구글 포토 이전의 사진 관리 왕. 14년을 버텼지만 구글에게 중복이었다.', epitaph: 'A picture is worth a thousand memories', emoji: '🖼️', domain: 'google.com'),
  DeadService(name: 'Google Allo', month: 3, day: 12, year: 2019, born: 2016, category: 'Google', desc: 'Google Assistant 내장 메신저. 아무도 안 썼다. 3년만에 조용히 사라졌다.', epitaph: 'Smart messaging, dumb strategy', emoji: '💬', domain: 'google.com'),
  DeadService(name: 'goo.gl URL Shortener', month: 3, day: 30, year: 2019, born: 2009, category: 'Google', desc: '구글 단축 URL 서비스. 신규 생성 중단 → 완전 폐쇄.', epitaph: 'Short in name, shorter in lifespan', emoji: '🔗', domain: 'google.com'),
  DeadService(name: 'Adobe Muse', month: 3, day: 26, year: 2020, born: 2012, category: 'Adobe', desc: '코딩 없이 웹사이트를 만들던 Adobe의 툴. 구독 경제가 단종시켰다.', epitaph: 'No code, no future', emoji: '🎨', domain: 'adobe.com'),
  DeadService(name: 'Google+', month: 4, day: 2, year: 2019, born: 2011, category: 'Google', desc: '수십억 달러짜리 Facebook 도전. 보안 취약점이 쐐기를 박았다. +1 개 받음.', epitaph: '+1 for effort', emoji: '➕', domain: 'google.com'),
  DeadService(name: 'Google Inbox', month: 4, day: 2, year: 2019, born: 2014, category: 'Google', desc: '이메일을 진짜로 재발명했다. Gmail 팀이 질투해서 죽였다는 설이 있다.', epitaph: 'Inbox zero. Forever.', emoji: '📥', domain: 'google.com'),
  DeadService(name: 'Posterous', month: 4, day: 30, year: 2013, born: 2008, category: 'Twitter', desc: '이메일로 블로그 포스팅하던 플랫폼. 트위터 인수 후 방치됐다.', epitaph: 'Posted its last post', emoji: '✍️', domain: 'twitter.com'),
  DeadService(name: 'Grooveshark', month: 4, day: 30, year: 2015, born: 2007, category: 'Independent', desc: 'Spotify보다 먼저였다. 저작권 소송에 항복했다.', epitaph: 'The music played until the lawyers arrived', emoji: '🦈', domain: 'grooveshark.com'),
  DeadService(name: 'Adobe Brackets', month: 4, day: 1, year: 2021, born: 2012, category: 'Adobe', desc: 'Adobe가 만든 오픈소스 웹 에디터. VS Code에 무릎을 꿇고 아카이브됐다.', epitaph: '{ code: \'was_beautiful\', status: \'archived\' }', emoji: '✏️', domain: 'adobe.com'),
  DeadService(name: 'Yahoo Answers', month: 5, day: 4, year: 2021, born: 2005, category: 'Yahoo', desc: '인터넷 지식의 혼돈. How is babby formed? 영원히 답 없음.', epitaph: 'How is babby formed? We\'ll never know.', emoji: '❓', domain: 'yahoo.com'),
  DeadService(name: 'Bintray / JCenter', month: 5, day: 1, year: 2021, born: 2010, category: 'JFrog', desc: 'Android 개발자 필수 Maven 저장소. 갑작스러운 종료 공지에 전 세계 빌드가 깨졌다.', epitaph: 'Could not resolve com.example:library:1.0.0', emoji: '📦', domain: 'jfrog.com'),
  DeadService(name: 'Daum 마이피플', month: 5, day: 1, year: 2015, born: 2010, category: 'Daum/카카오', desc: '카카오톡 이전 국민 메신저 후보. 카카오에 완패하고 서비스를 접었다.', epitaph: '마이피플이 사라졌습니다', emoji: '🇰🇷', domain: 'daum.net'),
  DeadService(name: 'Skype', month: 5, day: 5, year: 2025, born: 2003, category: 'Microsoft', desc: '화상통화를 대중화했다. Zoom과 Teams에 잠식되어 22년만에 종료.', epitaph: 'Can you hear me now? No.', emoji: '📞', domain: 'skype.com'),
  DeadService(name: 'Arc Browser (Active Dev)', month: 5, day: 27, year: 2025, born: 2022, category: 'The Browser Company', desc: '탭을 사이드바에 넣고 브라우저를 재발명하려 했다. 얼리어답터는 사랑했지만 대중은 오지 않았고, AI 브라우저 Dia에게 왕좌를 넘기고 개발이 멈췄다.', epitaph: 'Spaces used by 12%. Rest in tabs.', emoji: '🌈', domain: 'arc.net'),
  DeadService(name: 'Yahoo Pipes', month: 6, day: 30, year: 2015, born: 2007, category: 'Yahoo', desc: '웹 데이터 파이프라인의 선구자. RSS와 API를 GUI로 조합하던 마법.', epitaph: 'Piped to /dev/null', emoji: '🔧', domain: 'yahoo.com'),
  DeadService(name: 'Google Code', month: 6, day: 25, year: 2016, born: 2006, category: 'Google', desc: 'GitHub 이전의 코드 호스팅. SVN과 Mercurial을 품었지만 GitHub에 졌다.', epitaph: 'GitHub was just better. Sorry.', emoji: '💻', domain: 'google.com'),
  DeadService(name: 'Internet Explorer', month: 6, day: 15, year: 2022, born: 1995, category: 'Microsoft', desc: '27년간 웹 개발자를 괴롭혔다. 최후의 IE를 기다리며 많은 CSS hack이 묻혔다.', epitaph: 'Please use a different browser to view this tombstone', emoji: '🌐', domain: 'microsoft.com'),
  DeadService(name: 'Me2Day', month: 6, day: 30, year: 2014, born: 2007, category: 'NHN', desc: '한국의 트위터. 네이버가 인수 후 미투데이라 불렸다. 2천만 포스팅과 함께 문을 닫았다.', epitaph: '미투!', emoji: '🇰🇷', domain: 'naver.com'),
  DeadService(name: 'Delicious', month: 6, day: 15, year: 2017, born: 2003, category: 'AVOS', desc: '소셜 북마크의 원조. Yahoo, AVOS를 거쳐 Pinboard에 흡수됐다.', epitaph: 'Bookmarked for deletion', emoji: '🔖', domain: 'del.icio.us'),
  DeadService(name: 'Gemini CLI', month: 6, day: 18, year: 2026, born: 2025, category: 'Google', desc: '터미널에서 제미나이를 부르던 오픈소스 CLI. 1년 만에 클로즈드소스 Antigravity CLI에게 자리를 내주고 사라졌다.', epitaph: 'command not found: gemini', emoji: '♊', domain: 'ai.google.dev'),
  DeadService(name: 'Meta Workplace', month: 6, day: 1, year: 2026, born: 2016, category: 'Meta', desc: '페이스북 UI를 그대로 사내 메신저로 옮긴 기업용 SNS. 10년간 사내 잡담방을 지켰지만 결국 완전 셧다운.', epitaph: 'Your workplace has been permanently logged out', emoji: '🏢', domain: 'workplace.com'),
  DeadService(name: 'Google Reader', month: 7, day: 1, year: 2013, born: 2005, category: 'Google', desc: 'RSS 리더의 왕. 종료 발표 당일 온 인터넷이 울었다. 지금도 대안은 없다.', epitaph: 'You had us at \'mark all as read\'', emoji: '📰', domain: 'google.com'),
  DeadService(name: 'Vine', month: 8, day: 27, year: 2016, born: 2013, category: 'Twitter', desc: '6초 영상의 전설. TikTok의 아버지. 트위터가 방치해 스스로 죽었다.', epitaph: '6 seconds was never enough', emoji: '🎬', domain: 'twitter.com'),
  DeadService(name: 'Stack Overflow Docs', month: 8, day: 2, year: 2017, born: 2016, category: 'Stack Overflow', desc: 'Stack Overflow의 문서화 실험. 1년만에 실패를 인정하고 철수했다.', epitaph: 'Documentation: null', emoji: '📚', domain: 'stackoverflow.com'),
  DeadService(name: 'Firebase Dynamic Links', month: 8, day: 25, year: 2025, born: 2016, category: 'Google', desc: '앱 딥링크의 표준이었다. 하루아침에 모든 링크가 404를 뱉으며 죽었고, 수많은 앱의 초대·공유 기능이 함께 묻혔다.', epitaph: '404: The link, like our trust, is gone', emoji: '🔗', domain: 'firebase.google.com'),
  DeadService(name: 'Google Wave', month: 9, day: 30, year: 2010, born: 2009, category: 'Google', desc: '이메일과 채팅의 재발명. 아무도 이해하지 못했다. 1년만에 사라졌다.', epitaph: 'We\'re still not sure what it was', emoji: '🌊', domain: 'google.com'),
  DeadService(name: 'Orkut', month: 9, day: 30, year: 2014, born: 2004, category: 'Google', desc: '구글의 첫 소셜 네트워크. 브라질 전체가 애도했다.', epitaph: 'Saudade', emoji: '🤝', domain: 'google.com'),
  DeadService(name: 'BlackBerry Phones', month: 9, day: 28, year: 2016, born: 1999, category: 'BlackBerry', desc: '물리 키보드의 제왕. 보안의 상징이었다. 스마트폰 시대에 적응 실패.', epitaph: 'QWERTY, and gone', emoji: '⌨️', domain: 'blackberry.com'),
  DeadService(name: 'Google Code Jam', month: 9, day: 4, year: 2023, born: 2003, category: 'Google', desc: '20년간 전 세계 개발자들이 경쟁했던 구글 코딩 대회. 채용 연계도 끊기고 폐지됐다.', epitaph: 'Wrong Answer — life.exe has stopped', emoji: '🏆', domain: 'google.com'),
  DeadService(name: 'Yahoo GeoCities', month: 10, day: 26, year: 2009, born: 1994, category: 'Yahoo', desc: '개인 홈페이지의 성지. ★Under Construction★ 방문자 카운터 ★ 반짝이는 GIF ★', epitaph: 'Under construction... forever', emoji: '🏠', domain: 'yahoo.com'),
  DeadService(name: 'Windows Live Messenger', month: 10, day: 31, year: 2014, born: 1999, category: 'Microsoft', desc: 'MSN 메신저의 후계자. Nudge 기능이 그립다. Skype에 합병당해 죽었다.', epitaph: 'Nudge... nudge... goodbye', emoji: '🟡', domain: 'microsoft.com'),
  DeadService(name: 'Google Daydream VR', month: 10, day: 15, year: 2019, born: 2016, category: 'Google', desc: '구글의 모바일 VR 플랫폼. 3년 만에 조용히 중단. 아무도 몰랐다.', epitaph: 'Reality was just too competitive', emoji: '🥽', domain: 'google.com'),
  DeadService(name: 'Microsoft Band', month: 10, day: 30, year: 2019, born: 2014, category: 'Microsoft', desc: 'Microsoft의 스마트밴드. 센서는 많았지만 오래 못 갔다.', epitaph: 'Heart rate: 0', emoji: '⌚', domain: 'microsoft.com'),
  DeadService(name: 'AIM', month: 11, day: 15, year: 2017, born: 1997, category: 'AOL', desc: '인터넷 메신저의 원조. 띵동 소리가 그립다. 20년 만에 영원히 자리를 비웠다.', epitaph: 'brb... actually gone this time', emoji: '🟠', domain: 'aol.com'),
  DeadService(name: 'Heroku Free Tier', month: 11, day: 28, year: 2022, born: 2010, category: 'Salesforce', desc: '학생과 사이드 프로젝트의 낙원. 30분 수면 dyno가 이제는 영원히 잠든다.', epitaph: 'App sleeping... permanently', emoji: '☁️', domain: 'heroku.com'),
  DeadService(name: 'Zune', month: 11, day: 15, year: 2015, born: 2006, category: 'Microsoft', desc: 'iPod을 이기려던 Microsoft의 MP3 플레이어. \'뮤직 니즈 어 소울\' 광고가 걸작이었다.', epitaph: 'Squirting files into the void', emoji: '🎵', domain: 'microsoft.com'),
  DeadService(name: 'Silverlight', month: 11, day: 12, year: 2021, born: 2007, category: 'Microsoft', desc: 'Microsoft의 Flash 대항마. 넷플릭스가 버리자 존재이유가 사라졌다.', epitaph: 'This content requires Microsoft Silverlight', emoji: '🪨', domain: 'microsoft.com'),
  DeadService(name: 'Google Kick Start', month: 11, day: 8, year: 2023, born: 2013, category: 'Google', desc: '코드잼과 함께 폐지된 구글의 또 다른 코딩 대회. 취준생들의 이력서 한 줄이 사라졌다.', epitaph: 'Compilation error: career not found', emoji: '🚀', domain: 'google.com'),
  DeadService(name: 'AOL Dial-Up', month: 9, day: 30, year: 2025, born: 1991, category: 'AOL', desc: '삐——이이이잉— 소리로 시작하던 인터넷 접속. 초고속 인터넷 시대에도 34년을 버텼지만 결국 회선을 내렸다.', epitaph: 'You\'ve Got Mail. Forever offline now.', emoji: '📠', domain: 'aol.com'),
  DeadService(name: 'Tumblr NSFW', month: 12, day: 17, year: 2018, born: 2007, category: 'Verizon', desc: 'Adult 콘텐츠 금지령 발동. 그날 Tumblr의 영혼이 떠났다. 트래픽 80% 증발.', epitaph: 'Flagged for removal from existence', emoji: '🔞', domain: 'tumblr.com'),
  DeadService(name: 'GitHub Atom', month: 12, day: 15, year: 2022, born: 2014, category: 'GitHub', desc: 'Hackable text editor. VS Code에 완패. GitHub이 만들고 GitHub이 죽였다.', epitaph: 'A hackable text editor, hacked to death', emoji: '⚛️', domain: 'atom.io'),
  DeadService(name: 'Google Buzz', month: 12, day: 15, year: 2011, born: 2010, category: 'Google', desc: 'Gmail에 강제 주입된 소셜 미디어. 프라이버시 논란에 1년만에 철수.', epitaph: 'The only buzz it created was outrage', emoji: '🐝', domain: 'google.com'),
  DeadService(name: 'AIM (Final)', month: 12, day: 15, year: 2017, born: 1997, category: 'AOL', desc: '공식 종료일. 세대를 연결했던 메신저가 역사 속으로.', epitaph: 'BRB... for real this time', emoji: '💬', domain: 'aol.com'),
  DeadService(name: 'Flash', month: 12, day: 31, year: 2020, born: 1996, category: 'Adobe', desc: '24년간 인터넷 엔터테인먼트를 지배했다. Newgrounds, 뮤직비디오, 미니게임의 시대.', epitaph: 'This content requires Adobe Flash Player', emoji: '⚡', domain: 'adobe.com'),
  DeadService(name: 'Google Play Music', month: 12, day: 31, year: 2020, born: 2011, category: 'Google', desc: 'YouTube Music으로 강제 이전됐다. 대부분은 더 나쁜 쪽으로 이주했다.', epitaph: 'Replaced by something worse', emoji: '🎶', domain: 'google.com'),
  DeadService(name: 'Rdio', month: 12, day: 22, year: 2015, born: 2010, category: 'Independent', desc: 'Spotify보다 UI가 좋았다. 디자인이 사업을 구해주진 못했다.', epitaph: 'Better than Spotify, worse at business', emoji: '🎧', domain: 'rdio.com'),
  DeadService(name: 'Quibi', month: 12, day: 1, year: 2020, born: 2020, category: 'Independent', desc: '1.75조 원 투자, 186일 만에 폭망. 모바일 전용 스트리밍의 역대급 실패.', epitaph: '\$1.75B raised. \$0 in subscribers.', emoji: '📱', domain: 'quibi.com'),
  DeadService(name: 'AngularJS', month: 12, day: 31, year: 2021, born: 2010, category: 'Google', desc: 'Angular(2+)에게 왕좌를 물려줬다. 11년간의 \$scope와 \$http를 추모한다.', epitaph: '\$scope.\$broadcast(\'goodbye\')', emoji: '🔴', domain: 'angularjs.org'),
  DeadService(name: 'Windows Phone', month: 12, day: 10, year: 2019, born: 2010, category: 'Microsoft', desc: '타일 UI의 혁신가. 앱 생태계 부재로 자멸했다. 시장점유율 0.1%.', epitaph: 'Live tile: permanently frozen', emoji: '📱', domain: 'microsoft.com'),
  DeadService(name: 'Visual Studio App Center', month: 3, day: 31, year: 2025, born: 2017, category: 'Microsoft', desc: '모바일 앱 CI/CD 플랫폼. 8년간 iOS/Android 빌드를 담당했다. Azure로 강제 이전.', epitaph: 'Build succeeded. Deployment: cancelled.', emoji: '📲', domain: 'microsoft.com'),];
