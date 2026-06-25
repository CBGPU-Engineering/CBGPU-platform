/**
 * cbsh.edu-set.com(학생관리시스템) API 클라이언트.
 *
 * 학교 측 SaaS(edu-set)의 API는 CORS가 전면 허용(Access-Control-Allow-Origin: *)되어 있어
 * 브라우저에서 직접 호출 가능하다. 그래서 우리 서버를 거치지 않고 클라이언트에서 바로
 * api.cbsh.edu-set.com을 호출한다 — 학생 비밀번호가 우리 서버를 지나가지 않는다.
 */
const BASE_URL = '/api/study/proxy';
const TOKEN_KEY = 'eduset_token';
const TOKEN_EXPIRES_KEY = 'eduset_token_expires_at';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;
export const TURNSTILE_SITE_KEY = '0x4AAAAAAAhSoZoG7Vi6-ALf';

export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'HR_TEACHER';

export interface EdusetUser {
  id: number;
  role: Role;
  username?: string;
  email?: string;
}

export interface Student {
  id: number;
  name: string;
  grade: number;
  classNo: number;
  number: number;
}

export interface Me extends EdusetUser {
  student?: Student;
}

export interface Room {
  id: number;
  name: string;
  width: number;
  height: number;
  hasSeats: boolean;
}

export interface Seat {
  id: number;
  x: number;
  y: number;
  name: string;
}

export interface Obstacle {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
}

export interface RoomComposition {
  seats: Seat[];
  obstacles: Obstacle[];
}

export interface SeatOccupation {
  seatId: number;
  period: number;
  studentId: number;
  state?: string;
}

export interface SelfStudyPolicy {
  timetable: {
    presets: Record<string, unknown[]>;
    assign: Record<string, string>;
    exception: Record<string, string>;
  };
  timelimit: unknown;
}

/** 'YYYY-MM-DD'. UTC가 아니라 로컬(한국) 날짜 기준 — toISOString()은 자정~오전9시에 전날로 밀린다 */
export function localDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 해당 날짜에 자율학습이 몇 교시까지 있는지. 정책 자체가 없거나 그날 배정이 없으면 0 */
export function getPeriodCountForDate(policy: SelfStudyPolicy, date: Date): number {
  const { presets, assign, exception } = policy.timetable;
  const presetKey = exception[localDateStr(date)] ?? assign[date.getDay()];
  if (!presetKey) return 0;
  return presets[presetKey]?.length ?? 0;
}

function clearTokenStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRES_KEY);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRES_KEY) ?? '0');

  if (!token) {
    clearTokenStorage();
    return null;
  }

  if (expiresAt && Date.now() > expiresAt) {
    clearTokenStorage();
    return null;
  }

  return token;
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const normalized = token.startsWith('Bearer ') ? token.slice(7) : token;
  localStorage.setItem(TOKEN_KEY, normalized);
  localStorage.setItem(TOKEN_EXPIRES_KEY, String(expiresAt));
}

export function signOut() {
  if (typeof window === 'undefined') return;
  clearTokenStorage();
}

/** JWT payload(base64url)를 디코드해서 userId를 꺼낸다 */
function decodeUserId(token: string): number {
  const payload = token.split('.')[1];
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  );
  return JSON.parse(json).userId;
}

class EdusetError extends Error {}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const rawToken = getToken();
  const token = rawToken?.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
  const res = await fetch(BASE_URL + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? {
        Authorization: `Bearer ${token}`,
        'x-jwt': token,
      } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401 && !path.startsWith('/auth/signin')) {
    signOut();
    throw new EdusetError('로그인이 만료되었습니다. 다시 로그인해주세요.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new EdusetError(body?.message ?? `요청 실패 (HTTP ${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signIn(id: string, password: string, turnstileResponse?: string): Promise<void> {
  const response = await fetch('/api/study/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, password, turnstileResponse }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message ?? '토큰 발급에 실패했습니다.');
  }

  const accessToken = data?.accessToken;
  if (!accessToken) {
    throw new Error('토큰 응답이 비어 있습니다.');
  }

  setToken(accessToken);
}

export async function getMe(): Promise<Me> {
  const token = getToken();
  if (!token) throw new EdusetError('로그인이 필요합니다.');
  const userId = decodeUserId(token);
  const user = await apiFetch<EdusetUser>(`/users/${userId}`);
  if (user.role !== 'STUDENT') return user;
  const student = await apiFetch<Student>(`/students/${userId}`);
  return { ...user, student };
}

export function getRooms(): Promise<Room[]> {
  return apiFetch('/rooms');
}

export function getStudents(): Promise<Student[]> {
  return apiFetch('/students');
}

/** /policies/:id 응답은 { data: <policy> } 형태로 한 번 더 감싸져 있다 */
export async function getSelfStudyPolicy(): Promise<SelfStudyPolicy> {
  const res = await apiFetch<{ data: SelfStudyPolicy }>('/policies/selfstudy');
  return res.data;
}

export function getRoomComposition(roomId: number): Promise<RoomComposition> {
  return apiFetch(`/rooms/${roomId}/composition`);
}

export function getSeatOccupations(roomId: number, dateStr: string): Promise<SeatOccupation[]> {
  return apiFetch(`/rooms/${roomId}/seats/occupations?date=${dateStr}`);
}

export function occupySeat(roomId: number, seatId: number, period: number, date: string): Promise<void> {
  return apiFetch(`/rooms/${roomId}/seats/${seatId}/occupy`, {
    method: 'POST',
    body: JSON.stringify({ period, date }),
  });
}

export function releaseSeat(roomId: number, seatId: number, period: number, date: string): Promise<void> {
  return apiFetch(`/rooms/${roomId}/seats/${seatId}/release`, {
    method: 'POST',
    body: JSON.stringify({ period, date }),
  });
}

const studentCache = new Map<number, Promise<Student>>();

/** 같은 학생을 여러 좌석에서 동시에 조회해도 한 번만 요청하도록 캐싱 */
export function getStudent(id: number): Promise<Student> {
  let p = studentCache.get(id);
  if (!p) {
    p = apiFetch<Student>(`/students/${id}`);
    studentCache.set(id, p);
  }
  return p;
}
