'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, ExternalLink, RefreshCw, AlertTriangle, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  getRooms, getRoomComposition, getSeatOccupations, getStudent,
  getSelfStudyPolicy, getPeriodCountForDate, localDateStr,
  type Room, type Seat, type Obstacle, type Student,
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
}

interface RoomData {
  room: Room;
  seats: Seat[];
  obstacles: Obstacle[];
  occupantsBySeat: Map<number, Occupant[]>;
}

function PeriodSelector({ periods, selectedPeriod, onSelect, className = '' }: {
  periods: number[];
  selectedPeriod: number;
  onSelect: (period: number) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-1.5 overflow-x-auto pb-1 ${className}`}>
      {periods.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onSelect(p)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-widest border transition-colors ${
            selectedPeriod === p
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border/60 text-muted-foreground hover:border-primary/50'
          }`}
        >
          {p}교시
        </button>
      ))}
    </div>
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
          return (
            <div
              key={seat.id}
              title={occupied ? occupants!.map((o) => o.label).join(', ') : `${seat.name}: 비어있음`}
              className={`absolute rounded border flex flex-col items-center justify-center gap-0.5 overflow-hidden leading-tight px-0.5 ${
                occupied
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border/60 text-muted-foreground'
              }`}
              style={{ left: seat.x * cellSize, top: seat.y * cellSize, width: cellSize - 4, height: cellSize - 4 }}
            >
              <span className="text-[9px] font-black">{seat.name}</span>
              {occupied && (
                <span className="text-[8px] font-bold truncate w-full text-center">
                  {occupants!.map((o) => o.label).join(', ')}
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
  const [periodCount, setPeriodCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [openRoomId, setOpenRoomId] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [rooms, policy] = await Promise.all([
        getRooms(),
        getSelfStudyPolicy().catch(() => null),
      ]);
      const today = new Date();
      const dateStr = localDateStr(today);

      const data = await Promise.all(
        rooms.map(async (room): Promise<RoomData> => {
          if (!room.hasSeats) {
            return { room, seats: [], obstacles: [], occupantsBySeat: new Map() };
          }
          try {
            const [composition, occupations] = await Promise.all([
              getRoomComposition(room.id),
              getSeatOccupations(room.id, dateStr),
            ]);

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

            const occupantsBySeat = new Map<number, Occupant[]>();
            occupations.forEach((o) => {
              const label = labelById.get(o.studentId);
              if (!label) return;
              const list = occupantsBySeat.get(o.seatId) ?? [];
              list.push({ label, period: o.period });
              occupantsBySeat.set(o.seatId, list);
            });

            return { room, seats: composition.seats, obstacles: composition.obstacles, occupantsBySeat };
          } catch {
            return { room, seats: [], obstacles: [], occupantsBySeat: new Map() };
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

  const openRoomData = openRoomId != null ? roomData.find((d) => d.room.id === openRoomId) : undefined;

  const openOfficialSite = () => {
    window.open(OFFICIAL_STUDY_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="px-4 py-8 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter italic">자습신청</h1>
          <p className="hidden sm:block text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
            자습실별 현황을 확인하고 공식 사이트로 바로 이동합니다.
          </p>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openOfficialSite} size="sm" className="font-black uppercase tracking-widest gap-1.5">
            <ExternalLink className="size-4" />
            <span className="hidden sm:inline">공식 사이트로 가기</span>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="자습실 이름으로 검색"
          className="pl-9"
        />
      </div>

      {periods.length > 0 && (
        <PeriodSelector periods={periods} selectedPeriod={selectedPeriod} onSelect={setSelectedPeriod} className="-mx-1 px-1" />
      )}

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

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredRoomData.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          {roomData.length === 0 ? '아직 확인 가능한 자습실 데이터가 없습니다.' : '검색 결과가 없습니다.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRoomData.map(({ room, seats, occupantsBySeat }) => {
            const occupiedCount = [...occupantsBySeat.values()].filter((list) =>
              list.some((o) => o.period === selectedPeriod)
            ).length;
            const highlighted = room.hasSeats && occupiedCount > 0;
            return (
              <div
                key={room.id}
                className={`rounded-3xl border p-4 space-y-3 shadow-sm transition-colors ${
                  highlighted ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-background/70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-sm">{room.name}</p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {room.hasSeats ? `${room.width} x ${room.height}` : '좌석 없음'}
                    </p>
                  </div>
                  {room.hasSeats && (
                    <div
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest shrink-0 border ${
                        highlighted ? 'bg-primary text-primary-foreground border-primary' : 'border-border/50'
                      }`}
                    >
                      {occupiedCount}명 예약
                    </div>
                  )}
                </div>

                {room.hasSeats ? (
                  seats.length > 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full font-bold text-xs gap-1.5"
                      onClick={() => setOpenRoomId(room.id)}
                    >
                      <LayoutGrid className="size-3.5" /> 좌석 배치 보려면 누르세요
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">좌석 배치 정보를 불러오지 못했습니다.</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">좌석 없이 정원으로 운영되는 자습실입니다.</p>
                )}
              </div>
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

      <Button
        onClick={openOfficialSite}
        size="sm"
        className="fixed bottom-4 right-4 z-20 rounded-full px-4 py-3 font-black uppercase tracking-widest shadow-lg gap-1.5"
      >
        <ExternalLink className="size-4" />
        <span className="hidden sm:inline">자습신청 사이트</span>
      </Button>
    </main>
  );
}
