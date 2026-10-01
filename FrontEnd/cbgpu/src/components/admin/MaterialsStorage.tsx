'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FolderOpen, HardDrive, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAlert } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { fetchMaterialsJson, formatBytes, type MaterialsUsage } from '@/lib/materialsApi';

type MaterialRow = {
  id: string; title: string; file_name: string; size_bytes: number; created_at: string;
  uploader_id: string; profiles: { full_name: string | null; student_id: string | null } | null;
};

const TOP = 5;

function Meter({ ratio, label }: { ratio: number; label: string }) {
  const percent = Math.min(Math.round(ratio * 100), 100);
  const tone = ratio >= 0.95 ? 'bg-destructive' : ratio >= 0.8 ? 'bg-amber-500' : 'bg-primary';
  return <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-3 overflow-hidden rounded-full bg-muted">
    <div className={`h-full rounded-full transition-[width] duration-500 ${tone}`} style={{ width: `${percent}%` }} />
  </div>;
}

export default function MaterialsStorage() {
  const { showError } = useAlert();
  const [usage, setUsage] = useState<MaterialsUsage | null>(null);
  const [outdated, setOutdated] = useState(false);
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usageResult, rowsResult] = await Promise.all([
        fetchMaterialsJson<MaterialsUsage>('/admin/materials/usage'),
        supabase.from('shared_materials')
          .select('id,title,file_name,size_bytes,created_at,uploader_id,profiles:uploader_id(full_name,student_id)')
          .eq('status', 'ready').order('created_at', { ascending: false }).limit(2000),
      ]);
      setOutdated(usageResult === null);
      setUsage(usageResult);
      if (rowsResult.error) throw rowsResult.error;
      setRows((rowsResult.data ?? []) as unknown as MaterialRow[]);
    } catch (error) {
      showError(error instanceof Error ? error.message : '저장 공간 정보를 불러오지 못했습니다.');
    } finally { setLoading(false); }
  }, [showError]);

  useEffect(() => { void load(); }, [load]);

  const { uploaders, largest } = useMemo(() => {
    const byUser = new Map<string, { name: string; bytes: number; count: number }>();
    for (const row of rows) {
      const entry = byUser.get(row.uploader_id) ?? { name: row.profiles?.full_name || row.profiles?.student_id || '알 수 없음', bytes: 0, count: 0 };
      entry.bytes += row.size_bytes; entry.count += 1;
      byUser.set(row.uploader_id, entry);
    }
    return {
      uploaders: [...byUser.values()].sort((a, b) => b.bytes - a.bytes).slice(0, TOP),
      largest: [...rows].sort((a, b) => b.size_bytes - a.size_bytes).slice(0, TOP),
    };
  }, [rows]);

  const ratio = usage ? (usage.used_bytes + usage.reserved_bytes) / usage.quota_bytes : 0;
  const full = usage ? usage.remaining_bytes <= 0 : false;
  const card = 'rounded-2xl border border-border/60 bg-card p-5 space-y-4';
  const heading = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground';

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2"><HardDrive className="size-5 text-primary" /><h2 className="text-lg font-black tracking-tight">자료 공유 저장 공간</h2></div>
      <Button variant="outline" size="sm" className="gap-1.5 font-black text-xs" disabled={loading} onClick={() => void load()}>
        <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />새로고침
      </Button>
    </div>

    {outdated && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p>파일 서버가 아직 용량 조회를 지원하지 않는 버전이에요. 서버를 새 버전으로 배포하면 사용량이 표시돼요. 아래 목록은 DB 기준이에요.</p>
    </div>}

    {usage && <section className={card}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={heading}>사용량 / 한도</p>
          <p className="mt-1 text-3xl font-black tracking-tighter">{formatBytes(usage.used_bytes)}<span className="text-base font-bold text-muted-foreground"> / {formatBytes(usage.quota_bytes)}</span></p>
        </div>
        {full ? <Badge variant="danger" icon={<AlertTriangle className="size-3" />}>가득 참 · 업로드 중단</Badge>
          : ratio >= 0.8 ? <Badge variant="warning">{Math.round(ratio * 100)}% 사용 중</Badge>
          : <Badge variant="success">{Math.round(ratio * 100)}% 사용 중</Badge>}
      </div>
      <Meter ratio={ratio} label="자료 공유 저장 공간 사용률" />
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt className={heading}>남은 공간</dt><dd className="mt-1 font-black">{formatBytes(usage.remaining_bytes)}</dd></div>
        <div><dt className={heading}>파일 수</dt><dd className="mt-1 font-black">{usage.file_count.toLocaleString('ko-KR')}개</dd></div>
        <div><dt className={heading}>업로드 중</dt><dd className="mt-1 font-black">{usage.reserved_bytes ? formatBytes(usage.reserved_bytes) : '없음'}</dd></div>
        <div><dt className={heading}>서버 디스크 여유</dt><dd className="mt-1 font-black">{formatBytes(usage.disk_free_bytes)}<span className="font-bold text-muted-foreground"> / {formatBytes(usage.disk_total_bytes)}</span></dd></div>
      </dl>
    </section>}

    <div className="grid gap-5 md:grid-cols-2">
      <section className={card}>
        <p className={heading}>많이 쓴 사람 TOP {TOP}</p>
        {uploaders.length ? <ol className="space-y-2.5">
          {uploaders.map((entry, index) => <li key={index} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-bold"><span className="mr-2 text-muted-foreground">{index + 1}</span>{entry.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{entry.count}개 · <b className="text-foreground">{formatBytes(entry.bytes)}</b></span>
          </li>)}
        </ol> : <p className="py-6 text-center text-sm text-muted-foreground">{loading ? '불러오는 중…' : '공유된 자료가 없어요.'}</p>}
      </section>
      <section className={card}>
        <p className={heading}>큰 파일 TOP {TOP}</p>
        {largest.length ? <ol className="space-y-2.5">
          {largest.map(row => <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2"><FolderOpen className="size-3.5 shrink-0 text-muted-foreground" aria-hidden /><span className="min-w-0 truncate font-bold" title={`${row.title} (${row.file_name})`}>{row.title}</span></span>
            <span className="shrink-0 text-xs font-black">{formatBytes(row.size_bytes)}</span>
          </li>)}
        </ol> : <p className="py-6 text-center text-sm text-muted-foreground">{loading ? '불러오는 중…' : '공유된 자료가 없어요.'}</p>}
      </section>
    </div>
    {rows.length >= 2000 && <p className="text-xs text-muted-foreground">최근 2,000개 자료만 집계했어요.</p>}
  </div>;
}
