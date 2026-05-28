const WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 30;

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

/** In-memory per-recruiter send cap (resets on process restart). */
export function checkCommunicationRateLimit(userId: string): { allowed: boolean; retryAfterSec?: number } {
  const key = userId.trim();
  if (!key) return { allowed: false };

  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (existing.count >= MAX_SENDS_PER_WINDOW) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - existing.windowStart)) / 1000);
    return { allowed: false, retryAfterSec };
  }

  existing.count += 1;
  return { allowed: true };
}
