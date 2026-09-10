/**
 * Browser in-flight + short TTL cache for candidate profile and job detail GETs.
 * Dedupes the same URL fired by a page and its tabs, speeds repeat opens,
 * and lets list hover prefetch populate the first paint request.
 */

export const STAFF_DETAIL_CACHE_TTL_MS = 30_000;

type CacheEntry<T> = {
  expiresAt: number;
  ok: boolean;
  status: number;
  payload: T;
};

type FetchStaffDetailOptions = {
  ttlMs?: number;
  bust?: boolean;
};

const memory =
  ((globalThis as typeof globalThis & {
    __brassStaffDetailCache?: Map<string, CacheEntry<unknown>>;
    __brassStaffDetailInFlight?: Map<string, Promise<CacheEntry<unknown>>>;
  }).__brassStaffDetailCache ??= new Map());

const inFlight =
  ((globalThis as typeof globalThis & {
    __brassStaffDetailInFlight?: Map<string, Promise<CacheEntry<unknown>>>;
  }).__brassStaffDetailInFlight ??= new Map());

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function staffDetailCacheKey(url: string): string {
  return url;
}

export function invalidateStaffDetailCache(match?: string): void {
  if (!match) {
    memory.clear();
    return;
  }
  for (const key of [...memory.keys()]) {
    if (key.includes(match)) memory.delete(key);
  }
}

export function prefetchStaffDetail(url: string, ttlMs = STAFF_DETAIL_CACHE_TTL_MS): void {
  if (!isBrowser()) return;
  void fetchStaffDetailJson(url, { ttlMs });
}

export async function fetchStaffDetailJson<T>(
  url: string,
  options?: FetchStaffDetailOptions
): Promise<{ ok: boolean; status: number; payload: T }> {
  const ttlMs = options?.ttlMs ?? STAFF_DETAIL_CACHE_TTL_MS;
  const key = staffDetailCacheKey(url);

  if (!options?.bust) {
    const cached = memory.get(key) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > Date.now()) {
      return { ok: cached.ok, status: cached.status, payload: cached.payload };
    }
    const pending = inFlight.get(key) as Promise<CacheEntry<T>> | undefined;
    if (pending) {
      const entry = await pending;
      return { ok: entry.ok, status: entry.status, payload: entry.payload };
    }
  } else {
    memory.delete(key);
    inFlight.delete(key);
  }

  const request = (async () => {
    const response = await fetch(url, { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as T;
    const entry: CacheEntry<T> = {
      expiresAt: Date.now() + ttlMs,
      ok: response.ok,
      status: response.status,
      payload,
    };
    if (response.ok) {
      memory.set(key, entry);
    }
    return entry;
  })();

  inFlight.set(key, request as Promise<CacheEntry<unknown>>);
  try {
    const entry = await request;
    return { ok: entry.ok, status: entry.status, payload: entry.payload };
  } finally {
    inFlight.delete(key);
  }
}

export function candidateProfileApiUrl(workerId: string): string {
  return `/api/admin/candidates/${encodeURIComponent(workerId)}/profile`;
}

export function jobDetailsApiUrl(jobId: string): string {
  return `/api/admin/jobs/${encodeURIComponent(jobId)}?view=details`;
}

export function workerProfileApiUrl(workerId: string, applicationId?: string | null): string {
  const applicationQuery = applicationId
    ? `&applicationId=${encodeURIComponent(applicationId)}`
    : "";
  return `/api/admin/worker-profile?workerId=${encodeURIComponent(workerId)}${applicationQuery}`;
}

export function prefetchCandidateProfile(workerId: string): void {
  const id = workerId.trim();
  if (!id) return;
  prefetchStaffDetail(candidateProfileApiUrl(id));
}

export function prefetchWorkerProfile(workerId: string): void {
  const id = workerId.trim();
  if (!id) return;
  prefetchStaffDetail(workerProfileApiUrl(id));
}

export function prefetchJobDetails(jobId: string): void {
  const id = jobId.trim();
  if (!id) return;
  prefetchStaffDetail(jobDetailsApiUrl(id));
}
