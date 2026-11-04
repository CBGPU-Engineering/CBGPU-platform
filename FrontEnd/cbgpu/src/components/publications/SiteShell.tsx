import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import {WorkspaceTheme,WorkspaceThemeControl} from './WorkspaceTheme';
import '../admin/developer-shell.css';
import PublicationNav from './PublicationNav';
import {guides,docCategories} from './docs';
import './publications.css';

export async function publicationHref(site: 'docs' | 'arxiv', path = '') {
  const requestHeaders=await headers();
  const host = requestHeaders.get('x-cbgpu-public-host')||requestHeaders.get('host')?.split(':')[0];
  return host === `${site}.cbgpu.com` ? (path || '/') : `/${site}${path}`;
}

export default async function SiteShell({ site, children }: { site: 'docs' | 'arxiv'; children: React.ReactNode }) {
  const home = await publicationHref(site);
  const base = home === '/' ? '' : home;
  const title = site === 'docs' ? 'Docs' : 'arXiv';
  const items = site === 'docs'
    ? [{ href: home, internalPath: '/docs', label: '문서 홈', kind: 'docs' as const }, ...guides.map(g => ({ href: `${base}/${g.slug}`, internalPath: `/docs/${g.slug}`, label: g.title, group:docCategories.find(category=>category.id===g.category)?.title, kind: 'docs' as const }))]
    : [{ href: home, internalPath: '/arxiv', label: '연구 프리프린트', kind: 'papers' as const }, { href: `${base}/submit`, internalPath: '/arxiv/submit', label: '연구 제출', kind: 'submit' as const }];
  return <WorkspaceTheme><div className="portal">
    <aside className="sidebar">
      <Link href={home} className="brand"><Image src="/img/cbgpu-logo.png" width={30} height={30} alt="" /><span className="brand-word">CBGPU<small>{title}</small></span></Link>
      <p className="nav-caption">Workspace</p>
      <PublicationNav items={items} />
      <div className="sidebar-bottom"><a href={site === 'docs' ? 'https://arxiv.cbgpu.com' : 'https://docs.cbgpu.com'}>{site === 'docs' ? '연구 프리프린트' : '사용 문서'}<ArrowUpRight aria-hidden="true" /></a><a href="https://cbgpu.com">CBGPU 열기<ArrowUpRight aria-hidden="true" /></a></div>
    </aside>
    <div className="workspace">
      <header className="workspace-header"><div className="breadcrumbs"><Link href={home}>{title}</Link><ChevronRight aria-hidden="true" /><span>{site === 'docs' ? '사용 문서' : '학교 연구 저장소'}</span></div><div className="header-actions"><span className="environment-badge">공개 열람</span><WorkspaceThemeControl /></div></header>
      <main id="main-content" tabIndex={-1} className="portal-content">{children}</main>
      <footer className="workspace-footer"><p>{site === 'docs' ? 'CBGPU Docs' : 'CBGPU arXiv'}</p><nav aria-label="관련 서비스" className="portal-footer-links"><a href="https://docs.cbgpu.com">문서</a><a href="https://arxiv.cbgpu.com">연구</a><a href="https://cbgpu.com">CBGPU</a><a href="https://cbgpu.com/download">Android 앱 <ArrowUpRight aria-hidden="true" /></a></nav></footer>
    </div>
  </div></WorkspaceTheme>;
}
