'use client';

import { useEffect, useState } from 'react';
import { requestAi, type AiMode } from '@/lib/requestAi';

const inFlight = new Map<string, Promise<string>>();

function fingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function useCachedAi(mode: AiMode, input: string, scope: string, enabled = true) {
  const [result, setResult] = useState('');
  useEffect(() => {
    if (!enabled || !input.trim()) { setResult(''); return; }
    const key = `cbgpu.ai.v2:${mode}:${scope}:${fingerprint(input)}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const cached = JSON.parse(raw) as { text: string; at: number };
        if (typeof cached.text === 'string' && Date.now() - cached.at < 24 * 60 * 60 * 1000) {
          setResult(cached.text);
          return;
        }
      }
    } catch { /* storage may be unavailable */ }
    setResult('');
    let cancelled = false;
    let pending = inFlight.get(key);
    if (!pending) {
      pending = requestAi(mode, input);
      inFlight.set(key, pending);
      pending.then(() => inFlight.delete(key), () => inFlight.delete(key));
    }
    pending.then(text => {
      try { localStorage.setItem(key, JSON.stringify({ text, at: Date.now() })); } catch { /* optional cache */ }
      if (!cancelled) setResult(text);
    }).catch(() => {
      // An AI enhancement must never block the underlying page.
    });
    return () => { cancelled = true; };
  }, [mode, input, scope, enabled]);
  return result;
}
