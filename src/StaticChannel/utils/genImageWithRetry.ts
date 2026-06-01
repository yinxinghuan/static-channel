// Same retry wrapper pattern as Ferrofluid + Frost Crystals: the platform
// gen-image proxy enforces a per-IP cool-down (~1s as of 2026-06-01).
// Per-call latency is ~2.5s+, so sequential code rarely 429s; this exists for
// concurrent users sharing the same IP. Auto-retry with 3s backoff (1s limit
// + ~2s jitter buffer).

import type { UseGenImage, GenImageOptions } from '@shared/runtime';

export interface RetryProgress {
  attempt: number;
  maxAttempts: number;
  retrying: boolean;
  secondsLeft?: number;
}

export async function genImageWithRetry(
  genImg: UseGenImage,
  opts: GenImageOptions,
  onProgress?: (info: RetryProgress) => void,
  maxAttempts = 4,
  backoffMs = 3_000,
): Promise<string> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onProgress?.({ attempt, maxAttempts, retrying: false });
    try {
      return await genImg.generate(opts);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const isRateLimit = /HTTP 429|429|rate limit/i.test(lastError.message);
      if (!isRateLimit || attempt >= maxAttempts) break;
      const totalSec = Math.floor(backoffMs / 1000);
      for (let s = totalSec; s > 0; s--) {
        onProgress?.({ attempt: attempt + 1, maxAttempts, retrying: true, secondsLeft: s });
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  throw lastError ?? new Error('gen-image failed');
}
