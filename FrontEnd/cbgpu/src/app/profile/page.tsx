'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/lib/alert';
import { useAuth } from '@/lib/useAuth';
import { UserCircle2, Mail, Hash, Save, Loader2 } from 'lucide-react';

export default function Profile() {
  const { user, profile, refreshProfile, isLoading: authLoading } = useAuth();
  const { showError, showSuccess } = useAlert();
  const [isUpdating, setIsUpdating] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');

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

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-pulse font-black uppercase tracking-widest text-muted-foreground">Loading Profile...</div>
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
      <div className="flex flex-col md:flex-row items-center gap-6 bg-card border-2 p-8 rounded-[2.5rem] shadow-2xl">
        <div className="bg-primary/10 p-6 rounded-full ring-8 ring-primary/5">
          <UserCircle2 className="w-16 h-16 text-primary" />
        </div>
        <div className="text-center md:text-left space-y-1">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">{profile?.full_name || 'Anonymous User'}</h1>
          <p className="text-muted-foreground font-bold flex items-center justify-center md:justify-start gap-2 text-xs opacity-60">
            <Mail className="size-3" /> {user.email}
          </p>
        </div>
      </div>

      <div className="bg-card border-2 p-10 rounded-[2.5rem] shadow-2xl space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-primary ml-1 tracking-widest flex items-center gap-1.5">
              <UserCircle2 className="size-3" /> 이름 (Name)
            </label>
            <Input 
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
              value={studentId} 
              onChange={(e: any) => setStudentId(e.target.value)} 
              className="bg-background border-2 h-14 px-5 rounded-2xl font-black text-lg focus:ring-primary transition-all"
              placeholder="Student ID"
            />
          </div>
        </div>

        <Button 
          onClick={updateProfile} 
          disabled={isUpdating}
          className="w-full h-16 rounded-2xl font-black text-xl uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-[0.98] gap-3"
        >
          {isUpdating ? <Loader2 className="size-6 animate-spin" /> : <Save className="size-6" />}
          {isUpdating ? "Saving Changes..." : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}