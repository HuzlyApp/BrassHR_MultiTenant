const INVALIDATED_AT_KEY = "brasshr:candidates-list-invalidated-at";

type CacheEntry<T> = {
  scope: string;
  key: string;
  rows: T[];
  total: number;
  storedAt: number;
};

const memory = new Map<string, CacheEntry<unknown>>();
let memoryInvalidatedAt = 0;
let latestRequestId = 0;

function readInvalidatedAt(): number {
  if (typeof sessionStorage === "undefined") return memoryInvalidatedAt;
  const parsed = Number(sessionStorage.getItem(INVALIDATED_AT_KEY));
  return Math.max(memoryInvalidatedAt, Number.isFinite(parsed) ? parsed : 0);
}

function cacheMapKey(scope: string, key: string): string {
  return `${scope}\n${key}`;
}

/**
 * Per-tab cache of one candidates list page. Rows are kept in memory only and
 * are keyed by user and tenant so a later session cannot read them.
 * sessionStorage stores only an invalidation timestamp, not candidate rows.
 */
export function readCandidatesListCache<T>(scope: string, key: string): { rows: T[]; total: number } | null {
  const trimmedScope = scope.trim();
  if (!trimmedScope || trimmedScope.startsWith(":") || trimmedScope.endsWith(":")) return null;
  const entry = memory.get(cacheMapKey(trimmedScope, key));
  if (!entry || entry.scope !== trimmedScope) return null;
  if (entry.storedAt <= readInvalidatedAt()) return null;
  return { rows: entry.rows as T[], total: entry.total };
}

export function writeCandidatesListCache<T>(scope: string, key: string, rows: T[], total: number): void {
  const trimmedScope = scope.trim();
  if (!trimmedScope || trimmedScope.startsWith(":") || trimmedScope.endsWith(":")) return;
  const storedAt = Date.now();
  memory.set(cacheMapKey(trimmedScope, key), {
    scope: trimmedScope,
    key,
    rows,
    total,
    storedAt,
  });
}

/** Drop cached lists after a candidate edit so Back does not restore stale rows. */
export function invalidateCandidatesListCache(): void {
  memory.clear();
  memoryInvalidatedAt = Date.now();
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(INVALIDATED_AT_KEY, String(memoryInvalidatedAt));
}

export function nextCandidatesListRequest(): number {
  latestRequestId += 1;
  return latestRequestId;
}

export function isLatestCandidatesListRequest(requestId: number): boolean {
  return requestId === latestRequestId;
}

export function resetCandidatesListCacheForTests(): void {
  memory.clear();
  memoryInvalidatedAt = 0;
  latestRequestId = 0;
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(INVALIDATED_AT_KEY);
}
