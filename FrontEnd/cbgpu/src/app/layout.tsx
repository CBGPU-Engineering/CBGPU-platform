import './globals.css';
import Navbar from '@/components/Navbar';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/useAuth';
import { Toaster } from 'sonner';
import { Metadata } from 'next';
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: 'CBGPU | GPU Rental System',
  description: 'Chungbuk Science High School GPU Rental System',
  verification: {
    google: 'xAyYkYGezYlzmSkzhCwwrTl-nCGv6ewScASAFt9AnQc',
  },
  icons: {
    icon: [
      {
        url: 'https://i.namu.wiki/i/qMgg10XRSaTorhAnQaV-bKbUWK_xIlq2socc7pVyw1SJmovke8gEWfeofFitiIJ1VBMngGy4o1NuAnjrOA0m1w.webp',
        href: 'https://i.namu.wiki/i/qMgg10XRSaTorhAnQaV-bKbUWK_xIlq2socc7pVyw1SJmovke8gEWfeofFitiIJ1VBMngGy4o1NuAnjrOA0m1w.webp',
      },
    ],
    shortcut: 'https://i.namu.wiki/i/qMgg10XRSaTorhAnQaV-bKbUWK_xIlq2socc7pVyw1SJmovke8gEWfeofFitiIJ1VBMngGy4o1NuAnjrOA0m1w.webp',
    apple: 'https://i.namu.wiki/i/qMgg10XRSaTorhAnQaV-bKbUWK_xIlq2socc7pVyw1SJmovke8gEWfeofFitiIJ1VBMngGy4o1NuAnjrOA0m1w.webp',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en" suppressHydrationWarning>
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