/** Single-process limits for this host. Use a shared store before adding replicas. */
export class WindowRateLimiter {
  private entries = new Map<string, { count: number; expires: number }>();
  private limit: number;
  private windowMs: number;
  private maxEntries: number;
  constructor(limit: number, windowMs: number, maxEntries = 5000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxEntries = maxEntries;
  }

  allow(key: string, now = Date.now()): boolean {
    const existing = this.entries.get(key);
    if (existing && existing.expires > now) {
      if (existing.count >= this.limit) return false;
      existing.count++;
      return true;
    }
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      for (const [id, entry] of this.entries) {
        if (entry.expires <= now) this.entries.delete(id);
      }
      // Fail closed if the table is full, rather than evicting active limits.
      if (this.entries.size >= this.maxEntries) return false;
    }
    this.entries.set(key, { count: 1, expires: now + this.windowMs });
    return true;
  }
}

export class RequestBodyError extends Error {
  status: number;
  constructor(status: number) { super('Invalid request body'); this.status = status; }
}

/** Enforces actual bytes, including chunked requests without Content-Length. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new RequestBodyError(413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError(400);
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError(413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try { return JSON.parse(text); } catch { throw new RequestBodyError(400); }
  } finally { reader.releaseLock(); }
}
