'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, ExternalLink, RefreshCw, AlertTriangle, ChevronRight, User, Puzzle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { LoadingSpinner } from '@/components/ui/spinner';
import SelfStudyReminderSettings from '@/components/study/SelfStudyReminderSettings';
import SupervisorCard from '@/components/study/SupervisorCard';
import {
  getRooms, getRoomComposition, getSeatOccupations, getStudent, getStudents,
  getSelfStudyPolicy, getPeriodCountForDate, localDateStr, searchSelfStudy,
  type Room, type Seat, type Obstacle, type Student, type SelfStudyStatus,
} from '@/lib/eduset';

const OFFICIAL_STUDY_URL = 'https://cbsh.edu-set.com';
/** 정책을 못 받아왔을 때만 쓰는 최후의 추정치 */
const FALLBACK_MIN_PERIODS = 4;

function formatStudentLabel(student: Student): string {
  if (!student || typeof student.grade !== 'number' || typeof student.classNo !== 'number' || typeof student.number !== 'number') {
    return student?.name ?? '알 수 없음';
  }
  const studentNumber = student.grade * 1000 + student.classNo * 100 + student.number;
  return `${studentNumber} ${student.name}`;
}

/** 일시적인 네트워크/서버 오류에 대비해 짧은 간격으로 재시도한다 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 400): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

interface Occupant {
  label: string;
  period: number;
  status: SelfStudyStatus;
}

interface OccupancyEntry {
  roomId: number;
  roomName: string;
  seatName: string;
  period: number;
  label: string;
  studentId: number;
  status: SelfStudyStatus;
}

interface RoomData {
  room: Room;
  seats: Seat[];
  obstacles: Obstacle[];
  occupantsBySeat: Map<number, Occupant[]>;
  occupancy: OccupancyEntry[];
  /** true면 "신청자 없음"이 아니라 조회 자체가 실패한 것 — 0명과 구분해서 보여줘야 한다 */
  failed?: boolean;
}

function PeriodSelector({ periods, selectedPeriod, onSelect, className = '' }: {
  periods: number[];
  selectedPeriod: number;
  onSelect: (period: number) => void;
  className?: string;
}) {
  return (
    <SegmentedTabs
      items={periods.map((p) => ({ value: String(p), label: `${p}교시` }))}
      value={String(selectedPeriod)}
      onChange={(v) => onSelect(Number(v))}
      appearance="neutral"
      label="자습 교시 선택"
      className={className}
    />
  );
}

