import { supabase } from '@/lib/supabase';

export type GpuEndpoint = { gpu_id: number; public_url: string; internal_host: string; internal_port: number };

/** DB(gpu_endpoints)를 읽지 못할 때만 쓰는 마지막 수단 — 정상 값은 DB가 가진다. */
export const FALLBACK_GPU_ENDPOINTS: GpuEndpoint[] = [
  { gpu_id: 1, public_url: 'https://tonight-rep-admit-cooperation.trycloudflare.com', internal_host: '10.138.23.12', internal_port: 8001 },
  { gpu_id: 2, public_url: 'https://nearest-situations-elite-tools.trycloudflare.com', internal_host: '10.138.23.12', internal_port: 8002 },
  { gpu_id: 3, public_url: 'https://expressions-invention-investments-consortium.trycloudflare.com', internal_host: '10.138.23.12', internal_port: 8003 },
  { gpu_id: 4, public_url: 'https://september-notification-pants-whatever.trycloudflare.com', internal_host: '10.138.23.12', internal_port: 8004 },
];

export async function fetchGpuEndpoints(): Promise<GpuEndpoint[]> {
  const { data, error } = await supabase.from('gpu_endpoints')
    .select('gpu_id, public_url, internal_host, internal_port').order('gpu_id');
  if (error || !data?.length) return FALLBACK_GPU_ENDPOINTS;
  // 일부 행만 있어도 나머지는 폴백으로 채워 GPU가 사라지지 않게 한다.
  return FALLBACK_GPU_ENDPOINTS.map(fallback => (data as GpuEndpoint[]).find(row => row.gpu_id === fallback.gpu_id) ?? fallback);
}
