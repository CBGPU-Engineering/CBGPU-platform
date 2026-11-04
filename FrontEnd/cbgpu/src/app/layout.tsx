import DemoBanner from '@/components/DemoBanner';
import { headers } from 'next/headers';
import SiteTraffic from '@/components/SiteTraffic';
import './globals.css';
import AdminShell from '@/components/AdminShell';
import ManufacturingShell from '@/components/manufacturing/ManufacturingShell';
import MainSiteFrame from '@/components/workspaces/MainSiteFrame';
import WorkspaceShell from '@/components/workspaces/WorkspaceShell';
import {isWorkspace,workspaceForHost} from '@/lib/workspaces';
import AuthGate from '@/components/AuthGate';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/useAuth';
import { Metadata,Viewport } from 'next';
import { AlertProvider } from '@/lib/alert';
import DeferredStylesheet from '@/components/DeferredStylesheet';
import ApprovalNotice from '@/components/ApprovalNotice';
import SiteBanner from '@/components/SiteBanner';

export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',interactiveWidget:'resizes-content'};

const siteUrl = 'https://cbgpu.com';
const schoolLogo = '/img/cbgpu-logo.png';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: { canonical: '/' },
  title: {
    default: 'CBGPU | 학교생활·연구·개발을 하나로',
    template: '%s | CBGPU',
  },
  description: '충북과학고등학교 학생을 위한 올인원 플랫폼. GPU 대여, 자습신청, 시간표, 급식, 투표, 연구노트, 스터디 매칭까지 학교생활에 필요한 모든 것.',
  keywords: ['충북과학고', '충북과학고등학교', 'CBGPU', '학생 플랫폼', 'GPU 대여', '자습신청', '시간표', '급식', '스터디 매칭', 'AI 학습'],
  authors: [{ name: 'CBGPU', url: siteUrl }],
  creator: 'CBGPU',
  publisher: '충북과학고등학교',
  verification: {
    google: 'sQMtTP1fRlurHqsuva_YpLUcIBbClWVp2eFWOwxP2K4',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: siteUrl,
    siteName: 'CBGPU',
    title: 'CBGPU | 학교생활·연구·개발을 하나로',
    description: '충북과학고등학교 학생을 위한 올인원 플랫폼. GPU 대여, 자습신청, 시간표, 급식, 투표, 연구노트, 스터디 매칭까지.',
    images: [{ url: schoolLogo, width: 512, height: 512, alt: '충북과학고등학교 로고' }],
  },
  twitter: {
    card: 'summary',
    title: 'CBGPU | 학교생활·연구·개발을 하나로',
    description: '충북과학고등학교 학생을 위한 올인원 플랫폼.',
    images: [schoolLogo],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [{ url: schoolLogo, href: schoolLogo }],
    shortcut: schoolLogo,
    apple: schoolLogo,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'CBGPU',
  url: siteUrl,
  description: '학교생활, 연구와 개발을 연결하는 CBGPU 작업 공간',
  publisher: {
    '@type': 'EducationalOrganization',
    name: '충북과학고등학교',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-cbgpu-public-host')||requestHeaders.get('host')?.split(':')[0];
  const section = requestHeaders.get('x-cbgpu-site');
  const workspace=workspaceForHost(host||'');
  const savedMode=requestHeaders.get('x-cbgpu-mode');
  const appSite=host==='app.cbgpu.com'||requestHeaders.get('x-cbgpu-app')==='1';

  const adminSite = host === 'admin.cbgpu.com';
  const manufacturingSite=['manufacturing.cbgpu.com','print.cbgpu.com','laser.cbgpu.com'].includes(host||'');
  const publicSite = section === 'docs' || section === 'arxiv' || host === 'docs.cbgpu.com' || host === 'arxiv.cbgpu.com';

  return (
    <html lang={adminSite||manufacturingSite ? "en" : "ko"} suppressHydrationWarning>
      <head>
        {process.env.CBGPU_DEMO!=='1'&&<link rel="preconnect" href="https://cdn.jsdelivr.net" />}
        {process.env.CBGPU_DEMO!=='1'&&<DeferredStylesheet href="https://cdn.jsdelivr.net/gh/toss/tossface/dist/tossface.css" />}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-300">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground">본문으로 건너뛰기</a>
        <ThemeProvider
          attribute="class"
          storageKey={adminSite||manufacturingSite?"cbgpu-developer-theme":"theme"}
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {process.env.CBGPU_DEMO==='1'&&<DemoBanner/>}
          <AuthProvider>
            <AlertProvider english={adminSite||manufacturingSite}>
              {manufacturingSite ? <ManufacturingShell equipmentKind={host==='laser.cbgpu.com'?'laser':'print'}>{children}</ManufacturingShell> : adminSite ? <AdminShell><AuthGate>{children}</AuthGate></AdminShell> : publicSite ? <AuthGate publicSite>{children}</AuthGate> : workspace||appSite||host==='cbgpu.com'||host==='www.cbgpu.com' ? <WorkspaceShell workspace={workspace||(isWorkspace(savedMode)?savedMode:'student')} isApp={appSite}><SiteBanner/><ApprovalNotice/><AuthGate workspaceSite>{children}</AuthGate></WorkspaceShell> : <MainSiteFrame>{children}</MainSiteFrame>}
              {!adminSite && !manufacturingSite && <SiteTraffic />}
            </AlertProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
