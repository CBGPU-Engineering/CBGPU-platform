'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, ExternalLink, RefreshCw, AlertTriangle, LayoutGrid, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { LoadingSpinner } from '@/components/ui/spinner';
import {
  getRooms, getRoomComposition, getSeatOccupations, getStudent, getStudents,
  getSelfStudyPolicy, getPeriodCountForDate, localDateStr, searchSelfStudy,
  type Room, type Seat, type Obstacle, type Student, type SelfStudyStatus,
} from '@/lib/eduset';

const OFFICIAL_STUDY_URL = 'https://cbsh.edu-set.com';
/** 정책을 못 받아왔을 때만 쓰는 최후의 추정치 */
const FALLBACK_MIN_PERIODS = 4;

function formatStudentLabel(student: Student): string {
  const studentNumber = student.grade * 1000 + student.classNo * 100 + student.number;
  return `${studentNumber} ${student.name}`;
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

      // /selfstudy/search는 승인 대기중인 신청까지 한 번에 보여준다. 막혀 있으면 null로 떨어지고
      // 방별 occupations(승인된 것만)로 대체한다.
      const selfStudyEntries = await searchSelfStudy({ date: dateStr }).catch(() => null);

      const data = await Promise.all(
        rooms.map(async (room): Promise<RoomData> => {
          if (!room.hasSeats) {
            return { room, seats: [], obstacles: [], occupantsBySeat: new Map(), occupancy: [] };
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
        const occupiedCount = [...d.occupantsBySeat.values()].filter((list) =>
          list.some((o) => o.period === selectedPeriod)
        ).length;
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
                  ? `${selectedPeriod}교시: ${selectedStudentEntry.roomName} ${selectedStudentEntry.seatName}번 자리에 신청했습니다.${
                      selectedStudentEntry.status === 'PENDING' ? ' (승인 대기중)' : ''
                    }`
                  : `${selectedPeriod}교시: 아직 신청하지 않았습니다.`}
              </p>
              {selectedStudentEntry && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 font-bold text-xs"
                  onClick={() => setOpenRoomId(selectedStudentEntry.roomId)}
                >
                  좌석 보기
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
          <img src="/3d-icons/calendar.webp" alt="" className="size-16 mx-auto mb-3 opacity-90" />
          {roomData.length === 0 ? '아직 확인 가능한 자습실 데이터가 없습니다.' : '검색 결과가 없습니다.'}
        </div>
      ) : (
        <div key={selectedPeriod} className="space-y-2">
          {sortedRoomData.map(({ room, seats, occupiedCount }, i) => {
            const total = seats.length;
            const ratio = room.hasSeats && total > 0 ? occupiedCount / total : 0;
            const highlighted = room.hasSeats && occupiedCount > 0;
            const clickable = room.hasSeats && total > 0;
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
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground shrink-0 uppercase tracking-widest">정원제</span>
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
                <DialogTitle>{openRoomData.room.name} 좌석 배치</DialogTitle>
                <DialogDescription>좌석 번호 옆에 학번/이름이 표시됩니다.</DialogDescription>
              </DialogHeader>
              <PeriodSelector periods={periods} selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} />
              <SeatMap
                room={openRoomData.room}
                seats={openRoomData.seats}
                obstacles={openRoomData.obstacles}
                occupantsBySeat={openRoomData.occupantsBySeat}
                selectedPeriod={selectedPeriod}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
