'use client';
import Link from 'next/link';
import Image from 'next/image';
import {UserCircle,ArrowRight} from 'lucide-react';
import {useAuth} from '@/lib/useAuth';
export default function AccountEntry({compact=false}:{compact?:boolean}){
 const {user,profile,isLoading}=useAuth();
 const name=profile?.full_name||user?.user_metadata?.full_name||user?.email?.split('@')[0]||'내 계정';
 return <Link href={user?'/profile':'/auth/login'} className={`cb-account-entry ${compact?'cb-account-compact':''}`} aria-label={user?`${name} 프로필 열기`:'로그인'} aria-busy={isLoading}>
 {profile?.avatar_url?<Image unoptimized src={profile.avatar_url} alt="" width={44} height={44} referrerPolicy="no-referrer"/>:<span className="cb-account-avatar"><UserCircle size={compact?22:28}/></span>}
 <span className="cb-account-copy"><strong>{isLoading?'계정 확인 중…':user?name:'로그인'}</strong>{!compact&&<small>{user?'내 정보와 계정 설정':'내 작업 이어서 보기'}</small>}</span><ArrowRight size={16}/></Link>
}
