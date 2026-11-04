'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/ui/spinner';


function englishError(value: unknown, fallback: string) {
  const message = value instanceof Error ? value.message : typeof value === 'string' ? value : '';
  return message && !/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u.test(message) ? message : fallback;
}

const OFFICIAL_STUDY_URL = 'https://cbsh.edu-set.com';

export default function AdminStudyPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const [tokenInput, setTokenInput] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchStatus = async () => {
    setStatusLoading(true);
    setStatusError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please sign in again.');
      const res = await fetch('/api/study/admin-token', {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(englishError(data?.message, 'Could not load the token status.'));
      setUpdatedAt(data.updatedAt ?? null);
      setExpiresAt(data.expiresAt ?? null);
    } catch (error) {
      setStatusError(englishError(error, 'Could not load the token status. Please try again.'));
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      void fetchStatus();
    } else if (!authLoading) {
      setStatusLoading(false);
    }
  }, [authLoading, isAdmin]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      showError('Enter an accessToken.');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please sign in again.');
      const res = await fetch('/api/study/admin-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ accessToken: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(englishError(data?.message, 'Could not save the token.'));

      showSuccess('Token saved. All users will now use this token to view study-room availability.');
      setTokenInput('');
      void fetchStatus();
    } catch (err: unknown) {
      showError(englishError(err, 'Could not save the token. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size={56} label="Checking permissions" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in duration-700">
        <div className="bg-destructive/10 p-8 rounded-full ring-8 ring-destructive/5">
          <ShieldAlert className="w-16 h-16 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase">Access Denied</h1>
          <p className="text-muted-foreground text-lg max-w-md font-bold uppercase opacity-70">
            Administrator privileges required.
          </p>
        </div>
        <Button onClick={() => router.push('/')} variant="outline" className="font-black px-10 h-12 uppercase tracking-widest border-2 hover:bg-foreground hover:text-background transition-all">
          Return Home
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-black tracking-tighter italic uppercase">Study access token</h1>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1 opacity-70">
          This shared token is used to load study-room availability for all users.
        </p>
      </div>

      <div role={statusError ? 'alert' : 'status'} className="text-xs text-muted-foreground rounded-xl border border-border/60 bg-muted/20 p-3 font-medium">
        {statusLoading
          ? 'Checking status…'
          : statusError || (updatedAt
            ? `Last updated: ${new Date(updatedAt).toLocaleString('en-US')}`
            : 'No token is configured. Add one below.')}
        {statusError && <Button type="button" variant="outline" size="sm" disabled={statusLoading} onClick={() => void fetchStatus()} className="mt-3 block">Retry status check</Button>}
        {expiresAt && !statusError && (
          <div className={new Date(expiresAt).getTime() <= Date.now() ? 'mt-1 font-bold text-destructive' : 'mt-1'}>
            Expires: {new Date(expiresAt).toLocaleString('en-US')}
          </div>
        )}
      </div>

      <details className="text-xs text-muted-foreground rounded-xl border border-dashed border-border/60 bg-muted/20 p-3">
        <summary className="cursor-pointer font-bold">How to add a token</summary>
        <ol className="mt-3 space-y-1.5 list-decimal list-inside">
        <li>
          Open the <a href={OFFICIAL_STUDY_URL} target="_blank" rel="noopener noreferrer" className="underline font-medium">
            official study website
          </a>
           and sign in with your usual account.
        </li>
        <li>Press F12 to open Developer Tools, select Console, and run this command.</li>
        <li className="font-mono text-[11px] bg-background/70 rounded px-2 py-1 select-all break-all">
          localStorage.getItem(&quot;accessToken&quot;)
        </li>
        <li>Copy the returned token without its quotation marks and paste it below.</li>
        </ol>

        <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
        <Input
          aria-label="Study access token"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Paste accessToken"
          className="font-mono text-xs"
        />
        <Button type="submit" disabled={saving} className="font-black uppercase tracking-widest gap-2">
          <KeyRound className="size-4" /> {saving ? 'Saving…' : 'Save token'}
        </Button>
        </form>
      </details>
    </div>
  );
}
