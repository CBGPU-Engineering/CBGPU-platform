'use client';
import { useState, useEffect, useCallback } from 'react';
import { DoorOpen, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRooms, getSeatOccupations, getStudent, type Room } from '@/lib/eduset';

const OFFICIAL_STUDY_URL = 'https://cbsh.edu-set.com';

interface RoomSummary {
  room: Room;
  occupiedCount: number;
  occupants: string[];
}

export default function StudyPage() {
  const [roomSummaries, setRoomSummaries] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const rooms = await getRooms();
      const dateStr = new Date().toISOString().slice(0, 10);

      const summaries = await Promise.all(
        rooms.map(async (room) => {
          if (!room.hasSeats) {
            return { room, occupiedCount: 0, occupants: [] };
          }
          try {
            const occupations = await getSeatOccupations(room.id, dateStr);
            const studentIds = [...new Set(occupations.map((item) => item.studentId))];
            const names = (await Promise.all(
              studentIds.map(async (studentId) => {
                try {
                  const student = await getStudent(studentId);
                  return student.name;
                } catch {
                  return null;
                }
              })
            )).filter(Boolean) as string[];

            return {
              room,
              occupiedCount: occupations.length,
              occupants: names,
            };
          } catch {
            return { room, occupiedCount: 0, occupants: [] };
          }
        })
      );

      setRoomSummaries(summaries);
    } catch (err: any) {
      setError(err?.message ?? String(err) ?? '현황을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openOfficialSite = () => {
    window.open(OFFICIAL_STUDY_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="px-4 py-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">자습신청</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
            자습실별 현황과 예약자 이름을 빠르게 확인하고 공식 사이트로 바로 이동합니다.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openOfficialSite} className="font-black uppercase tracking-widest gap-2">
            <ExternalLink className="size-4" /> 공식 사이트로 가기
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-muted/20 p-4 md:p-5 space-y-2">
        <p className="text-sm text-muted-foreground font-medium">
          현재 페이지는 자습실 현황 확인용입니다. 신청/취소는 공식 사이트에서 진행합니다.
        </p>
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

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : roomSummaries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          아직 확인 가능한 자습실 데이터가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roomSummaries.map(({ room, occupiedCount, occupants }) => (
            <div key={room.id} className="rounded-3xl border border-border/50 bg-background/70 p-4 space-y-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-sm">{room.name}</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                    {room.hasSeats ? `${room.width} x ${room.height}` : '좌석 없음'}
                  </p>
                </div>
                {room.hasSeats && (
                  <div className="rounded-full border border-border/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest">
                    {occupiedCount}명 예약
                  </div>
                )}
              </div>

              {room.hasSeats && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DoorOpen className="size-4" />
                  <span>{occupants.length > 0 ? occupants.join(', ') : '현재 예약자가 없습니다.'}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={openOfficialSite}
        className="fixed bottom-4 right-4 z-20 rounded-full px-4 py-3 font-black uppercase tracking-widest shadow-lg"
      >
        <ExternalLink className="size-4" /> 자습신청 사이트
      </Button>
    </main>
  );
}
