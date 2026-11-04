'use client';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import SiteBanner from '@/components/SiteBanner';
import ApprovalNotice from '@/components/ApprovalNotice';
import AuthGate from '@/components/AuthGate';
export default function MainSiteFrame({children}:{children:React.ReactNode}){const path=usePathname(),currentYear=new Date().getFullYear();if(path==='/')return <>{children}</>;return <>
              <Navbar />
              <SiteBanner />
              <ApprovalNotice />
              <main id="main-content" tabIndex={-1} className="flex-grow container mx-auto px-4 md:px-6 py-10 pb-28 xl:pb-10">
                <AuthGate>{children}</AuthGate>
              </main>
              <footer className="hidden xl:block border-t py-12 bg-muted/20 text-center text-sm text-muted-foreground transition-all">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                    <Image width={24} height={24}
                      src="/img/cbgpu-logo.png"
                      alt="School Logo"
                      className="w-6 h-6 object-contain"
                    />
                    <span className="font-black tracking-tighter italic">CBGPU</span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-foreground/80 px-4">Chungbuk Science High School Computing Service</p>
                    <p className="flex items-center justify-center gap-3 text-xs font-bold">
                      <Link href="/privacy" className="underline-offset-4 transition-colors hover:text-foreground hover:underline">개인정보처리방침</Link>
                      <span className="opacity-30" aria-hidden="true">·</span>
                      <Link href="/contact" className="underline-offset-4 transition-colors hover:text-foreground hover:underline">문의하기</Link>
                    </p>
                    <p className="text-[10px] uppercase tracking-widest opacity-60">
                    © {currentYear} <a href="https://github.com/lmwmason" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors underline-offset-4 hover:underline">CBGPU</a>. All rights reserved.
                  </p>
                  </div>
                </div>
              </footer>

</>}
