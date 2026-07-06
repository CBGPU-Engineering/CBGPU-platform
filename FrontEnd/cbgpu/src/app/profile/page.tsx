'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { getURL } from '@/lib/utils';
import { UserCircle2, Mail, Hash, Save, Loader2, Camera, KeyRound, Lock } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/spinner';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export default function Profile() {
  const { user, profile, refreshProfile, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setStudentId(profile.student_id || '');
      setFullName(profile.full_name || '');
    }
  }, [profile]);

  async function updateProfile() {
    if (!user) return;
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

  async function changeEmail() {
    if (!user?.email) return;

    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('올바른 이메일 주소를 입력해 주세요.'); return;
    }
    if (email === user.email) {
      showError('현재와 다른 이메일 주소를 입력해 주세요.'); return;
    }

    setIsChangingEmail(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: emailPassword,
      });
      if (verifyError) {
        showError('비밀번호가 올바르지 않습니다.'); return;
      }

      const { error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: getURL() + 'auth/callback' }
      );
      if (error) throw error;

      showSuccess('확인 메일을 보냈습니다. 기존/새 이메일의 인증 링크를 눌러 변경을 완료해 주세요.');
      setNewEmail('');
      setEmailPassword('');
    } catch (error: any) {
      showError(error.message || '이메일 변경 실패');
    } finally {
      setIsChangingEmail(false);
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
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
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
            <img src={profile.avatar_url} alt="프로필 사진" className="w-28 h-28 rounded-full object-cover ring-8 ring-primary/5" />
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
              value={studentId}
              onChange={(e: any) => setStudentId(e.target.value)}
              className="bg-background border-2 h-14 px-5 rounded-2xl font-black text-lg focus:ring-primary transition-all"
              placeholder="Student ID"
            />
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
        onSubmit={(e) => { e.preventDefault(); changeEmail(); }}
        className="tilt-3d bg-card ring-1 ring-foreground/5 p-10 rounded-[2.5rem] shadow-lg space-y-8"
      >
        <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
          <Mail className="size-5 text-primary" /> 이메일 변경
        </h2>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-primary ml-1 tracking-widest flex items-center gap-1.5">
              <Mail className="size-3" /> 새 이메일
            </label>
            <Input
              type="email"
              name="new-email"
              autoComplete="off"
              value={newEmail}
              onChange={(e: any) => setNewEmail(e.target.value)}
              className="bg-background border-2 h-14 px-5 rounded-2xl font-black text-lg focus:ring-primary transition-all"
              placeholder="new@email.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-primary ml-1 tracking-widest flex items-center gap-1.5">
              <Lock className="size-3" /> 비밀번호 확인
            </label>
            <Input
              type="password"
              name="current-password"
              autoComplete="current-password"
              value={emailPassword}
              onChange={(e: any) => setEmailPassword(e.target.value)}
              className="bg-background border-2 h-14 px-5 rounded-2xl font-black text-lg focus:ring-primary transition-all"
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isChangingEmail || !newEmail || !emailPassword}
          className="w-full h-16 rounded-2xl font-black text-xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-[0.98] gap-3"
        >
          {isChangingEmail ? <Loader2 className="size-6 animate-spin" /> : <Mail className="size-6" />}
          {isChangingEmail ? "변경 중..." : "이메일 변경"}
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
    </div>
  );
}
