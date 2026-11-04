import type {LucideIcon} from 'lucide-react';
import { BookOpen, CalendarDays, UtensilsCrossed, Music, Cpu, Server, Printer, NotebookPen, FolderOpen, Users, Vote, Newspaper, Wrench, Gamepad2, Trophy, Globe, TerminalSquare, Scissors, Smartphone } from 'lucide-react';

// 홈, 하단 탐색, 전체 서비스가 같은 이름과 순서를 사용한다.
export type Service = {href:string;label:string;description:string;icon:LucideIcon;keywords?:string};
export const serviceGroups: {id:string;title:string;services:Service[]}[] = [
  { id:'school', title: '학교생활', services: [
    { href: '/study', label: '자습 신청', description: '자습실과 신청 현황 확인', icon: BookOpen, keywords: '자습 edu-set 자리 신청' },
    { href: '/timetable', label: '시간표', description: '오늘 수업과 주간 시간표', icon: CalendarDays, keywords: '수업 시간표' },
    { href: '/meal', label: '급식', description: '오늘의 식단 확인', icon: UtensilsCrossed, keywords: '밥 식단 점심 저녁' },
    { href: '/wakeup', label: '기상송', description: '노래 신청과 플레이리스트', icon: Music, keywords: '음악 노래 스포티파이' },
    { href: '/materials', label: '자료 공유', description: '학습·연구 자료 찾기', icon: FolderOpen, keywords: '파일 태그 학습자료 자료공유 업로드 올리기 다운로드 공유' },
  ] },
  {id:'compute',title:'GPU 사용',services:[
    {href:'/dashboard',label:'GPU 예약',description:'사용 가능한 GPU 확인과 예약',icon:Cpu,keywords:'GPU 대여 컴퓨팅 그래픽카드 주피터 jupyter 실험 학습'},
    {href:'/dashboard/ssh-guide',label:'GPU 접속 안내',description:'Jupyter·SSH 접속 방법',icon:TerminalSquare,keywords:'ssh 원격 터미널 vscode 주피터 jupyter 연결'},
  ]},
  {id:'deploy',title:'웹사이트·서버 배포',services:[
    {href:'/deploy',label:'프론트엔드 배포',description:'Git 저장소로 웹사이트 올리기',icon:Globe,keywords:'프론트 frontend deploy vercel git github 홈페이지 호스팅'},
    {href:'/server',label:'서버 배포',description:'백엔드·Docker 서비스 실행하기',icon:Server,keywords:'백엔드 backend server deploy docker compose spring python node 프로젝트 호스팅'},
  ]},
  {id:'research',title:'자료·논문·기록',services:[
    {href:'/latex',label:'논문 작성',description:'LaTeX 편집과 PDF 만들기',icon:NotebookPen,keywords:'overleaf latex 레이텍스 라텍스 논문 tex zip 컴파일 pdf 작성'},
    {href:'/notes',label:'연구노트',description:'실험 과정과 아이디어 기록하기',icon:NotebookPen,keywords:'메모 기록 노트 연구'},
  ]},
  {id:'making',title:'3D 프린팅·레이저',services:[
    {href:'/manufacturing/print',label:'3D 프린팅',description:'프린터 현황 확인과 출력 신청',icon:Printer,keywords:'제작 3d printing 프린트 프린터 출력 인쇄'},
    {href:'/manufacturing/laser',label:'레이저 커팅',description:'재료 선택과 레이저 가공 신청',icon:Scissors,keywords:'제작 레이저 커팅 가공 자르기 절단 laser'},
  ]},
  { id:'community', title: '대회·스터디·소식', services: [
    { href: '/contests', label: '교내 대회', description: '행사 개설부터 참가·운영·작품 제출까지', icon: Trophy, keywords: '대회 행사 공모전 참가 신청 체크인 제출 파일 호스트' },
    { href: '/match', label: '스터디 매칭', description: '함께 공부할 친구 찾기', icon: Users, keywords: '모임 스터디 매칭' },
    { href: '/polls', label: '투표', description: '진행 중인 투표 참여', icon: Vote, keywords: '설문 의견 투표' },
    { href: '/feed', label: '소식', description: '학교와 과학 소식 확인', icon: Newspaper, keywords: '피드 feed 소식' },
    { href: '/tools', label: '도구', description: '학교생활에 필요한 도구', icon: Wrench, keywords: '타이머 디데이 계산' },
    { href: '/games', label: '게임', description: '쉬는 시간에 즐기는 게임', icon: Gamepad2, keywords: '아케이드 arcade 게임' },
  ] },
  {id:'app',title:'CBGPU 앱',services:[
    {href:'/download',label:'앱 다운로드',description:'Android 앱 설치 파일과 설치 안내',icon:Smartphone,keywords:'앱 app apk 안드로이드 android 다운로드 설치 모바일 휴대폰 업데이트'},
  ]},
  {id:'knowledge',title:'문서·연구 공개',services:[
    {href:'https://docs.cbgpu.com',label:'사용 문서',description:'계정·GPU·SSH 사용 안내 · 로그인 없이 열람',icon:BookOpen,keywords:'docs 도움말 가이드 설명서 비밀번호 접속'},
    {href:'https://arxiv.cbgpu.com',label:'연구 프리프린트',description:'학교 연구 읽기·검색 · CBGPU 계정으로 논문 제출',icon:Newspaper,keywords:'arxiv 논문 프리프린트 pdf 연구 업로드 제출'},
  ]},
];

export const dailyServices = serviceGroups[0].services;

export const serviceSearchPages = serviceGroups.flatMap(group=>group.services.map(service=>({title:service.label,description:service.description,href:service.href,keywords:`${service.keywords||''} ${service.href}`})));
