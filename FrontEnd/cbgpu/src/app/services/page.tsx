'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { serviceGroups } from '@/lib/serviceNavigation';
import { useAuth } from '@/lib/useAuth';

export default function ServicesPage() {
  const [query, setQuery] = useState('');
  const { isAdmin, isWakeupManager } = useAuth();
  const term = query.trim().toLocaleLowerCase();
  const groups = serviceGroups.map(group => ({ ...group, services: group.services.filter(service => `${group.title} ${service.label} ${service.description}`.toLocaleLowerCase().includes(term)) })).filter(group => group.services.length);

  return <div className="mx-auto max-w-4xl space-y-8">
    <header className="space-y-3"><h1 className="text-3xl font-semibold tracking-tight">전체 서비스</h1><p className="text-sm text-muted-foreground">원하는 기능을 바로 선택하세요.</p></header>
    <div className="relative"><Search aria-hidden="true" className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><Input type="search" aria-label="서비스 검색" placeholder="자습, 노래, GPU…" value={query} onChange={event => setQuery(event.target.value)} className="h-12 pl-12 text-base" /></div>
    {(isAdmin || isWakeupManager) && !term && <section aria-label="관리 바로가기" className="flex flex-wrap gap-3">
      {isAdmin && <Button asChild variant="outline" className="min-h-11"><Link href="/admin">관리자 <ArrowRight className="size-4" /></Link></Button>}
      {isWakeupManager && <Button asChild variant="outline" className="min-h-11"><Link href="/admin/wakeup">기상송 관리 <ArrowRight className="size-4" /></Link></Button>}
    </section>}
    {groups.map(group => <section key={group.title} className="space-y-3"><h2 className="text-lg font-semibold">{group.title}</h2><div className="grid gap-2 sm:grid-cols-2">
      {group.services.map(service => <Link key={service.href} href={service.href} className="group flex min-h-20 items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary hover:bg-accent">
        <service.icon aria-hidden="true" className="size-5 shrink-0 text-foreground" /><div className="min-w-0 flex-1"><p className="font-semibold">{service.label}</p><p className="mt-1 text-sm text-muted-foreground">{service.description}</p></div><ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Link>)}
    </div></section>)}
    {!groups.length && <div role="status" className="py-10 text-center"><p>찾는 서비스가 없습니다.</p><Button className="mt-4 min-h-11" variant="outline" onClick={() => setQuery('')}>전체 서비스 보기</Button></div>}
  </div>;
}
