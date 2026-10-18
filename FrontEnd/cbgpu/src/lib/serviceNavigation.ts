import { BookOpen, CalendarDays, UtensilsCrossed, Music, Cpu, Server, Printer, NotebookPen, FolderOpen, Users, Vote, Newspaper, Wrench, Gamepad2, Trophy } from 'lucide-react';

// 홈, 하단 탐색, 전체 서비스가 같은 이름과 순서를 사용한다.
export const serviceGroups = [
  { title: '학교생활', services: [
    { href: '/study', label: '자습신청', description: '자습실과 신청 현황 확인', icon: BookOpen },
    { href: '/timetable', label: '시간표', description: '오늘 수업과 주간 시간표', icon: CalendarDays },
    { href: '/meal', label: '급식', description: '오늘의 식단 확인', icon: UtensilsCrossed },
    { href: '/wakeup', label: '기상송', description: '노래 신청과 플레이리스트', icon: Music },
  ] },
  { title: '연구·학교 자원', services: [
    { href: '/dashboard', label: 'GPU 대여', description: 'GPU 예약과 사용 현황', icon: Cpu },
    { href: '/server', label: '서버 배포', description: '프로젝트 배포와 서버 관리', icon: Server },
    { href: '/manufacturing', label: '제작', description: '3D 프린팅과 레이저 가공', icon: Printer },
    { href: '/notes', label: '연구노트', description: '연구 기록 작성과 관리', icon: NotebookPen },
    { href: '/materials', label: '자료 공유', description: '학습·연구 자료 찾기', icon: FolderOpen },
  ] },
  { title: '커뮤니티·도구', services: [
    { href: '/contests', label: '교내 대회', description: '행사 개설부터 참가·운영·작품 제출까지', icon: Trophy },
    { href: '/match', label: '스터디 매칭', description: '함께 공부할 친구 찾기', icon: Users },
    { href: '/polls', label: '투표', description: '진행 중인 투표 참여', icon: Vote },
    { href: '/feed', label: '소식', description: '학교와 과학 소식 확인', icon: Newspaper },
    { href: '/tools', label: '도구', description: '학교생활에 필요한 도구', icon: Wrench },
    { href: '/games', label: 'Arcade', description: '쉬는 시간에 즐기는 게임', icon: Gamepad2 },
  ] },
];

export const dailyServices = serviceGroups[0].services;