function SeatMap({ room, seats, obstacles, occupantsBySeat, selectedPeriod, failed, onRetry }: {
  room: Room;
  seats: Seat[];
  obstacles: Obstacle[];
  occupantsBySeat: Map<number, Occupant[]>;
  selectedPeriod: number;
  failed?: boolean;
  onRetry: () => void;
}) {
  const [view, setView] = useState('map');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [seatQuery, setSeatQuery] = useState('');
  const cellSize = 104;
  const rows = seats.map(seat => {
    const occupants = occupantsBySeat.get(seat.id)?.filter(o => o.period === selectedPeriod) ?? [];
    const pending = occupants.length > 0 && occupants.every(o => o.status === 'PENDING');
    return { seat, occupants, pending, status: occupants.length ? (pending ? '승인 대기' : '신청됨') : '빈자리' };
  });
  const selected = rows.find(row => row.seat.id === selectedId);
  const emptyCount = rows.filter(row => row.occupants.length === 0).length;
  const query = seatQuery.trim().toLocaleLowerCase();
  const filtered = rows.filter(row => `${row.seat.name} ${row.status} ${row.occupants.map(o => o.label).join(' ')}`.toLocaleLowerCase().includes(query))
    .sort((a, b) => a.seat.name.localeCompare(b.seat.name, 'ko', { numeric: true }));

  if (failed) {
    return <div role="alert" className="space-y-3 rounded-xl border p-4">
      <p className="text-sm">좌석 현황을 불러오지 못했습니다. 빈자리 여부를 확인할 수 없습니다.</p>
      <Button variant="outline" className="min-h-11" onClick={onRetry}>다시 불러오기</Button>
    </div>;
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          총 {seats.length}석 · <strong className="font-semibold text-foreground">빈자리 {emptyCount}석</strong> · 신청 {seats.length - emptyCount}석
        </p>
        <SegmentedTabs appearance="neutral" label="좌석 표시 방법" value={view} onChange={setView}
          items={[{ value: 'map', label: '배치도' }, { value: 'list', label: '목록' }]} />
      </div>

      {view === 'map' ? (
        <>
          <p className="text-sm text-muted-foreground">좌우·위아래로 스크롤해 배치를 확인하세요. 좌석을 누르면 전체 이름이 표시됩니다.</p>
          <div aria-live="polite" className="rounded-lg border border-border bg-card p-3 text-sm">
            {selected ? (
              <><p className="font-semibold">{selected.seat.name}번 좌석 · {selected.status}</p>
                <p className="mt-1 break-words text-muted-foreground">{selected.occupants.length
                  ? selected.occupants.map(o => `${o.label}${o.status === 'PENDING' ? ' (승인 대기)' : ''}`).join(' · ')
                  : '이 교시에 조회된 신청자가 없습니다.'}</p></>
            ) : <p className="text-muted-foreground">확인할 좌석을 선택하세요.</p>}
          </div>
          <div role="region" aria-label={`${selectedPeriod}교시 좌석 배치도, 스크롤 가능`} tabIndex={0}
            className="max-h-[50dvh] overflow-auto rounded-xl border border-border bg-muted p-3 focus-visible:outline-2 focus-visible:outline-ring">
            <div className="relative" style={{ width: room.width * cellSize, height: room.height * cellSize }}>
              {obstacles.map(ob => (
                <div key={`ob-${ob.id}`} className="absolute flex items-center justify-center overflow-hidden rounded border border-border bg-card px-1 text-center text-sm font-medium text-muted-foreground"
                  style={{ left: ob.x * cellSize, top: ob.y * cellSize, width: ob.w * cellSize, height: ob.h * cellSize }}
                  title={ob.name}>{ob.name}</div>
              ))}
              {rows.map(({ seat, occupants, pending, status }) => (
                <button key={seat.id} type="button" onClick={() => setSelectedId(seat.id)}
                  aria-pressed={selectedId === seat.id}
                  aria-label={`${seat.name}번 좌석, ${status}${occupants.length ? ', ' + occupants.map(o => o.label + (o.status === 'PENDING' ? ' 승인 대기' : '')).join(', ') : ''}`}
                  className={`absolute flex flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border-2 px-2 text-center focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-offset-2 ${selectedId === seat.id ? 'ring-2 ring-foreground ring-offset-2 ring-offset-muted' : ''} ${pending
                    ? 'border-dashed border-primary bg-card text-foreground'
                    : occupants.length ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-card text-foreground'}`}
                  style={{ left: seat.x * cellSize, top: seat.y * cellSize, width: cellSize - 8, height: cellSize - 8 }}>
                  <span className="text-base font-semibold leading-tight">{seat.name}</span>
                  <span className="text-xs font-medium">{status}</span>
                  {occupants.length > 0 && <span className="line-clamp-2 w-full break-words text-sm leading-tight">
                    {occupants.length === 1 ? occupants[0].label : `${occupants[0].label} 외 ${occupants.length - 1}명`}
                  </span>}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <Input type="search" aria-label="좌석 번호 또는 신청자 검색" placeholder="좌석 번호, 이름, 학번 또는 빈자리 검색"
            className="min-h-11" value={seatQuery} onChange={event => setSeatQuery(event.target.value)} />
          <div className="divide-y divide-border rounded-xl border border-border">
            {filtered.map(({ seat, occupants, status }) => <div key={seat.id} className="flex items-start gap-4 px-4 py-3">
              <span className="min-w-12 shrink-0 text-base font-semibold">{seat.name}번</span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${occupants.length ? 'text-primary' : 'text-muted-foreground'}`}>{status}</p>
                {occupants.map((o, index) => <p key={index} className="mt-1 break-words text-base">{o.label}{o.status === 'PENDING' ? ' · 승인 대기' : ''}</p>)}
              </div>
            </div>)}
            {!filtered.length && <p role="status" className="p-5 text-sm text-muted-foreground">일치하는 좌석이 없습니다.</p>}
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">조회 시점의 현황입니다. 신청·변경은 공식 사이트에서 진행하세요.</p>
    </div>
  );
}

/** 정원제(좌석 없는) 자습실용 — 좌석 배치 대신 해당 교시 신청자만 단순 목록으로 보여준다 */
function CapacityList({ occupancy, selectedPeriod, failed, onRetry }: {
  occupancy: OccupancyEntry[]; selectedPeriod: number; failed?: boolean; onRetry?: () => void;
}) {
  const entries = occupancy.filter((o) => o.period === selectedPeriod);

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-amber-600 dark:text-amber-400 font-bold">
          신청자 명단을 불러오지 못했습니다. 0명이 아니라 조회 실패일 수 있습니다.
        </p>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            다시 시도
          </Button>
        )}
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">이 교시에 신청자가 없습니다.</p>;
  }

  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border">
      {entries.map((e, i) => (
        <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="text-base font-medium break-words">{e.label}</span>
          {e.status === 'PENDING' && (
            <span className="text-sm font-medium text-muted-foreground">승인 대기</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function StudyPage() {
  const [roomData, setRoomData] = useState<RoomData[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [periodCount, setPeriodCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [openRoomId, setOpenRoomId] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [searchMode, setSearchMode] = useState<'room' | 'student'>('room');

  const loadData = useCallback(async (fresh = false) => {
    setLoading(true);
    setError('');

    try {
      const today = new Date();
      const dateStr = localDateStr(today);

      // 서로 의존하지 않는 요청은 전부 한꺼번에 시작한다. 예전엔 (방·정책·학생) → (신청 현황) → (방별 구성)
      // 순서로 기다려서 왕복 지연이 세 번 쌓였다. 학생 목록은 학생 검색에서만 쓰므로 화면 표시를 막지 않는다.
      const policyPromise = getSelfStudyPolicy().catch(() => null);
      void getStudents().catch(() => []).then(setAllStudents);

      // /selfstudy/search는 승인 대기중인 신청까지 한 번에 보여준다. 정원제 방은 이 호출이
      // 유일한 데이터 소스라 좌석형보다 훨씬 더 중요하다 — 일시적 오류에 대비해 재시도한다.
      const selfStudyPromise = withRetry(() => searchSelfStudy({ date: dateStr }, { fresh }), 3, 400).catch(() => null);
      const rooms = await getRooms();

      const data = await Promise.all(
        rooms.map(async (room): Promise<RoomData> => {
          if (!room.hasSeats) {
            // 정원제 자습실은 좌석이 없어서 SeatMap은 못 그리지만, 신청자 명단 자체는
            // /selfstudy/search 응답에 seat: null로 같이 들어있으니 그대로 모아서 보여준다.
            // type 값이 좌석형과 다를 수 있어 room.id만으로 매칭한다 (좌석 없는 실이라 e.seat은 항상 비어있음).
            // /selfstudy/search가 이 계정 권한으로 아예 안 되는 경우, 좌석형 방과 동일하게
            // 방별 occupations 엔드포인트로 폴백한다 — 좌석이 없어도 room+period+student 단위
            // occupation 레코드 자체는 동일한 엔드포인트로 조회되는 경우가 많다.
            try {
              const occupancy: OccupancyEntry[] = [];
              const selfStudyEntries = await selfStudyPromise;
              const roomEntries = selfStudyEntries?.filter(
                (e) => e.room.id === room.id && e.status !== 'REJECTED'
              );

              if (selfStudyEntries && roomEntries) {
                roomEntries.forEach((e) => {
                  occupancy.push({
                    roomId: room.id, roomName: room.name, seatName: '',
                    period: e.period, label: formatStudentLabel(e.student),
                    studentId: e.student.id, status: e.status,
                  });
                });
              } else {
                const occupations = await getSeatOccupations(room.id, dateStr);
                const studentIds = [...new Set(occupations.map((o) => o.studentId))];
                const labelById = new Map<number, string>();
                await Promise.all(
                  studentIds.map(async (studentId) => {
                    try {
                      const student = await getStudent(studentId);
                      labelById.set(studentId, formatStudentLabel(student));
                    } catch {
                      // 정보를 못 가져오면 그 신청자는 비식별로 둔다
                    }
                  })
                );
                occupations.forEach((o) => {
                  const label = labelById.get(o.studentId);
                  if (!label) return;
                  occupancy.push({
                    roomId: room.id, roomName: room.name, seatName: '',
                    period: o.period, label, studentId: o.studentId, status: 'APPROVED',
                  });
                });
              }

              return { room, seats: [], obstacles: [], occupantsBySeat: new Map(), occupancy };
            } catch {
              return { room, seats: [], obstacles: [], occupantsBySeat: new Map(), occupancy: [], failed: true };
            }
          }
          try {
            // 방 구성 요청은 신청 현황 응답을 기다리지 않고 바로 시작한다 (selfStudyPromise는 아래에서 await).
            const composition = await getRoomComposition(room.id);
            const selfStudyEntries = await selfStudyPromise;
            const seatNameById = new Map(composition.seats.map((s) => [s.id, s.name]));
            const occupantsBySeat = new Map<number, Occupant[]>();
            const occupancy: OccupancyEntry[] = [];

            const addEntry = (
              seatId: number, seatName: string, period: number,
              studentId: number, label: string, status: SelfStudyStatus
            ) => {
              const list = occupantsBySeat.get(seatId) ?? [];
              list.push({ label, period, status });
              occupantsBySeat.set(seatId, list);
              occupancy.push({ roomId: room.id, roomName: room.name, seatName, period, label, studentId, status });
            };

            const roomEntries = selfStudyEntries?.filter(
              (e) => e.room.id === room.id && e.type === 'selfstudy' && e.status !== 'REJECTED' && e.seat
            );

            if (selfStudyEntries && roomEntries) {
              roomEntries.forEach((e) => {
                if (!e.seat) return;
                addEntry(e.seat.id, e.seat.name, e.period, e.student.id, formatStudentLabel(e.student), e.status);
              });
            } else {
              const occupations = await getSeatOccupations(room.id, dateStr);
              const studentIds = [...new Set(occupations.map((o) => o.studentId))];
              const labelById = new Map<number, string>();
              await Promise.all(
                studentIds.map(async (studentId) => {
                  try {
                    const student = await getStudent(studentId);
                    labelById.set(studentId, formatStudentLabel(student));
                  } catch {
                    // 정보를 못 가져오면 그 좌석은 비식별로 둔다
                  }
                })
              );
              occupations.forEach((o) => {
                const label = labelById.get(o.studentId);
                if (!label) return;
                addEntry(o.seatId, seatNameById.get(o.seatId) ?? '', o.period, o.studentId, label, 'APPROVED');
              });
            }

            return { room, seats: composition.seats, obstacles: composition.obstacles, occupantsBySeat, occupancy };
          } catch {
            return { room, seats: [], obstacles: [], occupantsBySeat: new Map(), occupancy: [], failed: true };
          }
        })
      );

      setRoomData(data);

      const policy = await policyPromise;
      const policyCount = policy ? getPeriodCountForDate(policy, today) : 0;
      if (policyCount > 0) {
        setPeriodCount(policyCount);
      } else {
        let maxObserved = 0;
        data.forEach(({ occupantsBySeat }) => {
          occupantsBySeat.forEach((list) => {
            list.forEach((o) => {
              if (o.period > maxObserved) maxObserved = o.period;
            });
          });
        });
        setPeriodCount(Math.max(FALLBACK_MIN_PERIODS, maxObserved));
      }
      setUpdatedAt(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '현황을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const periods = useMemo(
    () => Array.from({ length: periodCount }, (_, i) => i + 1),
    [periodCount]
  );

  useEffect(() => {
    if (periodCount > 0 && selectedPeriod > periodCount) {
      setSelectedPeriod(1);
    }
  }, [periodCount, selectedPeriod]);

  const filteredRoomData = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roomData;
    return roomData.filter(({ room }) => room.name.toLowerCase().includes(q));
  }, [roomData, query]);

  /** 신청자 많은 실이 맨 위로 오도록 정렬 */
  const sortedRoomData = useMemo(() => {
    return filteredRoomData
      .map((d) => {
        const occupiedCount = d.room.hasSeats
          ? [...d.occupantsBySeat.values()].filter((list) => list.some((o) => o.period === selectedPeriod)).length
          : d.occupancy.filter((o) => o.period === selectedPeriod).length;
        return { ...d, occupiedCount };
      })
      .sort((a, b) => b.occupiedCount - a.occupiedCount);
  }, [filteredRoomData, selectedPeriod]);

  const studentMatches = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return [];
    return allStudents
      .filter((s) => formatStudentLabel(s).toLowerCase().includes(q))
      .slice(0, 8);
  }, [allStudents, studentQuery]);

  const occupancyIndex = useMemo(() => roomData.flatMap((d) => d.occupancy), [roomData]);

  const selectedStudentEntry = useMemo(() => {
    if (!selectedStudent) return undefined;
    return occupancyIndex.find((e) => e.studentId === selectedStudent.id && e.period === selectedPeriod);
  }, [occupancyIndex, selectedStudent, selectedPeriod]);

  const openRoomData = openRoomId != null ? roomData.find((d) => d.room.id === openRoomId) : undefined;

  const clearStudentSearch = () => {
    setSelectedStudent(null);
    setStudentQuery('');
  };

  const openOfficialSite = () => {
    window.open(OFFICIAL_STUDY_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <section aria-labelledby="study-heading" className="py-2 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 id="study-heading" className="text-3xl font-semibold tracking-tight">자습신청</h1>
          <p className="mt-2 text-sm text-muted-foreground">여기서 현황을 확인하고, 신청·변경은 공식 사이트에서 진행하세요.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => loadData(true)}
            aria-label="자습 현황 새로고침"
            disabled={loading}
            className="flex items-center justify-center size-11 rounded-xl border bg-card transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Button onClick={openOfficialSite} className="min-h-11 gap-2">
            <ExternalLink className="size-4" />
            <span>신청·변경하기</span><span className="sr-only"> (공식 사이트, 새 탭)</span>
          </Button>
        </div>
      </div>

      <SupervisorCard />

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{loading ? (roomData.length ? '현황 업데이트 중 · 이전 결과를 표시합니다.' : '자습 현황을 불러오는 중…') : updatedAt ? `최근 조회 ${updatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}${error ? ' · 업데이트 실패, 이전 결과입니다.' : ''}` : '아직 조회된 현황이 없습니다.'}</p>

      {/* 교시 — 가장 자주 바뀌는 축이라 검색 모드와 무관하게 항상 맨 위에 고정 */}
      {periods.length > 0 && (
        <PeriodSelector periods={periods} selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} className="-mx-1 px-1" />
      )}

      {/* 자습실 / 학생, 하나의 검색 흐름으로 통합 */}
      <div className="space-y-3">
        <SegmentedTabs
          appearance="neutral"
          label="검색 방법 선택"
          items={[{ value: 'room', label: '자습실로 찾기' }, { value: 'student', label: '학생으로 찾기' }]}
          value={searchMode}
          onChange={(v) => setSearchMode(v as 'room' | 'student')}
        />

        {searchMode === 'room' ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              aria-label="자습실 검색"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="자습실 이름으로 검색"
              className="pl-9"
            />
          </div>
        ) : selectedStudent ? (
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-black text-sm">{formatStudentLabel(selectedStudent)}</p>
              <Button variant="ghost" size="sm" onClick={clearStudentSearch} className="font-bold text-xs">
                다른 학생 검색
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/10 p-3">
              <p className="text-sm">
                {selectedStudentEntry
                  ? `${selectedPeriod}교시: ${selectedStudentEntry.roomName}${
                      selectedStudentEntry.seatName ? ` ${selectedStudentEntry.seatName}번 자리` : ''
                    }에 신청했습니다.${selectedStudentEntry.status === 'PENDING' ? ' (승인 대기중)' : ''}`
                  : `${selectedPeriod}교시: 조회된 정보에서 신청 내역을 찾지 못했습니다. 공식 사이트에서도 확인해 주세요.`}
              </p>
              {selectedStudentEntry && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 font-bold text-xs"
                  onClick={() => setOpenRoomId(selectedStudentEntry.roomId)}
                >
                  {selectedStudentEntry.seatName ? '좌석 보기' : '명단 보기'}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={studentQuery}
              aria-label="학생 이름 또는 학번 검색"
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="이름 또는 학번으로 학생 검색"
              className="pl-9"
            />
            {studentQuery.trim() && (
              <div className="absolute z-10 mt-1 w-full rounded-2xl border border-border/60 bg-background shadow-lg divide-y divide-border/40 overflow-hidden max-h-72 overflow-y-auto">
                {studentMatches.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground text-center">일치하는 학생이 없습니다.</p>
                ) : (
                  studentMatches.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStudent(s)}
                      className="w-full p-3 text-left font-bold text-sm hover:bg-muted/40 transition-colors"
                    >
                      {formatStudentLabel(s)}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-4 mt-0.5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => loadData(true)}>
            다시 시도
          </Button>
        </div>
      )}

      {loading && roomData.length === 0 ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size={48} label="자습 현황 불러오는 중" />
        </div>
      ) : error && roomData.length === 0 ? null : sortedRoomData.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {roomData.length === 0 ? '아직 확인 가능한 자습실 데이터가 없습니다.' : '검색 결과가 없습니다.'}
          {query && <Button variant="outline" className="mt-4 min-h-11" onClick={() => setQuery('')}>전체 자습실 보기</Button>}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {sortedRoomData.map(({ room, seats, occupiedCount, failed }) => {
            const total = seats.length;
            const clickable = room.hasSeats ? total > 0 : true;
            return (
              <button
                key={room.id}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && setOpenRoomId(room.id)}
                className="w-full flex items-center gap-3 px-4 py-5 sm:px-6 text-left first:rounded-t-2xl last:rounded-b-2xl enabled:hover:bg-muted enabled:active:bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2 disabled:cursor-default"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-semibold text-base break-words">{room.name}</p>
                    {failed ? (
                      <span className="text-sm text-destructive">조회 실패 · 새로고침해 주세요</span>
                    ) : room.hasSeats ? (
                      <span className="text-sm text-muted-foreground tabular-nums">
                        <span className="font-semibold text-foreground">{occupiedCount}명</span> 신청 · 총 {total}석
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground tabular-nums">
                        정원제 · {occupiedCount}명 신청
                      </span>
                    )}
                  </div>
                  {clickable && <p className="text-sm text-muted-foreground">{room.hasSeats ? '좌석 보기' : '신청자 보기'}</p>}
                </div>
                {clickable && <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      <details className="rounded-2xl border bg-card p-4">
        <summary className="min-h-11 cursor-pointer font-semibold">알림 및 연결 설정</summary>
        <div className="flex flex-wrap items-center gap-3 pt-3"><SelfStudyReminderSettings /><Button asChild variant="outline" className="min-h-11"><Link href="/study/contribute"><Puzzle className="size-4" /> 연결 기여하기</Link></Button></div>
      </details>

      <Dialog open={openRoomId != null} onOpenChange={(open) => !open && setOpenRoomId(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90dvh] overflow-y-auto">
          {openRoomData && (
            <>
              <DialogHeader>
                <DialogTitle>{openRoomData.room.name} {openRoomData.room.hasSeats ? '좌석 배치' : '신청자 명단'}</DialogTitle>
                <DialogDescription>
                  {openRoomData.room.hasSeats ? '좌석 번호 옆에 학번/이름이 표시됩니다.' : '정원제 자습실이라 좌석 없이 신청자만 표시됩니다.'}
                </DialogDescription>
              </DialogHeader>
              <PeriodSelector periods={periods} selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} />
              {openRoomData.room.hasSeats ? (
                <SeatMap
                  key={openRoomData.room.id}
                  room={openRoomData.room}
                  seats={openRoomData.seats}
                  obstacles={openRoomData.obstacles}
                  occupantsBySeat={openRoomData.occupantsBySeat}
                  selectedPeriod={selectedPeriod}
                  failed={openRoomData.failed}
                  onRetry={() => loadData(true)}
                />
              ) : (
                <CapacityList
                  occupancy={openRoomData.occupancy}
                  selectedPeriod={selectedPeriod}
                  failed={openRoomData.failed}
                  onRetry={() => loadData(true)}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
