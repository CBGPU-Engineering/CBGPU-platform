'use client';

import { useRef, useState } from 'react';
import { ContestLogoPicker } from './ContestLogo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { Contest, contestError } from '@/lib/contests';
import { cleanupContestLogo, uploadContestLogo } from '@/lib/contestLogos';

export default function ContestLogoEditor({ contest, onUpdated }: { contest: Contest; onUpdated: (contest: Contest) => void }) {
  const { user } = useAuth();
  const { showSuccess, showError } = useAlert();
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  async function save() {
    if (!user || saving.current) return;
    saving.current = true;
    setBusy(true);
    let uploaded: string | null = null;
    try {
      if (file) uploaded = await uploadContestLogo(file, user.id);
      const { data, error } = await supabase.from('contests').update({ logo_path: uploaded }).eq('id', contest.id).select('*').single();
      if (error) throw error;
      onUpdated(data);
      setFile(null);
      setRemoved(false);
      await cleanupContestLogo(contest.logo_path);
      showSuccess('대회 로고를 저장했어요.');
    } catch (error) { await cleanupContestLogo(uploaded); showError(contestError(error)); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="contest-panel space-y-4">
    <div><p className="contest-eyebrow mb-2 text-primary">IDENTITY</p><h2 className="text-lg font-bold">대회 로고</h2></div>
    <ContestLogoPicker file={file} currentPath={removed ? null : contest.logo_path} disabled={busy} onChange={picked => { setFile(picked); setRemoved(false); }} onRemove={() => { setFile(null); setRemoved(true); }} />
    <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">변경 사항은 저장 후 공개돼요.</p><Button type="button" variant="outline" disabled={busy || (!file && !(removed && contest.logo_path))} onClick={() => void save()}>{busy ? '저장 중…' : '로고 저장'}</Button></div>
  </section>;
}
