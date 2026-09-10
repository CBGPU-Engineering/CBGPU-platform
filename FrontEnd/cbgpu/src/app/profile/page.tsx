'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import Image from 'next/image';
import { UserCircle2, Mail, Hash, Save, Loader2, Camera, KeyRound, Lock, ShieldAlert, Trash2, BellRing } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/spinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { isValidStudentId, STUDENT_ID_HINT } from '@/lib/studentId';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** 아바타는 항상 112px 이하로 렌더링되니, 업로드 전에 리사이즈/압축해서 저장 용량과
 * 매 페이지 로드 시 다운로드량을 줄인다. */
async function resizeImageToJpeg(file: File, maxSize = 256, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지 처리에 실패했습니다.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('이미지 변환에 실패했습니다.'))), 'image/jpeg', quality);
  });
}

const NOTIF_PREFS = [
  { key: 'notify_job_new', label: '새 제작 신청', hint: '3D프린팅/레이저 담당자에게: 신청이 들어오면', role: 'manager' as const },
  { key: 'notify_job_done', label: '제작 완료', hint: '내가 신청한 3D프린팅/레이저 커팅이 완료되면', role: 'anyone' as const },
  { key: 'notify_selfstudy_reminder', label: '자습신청 리마인더', hint: '오늘 13:15까지 자습신청을 안 했으면', role: 'student' as const },
  { key: 'notify_admin_signup', label: '새 회원가입', hint: '관리자에게: 새 계정이 가입하면', role: 'admin' as const },
  { key: 'notify_admin_gpu_request', label: 'GPU 예약 신청', hint: '관리자에게: GPU 예약 신청이 들어오면', role: 'admin' as const },
] as const;
type NotifPrefKey = typeof NOTIF_PREFS[number]['key'];

