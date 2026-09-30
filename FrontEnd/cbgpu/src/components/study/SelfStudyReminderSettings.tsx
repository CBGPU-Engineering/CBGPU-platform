'use client';

import { useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { useAlert } from '@/lib/alert';
import { getNativeBridge, isNativeAppHint } from '@/lib/nativeBridge';

const TIMES = Array.from({ length: 30 }, (_, index) => {
  const total = 8 * 60 + index * 15;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
});
const REPEAT_MINUTES = [15, 30, 45, 60];

function todayKst() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function SelfStudyReminderSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState('13:15');
  const [repeatMinutes, setRepeatMinutes] = useState(30);
  const [repeatCount, setRepeatCount] = useState(2);
  const [saving, setSaving] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [hasUnacknowledgedAlert, setHasUnacknowledgedAlert] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setEnabled(!!profile.selfstudy_reminder_time && profile.notify_selfstudy_reminder === true);
    setTime(String(profile.selfstudy_reminder_time ?? '13:15').slice(0, 5));
    setRepeatMinutes(profile.selfstudy_reminder_repeat_minutes ?? 30);
    setRepeatCount(profile.selfstudy_reminder_repeat_count ?? 2);
  }, [profile]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('reminder') === '1') setOpen(true);
  }, []);

  useEffect(() => {
    if (!user || !open) return;
    let alive = true;
    async function loadAlert() {
      const date = todayKst();
      const [{ data: attempts }, { data: ack }] = await Promise.all([
        supabase.from('selfstudy_reminder_attempts').select('attempt').eq('user_id', user!.id).eq('study_date', date).limit(1),
        supabase.from('selfstudy_reminder_acknowledgements').select('user_id').eq('user_id', user!.id).eq('study_date', date).maybeSingle(),
      ]);
      if (alive) setHasUnacknowledgedAlert(!!attempts?.length && !ack);
    }
    void loadAlert();
    return () => { alive = false; };
  }, [user, open]);

  async function save() {
    if (!user || !profile?.student_id) { showError('로그인 후 학번을 등록해야 신청 알림을 설정할 수 있습니다.'); return; }
    if (!TIMES.includes(time)) { showError('오전 8시부터 오후 3시 15분까지 15분 단위로 선택해주세요.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        notify_selfstudy_reminder: enabled,
        selfstudy_reminder_time: time,
        selfstudy_reminder_repeat_minutes: repeatMinutes,
        selfstudy_reminder_repeat_count: repeatCount,
      }).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      showSuccess(enabled ? '신청 알림이 설정됐습니다.' : '신청 알림이 꺼졌습니다.');
      setOpen(false);
      if (enabled && isNativeAppHint()) {
        const bridge = getNativeBridge();
        if (bridge) {
          void bridge.requestNotificationPermission().then(async ({ granted }) => {
            if (!granted) return;
            const { data: { session } } = await supabase.auth.getSession();
            if (session) await bridge.syncSession({ accessToken: session.access_token, refreshToken: session.refresh_token });
          }).catch(() => {});
        }
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : '알림 설정을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function acknowledge() {
    if (!user) return;
    setAcknowledging(true);
    const { error } = await supabase.from('selfstudy_reminder_acknowledgements')
      .insert({ user_id: user.id, study_date: todayKst() });
    setAcknowledging(false);
    if (error) { showError(error.message); return; }
    setHasUnacknowledgedAlert(false);
    showSuccess('오늘 재알림을 중단했습니다.');
  }

  return <>
    <Button variant="outline" size="sm" className="font-bold gap-1.5 rounded-full" onClick={() => setOpen(true)}>
      <BellRing className="size-4" /><span className="hidden sm:inline">신청 알림</span>
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>자습신청 알림</DialogTitle>
          <DialogDescription>선택한 시각에 신청하지 않은 교시가 있으면 알려드려요. 한국 시간 기준입니다.</DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-4 py-2 sm:space-y-5">
          {!user || !profile?.student_id ? <p className="text-sm text-amber-600">로그인하고 학번을 등록하면 사용할 수 있습니다.</p> : null}
          <label className="flex items-center justify-between gap-4 rounded-xl border p-4 cursor-pointer">
            <span><strong className="block text-sm">신청 알림 받기</strong><span className="text-xs text-muted-foreground">동의한 경우에만 발송합니다.</span></span>
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="peer sr-only" />
            <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-muted-foreground/30 transition-colors peer-checked:bg-primary peer-checked:[&>span]:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 peer-focus-visible:ring-offset-2">
              <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform" />
            </span>
          </label>
          {!isNativeAppHint() && <p className="text-xs text-muted-foreground">웹에서는 알림이 전송되지 않습니다.</p>}
          <div className="space-y-2 text-sm font-semibold">
            <span id="reminder-time-label">첫 알림 시각</span>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger aria-labelledby="reminder-time-label" className="h-10 w-full bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="block text-xs font-normal text-muted-foreground">08:00 ~ 15:15, 15분 단위</span>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-3">
            <div className="min-w-0 space-y-2 text-sm font-semibold">
              <span id="reminder-repeat-minutes-label">재알림 간격</span>
              <Select value={String(repeatMinutes)} onValueChange={(value) => setRepeatMinutes(Number(value))}>
                <SelectTrigger aria-labelledby="reminder-repeat-minutes-label" className="h-10 w-full bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPEAT_MINUTES.map(value => <SelectItem key={value} value={String(value)}>{value}분마다</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2 text-sm font-semibold">
              <span id="reminder-repeat-count-label">재알림 횟수</span>
              <Select value={String(repeatCount)} onValueChange={(value) => setRepeatCount(Number(value))}>
                <SelectTrigger aria-labelledby="reminder-repeat-count-label" className="h-10 w-full bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 6 }, (_, count) => <SelectItem key={count} value={String(count)}>{count}회</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">신청을 완료하거나 오늘 알림을 확인하면 재알림이 멈춥니다. 오후 3시 15분 이후에는 보내지 않습니다.</p>
          {hasUnacknowledgedAlert && <Button type="button" variant="outline" className="w-full" disabled={acknowledging} onClick={acknowledge}>오늘 알림 확인 · 재알림 중단</Button>}
          <Button type="button" className="w-full" disabled={saving || !user || !profile?.student_id} onClick={save}>
            {saving && <Loader2 className="size-4 animate-spin mr-2" />}설정 저장
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
