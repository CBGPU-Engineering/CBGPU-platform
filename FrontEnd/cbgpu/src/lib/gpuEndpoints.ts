import { supabase } from '@/lib/supabase';

export type GpuEndpoint = { gpu_id: number; public_url: string; internal_host: string; internal_port: number };

/** DB(gpu_endpoints)를 읽지 못할 때만 쓰는 마지막 수단 — 정상 값은 DB가 가진다. */
export const FALLBACK_GPU_ENDPOINTS: GpuEndpoint[] = [
  { gpu_id: 1, public_url: 'https://gpu.cbgpu.com/1/', internal_host: '10.138.23.12', internal_port: 8001 },
  { gpu_id: 2, public_url: 'https://gpu.cbgpu.com/2/', internal_host: '10.138.23.12', internal_port: 8002 },
  { gpu_id: 3, public_url: 'https://gpu.cbgpu.com/3/', internal_host: '10.138.23.12', internal_port: 8003 },
  { gpu_id: 4, public_url: 'https://gpu.cbgpu.com/4/', internal_host: '10.138.23.12', internal_port: 8004 },
];

export async function fetchGpuEndpoints(): Promise<GpuEndpoint[]> {
  try {
    const { data, error } = await supabase.from('gpu_endpoints')
      .select('gpu_id, public_url, internal_host, internal_port').order('gpu_id');
    if (error || !Array.isArray(data)) return FALLBACK_GPU_ENDPOINTS;
    // 일부 행이나 잘못된 URL은 GPU별 폴백으로 보완한다.
    return FALLBACK_GPU_ENDPOINTS.map(fallback => {
      const row = data.find(row => Number(row.gpu_id) === fallback.gpu_id);
      if (!row) return fallback;
      let publicUrl = fallback.public_url;
      try {
        const url = new URL(typeof row.public_url === 'string' ? row.public_url.trim() : '');
        if (url.protocol === 'https:' && !url.username && !url.password) publicUrl = url.href;
      } catch { /* 유효하지 않은 URL은 고정 공개 주소를 사용한다. */ }
      return {
        ...fallback,
        public_url: publicUrl,
        internal_host: typeof row.internal_host === 'string' && row.internal_host ? row.internal_host : fallback.internal_host,
        internal_port: Number.isInteger(row.internal_port) && row.internal_port > 0 && row.internal_port <= 65535 ? row.internal_port : fallback.internal_port,
      };
    });
  } catch {
    return FALLBACK_GPU_ENDPOINTS;
  }
}