export default function Profile() {
  const { user, profile, refreshProfile, isLoading: authLoading, isAdmin, is3DPrintManager, isLaserCutManager } = useAuth();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notifPrefs, setNotifPrefs] = useState<Record<NotifPrefKey, boolean>>({
    notify_job_new: true,
    notify_job_done: true,
    notify_selfstudy_reminder: true,
    notify_admin_signup: true,
    notify_admin_gpu_request: true,
  });
  const [savingNotifKey, setSavingNotifKey] = useState<NotifPrefKey | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setStudentId(profile.student_id || '');
      setFullName(profile.full_name || '');
      // 컬럼이 없던 시절 가입한 계정도 DB default(true)를 따르므로, 값이 아예
      // 안 왔을 때만(undefined) 기본 true를 유지하고 그 외엔 저장된 값을 따른다.
      setNotifPrefs((prev) => {
        const next = { ...prev };
        for (const { key } of NOTIF_PREFS) {
          if (profile[key] !== undefined) next[key] = profile[key] !== false;
        }
        return next;
      });
    }
  }, [profile]);

  async function toggleNotifPref(key: NotifPrefKey) {
    if (!user) return;
    const next = !notifPrefs[key];
    setNotifPrefs((prev) => ({ ...prev, [key]: next }));
    setSavingNotifKey(key);
    try {
      const { error } = await supabase.from('profiles').update({ [key]: next }).eq('id', user.id);
      if (error) throw error;
    } catch (error: any) {
      setNotifPrefs((prev) => ({ ...prev, [key]: !next })); // revert on failure
      showError(error.message || '알림 설정 저장 실패');
    } finally {
      setSavingNotifKey(null);
    }
  }

  async function updateProfile() {
    if (!user) return;
    if (!isValidStudentId(studentId)) {
      showError(`학번 형식이 올바르지 않습니다. ${STUDENT_ID_HINT}`);
      return;
    }
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('profiles').update({
        student_id: studentId,
        full_name: fullName,
      }).eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      showSuccess('프로필이 업데이트됐습니다!');
    } catch (error: any) {
      showError(error.message || '업데이트 실패');
    } finally {
      setIsUpdating(false);
    }
  }

  async function changePassword() {
    if (!user?.email) return;

    if (newPassword.length < 6) {
      showError('새 비밀번호는 6자 이상이어야 합니다.'); return;
    }
    if (newPassword !== confirmPassword) {
      showError('새 비밀번호가 일치하지 않습니다.'); return;
    }

    setIsChangingPassword(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        showError('현재 비밀번호가 올바르지 않습니다.'); return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      showSuccess('비밀번호가 변경됐습니다!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      showError(error.message || '비밀번호 변경 실패');
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user) return;
    setIsDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { showError('세션이 만료되었습니다. 다시 로그인해주세요.'); return; }

      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { showError(body?.message || '계정 삭제 실패'); return; }

      await supabase.auth.signOut();
      showSuccess('계정이 삭제됐습니다.');
      router.push('/');
    } catch (error: any) {
      showError(error.message || '계정 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingAccount(false);
      setDeleteOpen(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!user || !file) return;

    if (!file.type.startsWith('image/')) {
      showError('이미지 파일만 업로드할 수 있습니다.'); return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showError('5MB 이하 이미지만 업로드할 수 있습니다.'); return;
    }

    setIsUploadingAvatar(true);
    try {
      const resized = await resizeImageToJpeg(file);
      const path = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, resized, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;

      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);
      if (dbError) throw dbError;

      await refreshProfile();
      showSuccess('프로필 사진이 변경됐습니다!');
    } catch (error: any) {
      showError(error.message || '업로드 실패');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <LoadingSpinner size={56} label="프로필 불러오는 중" />
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
      <h2 className="text-2xl font-black uppercase italic">Access Denied</h2>
      <p className="text-muted-foreground">Please sign in to view your profile.</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto mt-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="tilt-3d flex flex-col md:flex-row items-center gap-6 bg-card ring-1 ring-foreground/5 p-8 rounded-[2.5rem] shadow-lg">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingAvatar}
          className="relative shrink-0 group active:scale-95 transition-transform"
        >
          {profile?.avatar_url ? (
            <Image src={profile.avatar_url} alt="프로필 사진" width={112} height={112} className="w-28 h-28 rounded-full object-cover ring-8 ring-primary/5" />
          ) : (
            <div className="bg-primary/10 p-6 rounded-full ring-8 ring-primary/5">
              <UserCircle2 className="w-16 h-16 text-primary" />
            </div>
          )}
          <span className="absolute bottom-0 right-0 flex items-center justify-center size-9 rounded-full bg-primary text-primary-foreground ring-4 ring-card shadow-md group-hover:scale-110 transition-transform">
            {isUploadingAvatar ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          </span>
        </button>
        <div className="text-center md:text-left space-y-1">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">{profile?.full_name || 'Anonymous User'}</h1>
          <p className="text-muted-foreground font-bold flex items-center justify-center md:justify-start gap-2 text-xs opacity-60">
            <Mail className="size-3" /> {user.email}
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); updateProfile(); }}
        className="tilt-3d bg-card ring-1 ring-foreground/5 p-10 rounded-[2.5rem] shadow-lg space-y-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-primary ml-1 tracking-widest flex items-center gap-1.5">
              <UserCircle2 className="size-3" /> 이름 (Name)
            </label>
            <Input
              name="name"
              autoComplete="name"
              value={fullName}
              onChange={(e: any) => setFullName(e.target.value)}
              className="bg-background border-2 h-14 px-5 rounded-2xl font-black text-lg focus:ring-primary transition-all"
              placeholder="Your Name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-primary ml-1 tracking-widest flex items-center gap-1.5">
              <Hash className="size-3" /> 학번 (Student ID)
            </label>
            <Input
              name="student-id"
              autoComplete="off"
              inputMode="numeric"
              maxLength={4}
              value={studentId}
              onChange={(e: any) => setStudentId(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="bg-background border-2 h-14 px-5 rounded-2xl font-black text-lg focus:ring-primary transition-all"
              placeholder="2309"
            />
            <p className="text-[10px] text-muted-foreground font-medium ml-1">{STUDENT_ID_HINT}</p>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isUpdating}
          className="w-full h-16 rounded-2xl font-black text-xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-[0.98] gap-3"
        >
          {isUpdating ? <Loader2 className="size-6 animate-spin" /> : <Save className="size-6" />}
          {isUpdating ? "Saving Changes..." : "Save Profile"}
        </Button>
      </form>

      <form
        onSubmit={(e) => { e.preventDefault(); changePassword(); }}
        className="tilt-3d bg-card ring-1 ring-foreground/5 p-10 rounded-[2.5rem] shadow-lg space-y-8"
      >
        <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
          <KeyRound className="size-5 text-primary" /> 비밀번호 변경
        </h2>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-primary ml-1 tracking-widest flex items-center gap-1.5">
              <Lock className="size-3" /> 현재 비밀번호
            </label>
            <Input
              type="password"
              name="current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e: any) => setCurrentPassword(e.target.value)}
              className="bg-background border-2 h-14 px-5 rounded-2xl font-black text-lg focus:ring-primary transition-all"
              placeholder="••••••••"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-primary ml-1 tracking-widest flex items-center gap-1.5">
                <Lock className="size-3" /> 새 비밀번호
              </label>
              <Input
                type="password"
                name="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e: any) => setNewPassword(e.target.value)}
                className="bg-background border-2 h-14 px-5 rounded-2xl font-black text-lg focus:ring-primary transition-all"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-primary ml-1 tracking-widest flex items-center gap-1.5">
                <Lock className="size-3" /> 새 비밀번호 확인
              </label>
              <Input
                type="password"
                name="new-password-confirm"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e: any) => setConfirmPassword(e.target.value)}
                className="bg-background border-2 h-14 px-5 rounded-2xl font-black text-lg focus:ring-primary transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
          className="w-full h-16 rounded-2xl font-black text-xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-[0.98] gap-3"
        >
          {isChangingPassword ? <Loader2 className="size-6 animate-spin" /> : <KeyRound className="size-6" />}
          {isChangingPassword ? "변경 중..." : "비밀번호 변경"}
        </Button>
      </form>

      <div className="tilt-3d bg-card ring-1 ring-foreground/5 p-10 rounded-[2.5rem] shadow-lg space-y-6">
        <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
          <BellRing className="size-5 text-primary" /> 알림 설정
        </h2>
        <p className="text-xs text-muted-foreground font-medium -mt-2">
          CBGPU 앱을 설치해야 실제로 알림이 옵니다. 전부 기본으로 켜져 있어요.
        </p>
        <div className="divide-y divide-foreground/5">
          {NOTIF_PREFS.filter(({ role }) =>
            role === 'anyone' ||
            (role === 'manager' && (is3DPrintManager || isLaserCutManager)) ||
            (role === 'student' && !!profile?.student_id) ||
            (role === 'admin' && isAdmin)
          ).map(({ key, label, hint }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-bold">{label}</p>
                <p className="text-[11px] text-muted-foreground font-medium">{hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifPrefs[key]}
                disabled={savingNotifKey === key}
                onClick={() => toggleNotifPref(key)}
                className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
                  notifPrefs[key] ? 'bg-primary' : 'bg-foreground/15'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${
                    notifPrefs[key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="tilt-3d bg-card ring-1 ring-destructive/20 p-10 rounded-[2.5rem] shadow-lg space-y-6">
        <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2 text-destructive">
          <ShieldAlert className="size-5" /> 위험 구역
        </h2>
        <p className="text-sm text-muted-foreground font-bold">
          계정을 삭제하면 로그인할 수 없게 되고 이름, 학번, 프로필 사진이 모두 삭제됩니다. 되돌릴 수 없습니다.
        </p>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setDeleteOpen(true)}
          className="h-14 rounded-2xl font-black text-base uppercase tracking-widest gap-3"
        >
          <Trash2 className="size-5" /> 계정 삭제
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="계정을 삭제할까요?"
        description="이름, 학번, 프로필 사진이 삭제되고 다시 로그인할 수 없습니다. 되돌릴 수 없습니다."
        confirmLabel={isDeletingAccount ? '삭제 중...' : '계정 삭제'}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
