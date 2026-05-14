import './globals.css';
import Navbar from '@/components/Navbar';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/useAuth';
import { Toaster } from 'sonner';
import { Metadata } from 'next';
import { Analytics } from "@vercel/analytics/next"

const siteUrl = 'https://cbgpu.vercel.app';
const schoolLogo = 'https://i.namu.wiki/i/qMgg10XRSaTorhAnQaV-bKbUWK_xIlq2socc7pVyw1SJmovke8gEWfeofFitiIJ1VBMngGy4o1NuAnjrOA0m1w.webp';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'CBGPU | 충북과학고 GPU 대여 시스템',
    template: '%s | CBGPU',
  },
  description: '충북과학고등학교 학생을 위한 AI 학습용 GPU 대여 서비스. RTX5000 GPU 4대를 간편하게 예약하고 JupyterHub로 바로 접속하세요.',
  keywords: ['충북과학고', '충북과학고등학교', 'GPU 대여', 'GPU 렌탈', 'AI 학습', 'JupyterHub', 'RTX5000', 'CBGPU', '딥러닝', '머신러닝'],
  authors: [{ name: 'CBGPU', url: siteUrl }],
  creator: 'CBGPU',
  publisher: '충북과학고등학교',
  verification: {
    google: 'xAyYkYGezYlzmSkzhCwwrTl-nCGv6ewScASAFt9AnQc',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: siteUrl,
    siteName: 'CBGPU',
    title: 'CBGPU | 충북과학고 GPU 대여 시스템',
    description: '충북과학고등학교 학생을 위한 AI 학습용 GPU 대여 서비스. RTX5000 GPU 4대를 간편하게 예약하고 JupyterHub로 바로 접속하세요.',
    images: [{ url: schoolLogo, width: 512, height: 512, alt: '충북과학고등학교 로고' }],
  },
  twitter: {
    card: 'summary',
    title: 'CBGPU | 충북과학고 GPU 대여 시스템',
    description: '충북과학고등학교 학생을 위한 AI 학습용 GPU 대여 서비스.',
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
  description: '충북과학고등학교 학생을 위한 AI 학습용 GPU 대여 서비스',
  publisher: {
    '@type': 'EducationalOrganization',
    name: '충북과학고등학교',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <Navbar />
            <main className="flex-grow container mx-auto px-4 md:px-6 py-10">
              {children}
            </main>
            <footer className="border-t py-12 bg-muted/20 text-center text-sm text-muted-foreground transition-all">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                  <img 
                    src="https://i.namu.wiki/i/qMgg10XRSaTorhAnQaV-bKbUWK_xIlq2socc7pVyw1SJmovke8gEWfeofFitiIJ1VBMngGy4o1NuAnjrOA0m1w.webp" 
                    alt="School Logo" 
                    className="w-6 h-6 object-contain"
                  />
                  <span className="font-black tracking-tighter italic">CBGPU</span>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-foreground/80 px-4">Chungbuk Science High School Computing Service</p>
                  <p className="text-[10px] uppercase tracking-widest opacity-60">
                  © {currentYear} <a href="https://github.com/lmwmason" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors underline-offset-4 hover:underline">CBGPU</a>. All rights reserved.
                </p>
                </div>
              </div>
            </footer>
            <Toaster position="top-center" richColors />
            <Analytics />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}