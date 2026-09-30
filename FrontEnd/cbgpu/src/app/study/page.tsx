'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, ExternalLink, RefreshCw, AlertTriangle, LayoutGrid, User, Puzzle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { LoadingSpinner } from '@/components/ui/spinner';
import SelfStudyReminderSettings from '@/components/study/SelfStudyReminderSettings';
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
      pill
      className={className}
    />
  );
}

function SeatMap({ room, seats, obstacles, occupantsBySeat, selectedPeriod }: {
  room: Room;
  seats: Seat[];
  obstacles: Obstacle[];
  occupantsBySeat: Map<number, Occupant[]>;
  selectedPeriod: number;
}) {
  const cellSize = 56;

  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 overflow-auto max-h-[360px]">
      <div
        className="relative mx-auto"
        style={{ width: room.width * cellSize, height: room.height * cellSize }}
      >
        {obstacles.map((ob) => (
          <div
            key={`ob-${ob.id}`}
            className="absolute rounded-sm bg-muted-foreground/20 border border-border/40 flex items-center justify-center text-[9px] text-muted-foreground font-bold overflow-hidden"
            style={{ left: ob.x * cellSize, top: ob.y * cellSize, width: ob.w * cellSize, height: ob.h * cellSize }}
            title={ob.name}
          >
            {ob.name}
          </div>
        ))}
        {seats.map((seat) => {
          const occupants = occupantsBySeat.get(seat.id)?.filter((o) => o.period === selectedPeriod);
          const occupied = !!occupants?.length;
          const pending = occupied && occupants!.every((o) => o.status === 'PENDING');
          return (
            <div
              key={seat.id}
              title={
                occupied
                  ? occupants!.map((o) => `${o.label}${o.status === 'PENDING' ? ' (대기)' : ''}`).join(', ')
                  : `${seat.name}: 비어있음`
              }
              className={`absolute rounded border flex flex-col items-center justify-center gap-0.5 overflow-hidden leading-tight px-0.5 ${
                pending
                  ? 'bg-amber-500 text-white border-amber-500'
                  : occupied
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border/60 text-muted-foreground'
              }`}
              style={{ left: seat.x * cellSize, top: seat.y * cellSize, width: cellSize - 4, height: cellSize - 4 }}
            >
              <span className="text-[9px] font-black">{seat.name}</span>
              {occupied && (
                <span className="text-[8px] font-bold truncate w-full text-center">
                  {occupants!.map((o) => o.label).join(', ')}
                  {pending ? ' (대기)' : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
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
    <div className="rounded-xl border border-border/50 bg-muted/10 divide-y divide-border/30 max-h-[360px] overflow-y-auto">
      {entries.map((e, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm font-bold">{e.label}</span>
          {e.status === 'PENDING' && (
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">대기</span>
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
  const [justFinished, setJustFinished] = useState(false);
  const [searchMode, setSearchMode] = useState<'room' | 'student'>('room');

  const loadData = useCallback(async () => {
    setLoading(true);
    setJustFinished(false);
    setError('');

    try {
      const [rooms, policy, students] = await Promise.all([
        getRooms(),
        getSelfStudyPolicy().catch(() => null),
        getStudents().catch(() => []),
      ]);
      setAllStudents(students);
      const today = new Date();
      const dateStr = localDateStr(today);

      // /selfstudy/search는 승인 대기중인 신청까지 한 번에 보여준다. 정원제 방은 이 호출이
      // 유일한 데이터 소스라 좌석형보다 훨씬 더 중요하다 — 일시적 오류에 대비해 재시도한다.
      const selfStudyEntries = await withRetry(() => searchSelfStudy({ date: dateStr }), 3, 400).catch(() => null);

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
            const composition = await getRoomComposition(room.id);
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
            return { room, seats: [], obstacles: [], occupantsBySeat: new Map(), occupancy: [] };
          }
        })
      );

      setRoomData(data);

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
      setJustFinished(true);
      setTimeout(() => setJustFinished(false), 600);
    } catch (err: any) {
      setError(err?.message ?? String(err) ?? '현황을 불러오지 못했습니다.');
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
    <main className="px-4 py-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">실시간 현황</p>
          <h1 className="text-3xl font-black tracking-tight">자습신청</h1>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <Link href="/study/contribute">
            <Button variant="outline" size="sm" className="font-bold gap-1.5 rounded-full">
              <Puzzle className="size-4" /><span className="hidden sm:inline">기여하기</span>
            </Button>
          </Link>
          <SelfStudyReminderSettings />
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="flex items-center justify-center size-10 rounded-full bg-card ring-1 ring-foreground/5 shadow-sm active:scale-90 transition-transform disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Button onClick={openOfficialSite} size="sm" className="font-black uppercase tracking-widest gap-1.5 rounded-full">
            <ExternalLink className="size-4" />
            <span className="hidden sm:inline">공식 사이트</span>
          </Button>
        </div>
      </div>

      {/* 교시 — 가장 자주 바뀌는 축이라 검색 모드와 무관하게 항상 맨 위에 고정 */}
      {periods.length > 0 && (
        <PeriodSelector periods={periods} selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} className="-mx-1 px-1" />
      )}

      {/* 자습실 / 학생, 하나의 검색 흐름으로 통합 */}
      <div className="space-y-3">
        <SegmentedTabs
          items={[{ value: 'room', label: '자습실로 찾기' }, { value: 'student', label: '학생으로 찾기' }]}
          value={searchMode}
          onChange={(v) => setSearchMode(v as 'room' | 'student')}
        />

        {searchMode === 'room' ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
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
                  : `${selectedPeriod}교시: 아직 신청하지 않았습니다.`}
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
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-4 mt-0.5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => loadData()}>
            다시 시도
          </Button>
        </div>
      )}

      {loading || justFinished ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner done={justFinished} size={64} label={justFinished ? '불러왔습니다' : '자습 현황 불러오는 중'} />
        </div>
      ) : sortedRoomData.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground pop-in-3d">
          <p style={{ fontFamily: 'Tossface', fontSize: 52, lineHeight: 1 }} className="mb-3">📅</p>
          {roomData.length === 0 ? '아직 확인 가능한 자습실 데이터가 없습니다.' : '검색 결과가 없습니다.'}
        </div>
      ) : (
        <div key={selectedPeriod} className="space-y-2">
          {sortedRoomData.map(({ room, seats, occupiedCount, failed }, i) => {
            const total = seats.length;
            const ratio = room.hasSeats && total > 0 ? occupiedCount / total : 0;
            const highlighted = occupiedCount > 0;
            const clickable = room.hasSeats ? total > 0 : true;
            return (
              <button
                key={room.id}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && setOpenRoomId(room.id)}
                style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                className={`tilt-3d w-full flex items-center gap-4 p-4 rounded-2xl bg-card ring-1 ring-foreground/5 shadow-sm text-left transition-opacity animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards ${
                  clickable ? '' : 'opacity-60'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-sm truncate">{room.name}</p>
                    {room.hasSeats ? (
                      <span className={`text-[11px] font-black shrink-0 ${highlighted ? 'text-primary' : 'text-muted-foreground'}`}>
                        {occupiedCount}/{total}
                      </span>
                    ) : failed ? (
                      <span className="text-[11px] font-black shrink-0 text-amber-500 flex items-center gap-1">
                        <AlertTriangle className="size-3" /> 조회 실패
                      </span>
                    ) : (
                      <span className={`text-[11px] font-black shrink-0 ${highlighted ? 'text-primary' : 'text-muted-foreground'}`}>
                        정원제 · {occupiedCount}명 신청
                      </span>
                    )}
                  </div>
                  {room.hasSeats && (
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500 ease-[var(--ease-spring)]"
                        style={{ width: `${Math.min(100, ratio * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                {clickable && <LayoutGrid className="size-4 text-muted-foreground shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={openRoomId != null} onOpenChange={(open) => !open && setOpenRoomId(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
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
                  room={openRoomData.room}
                  seats={openRoomData.seats}
                  obstacles={openRoomData.obstacles}
                  occupantsBySeat={openRoomData.occupantsBySeat}
                  selectedPeriod={selectedPeriod}
                />
              ) : (
                <CapacityList
                  occupancy={openRoomData.occupancy}
                  selectedPeriod={selectedPeriod}
                  failed={openRoomData.failed}
                  onRetry={() => loadData()}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
