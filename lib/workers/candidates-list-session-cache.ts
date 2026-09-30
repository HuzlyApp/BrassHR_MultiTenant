const INVALIDATED_AT_KEY = "brasshr:candidates-list-invalidated-at";
const STORAGE_PREFIX = "brasshr:candidates-list:v1:";
const MAX_SESSION_BYTES = 120_000;

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

function validScope(scope: string): string | null {
  const trimmed = scope.trim();
  if (!trimmed || trimmed.startsWith(":") || trimmed.endsWith(":")) return null;
  return trimmed;
}

function hashKey(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function storageKey(scope: string, key: string): string {
  return `${STORAGE_PREFIX}${scope}:${hashKey(key)}`;
}

function readSessionEntry<T>(scope: string, key: string): CacheEntry<T> | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(scope, key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (parsed.scope !== scope || parsed.key !== key) return null;
    if (!Array.isArray(parsed.rows) || typeof parsed.total !== "number") return null;
    if (parsed.storedAt <= readInvalidatedAt()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionEntry(entry: CacheEntry<unknown>): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const serialized = JSON.stringify(entry);
    if (serialized.length > MAX_SESSION_BYTES) return;
    sessionStorage.setItem(storageKey(entry.scope, entry.key), serialized);
  } catch {
    /* quota or private mode: memory cache still serves this tab */
  }
}

/**
 * One candidates list page, keyed by user and tenant.
 * Memory is the fast path. sessionStorage is the reload path: the page paints
 * those rows immediately and still revalidates. A missing user or tenant, or
 * a different user/tenant, never reads the stored rows.
 */
export function readCandidatesListCache<T>(scope: string, key: string): { rows: T[]; total: number } | null {
  const trimmedScope = validScope(scope);
  if (!trimmedScope) return null;
  const mapKey = cacheMapKey(trimmedScope, key);
  const entry = memory.get(mapKey);
  if (entry && entry.scope === trimmedScope && entry.storedAt > readInvalidatedAt()) {
    return { rows: entry.rows as T[], total: entry.total };
  }
  const stored = readSessionEntry<T>(trimmedScope, key);
  if (!stored) return null;
  memory.set(mapKey, stored);
  return { rows: stored.rows, total: stored.total };
}

export function writeCandidatesListCache<T>(scope: string, key: string, rows: T[], total: number): void {
  const trimmedScope = validScope(scope);
  if (!trimmedScope) return;
  const entry: CacheEntry<T> = {
    scope: trimmedScope,
    key,
    rows,
    total,
    storedAt: Date.now(),
  };
  memory.set(cacheMapKey(trimmedScope, key), entry);
  writeSessionEntry(entry);
}

/** Drop cached lists after a candidate edit so Back does not restore stale rows. */
export function invalidateCandidatesListCache(): void {
  memory.clear();
  memoryInvalidatedAt = Date.now();
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(INVALIDATED_AT_KEY, String(memoryInvalidatedAt));
  const stale: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const storageName = sessionStorage.key(i);
    if (storageName?.startsWith(STORAGE_PREFIX)) stale.push(storageName);
  }
  for (const storageName of stale) sessionStorage.removeItem(storageName);
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
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(INVALIDATED_AT_KEY);
    const stale: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const storageName = sessionStorage.key(i);
      if (storageName?.startsWith(STORAGE_PREFIX)) stale.push(storageName);
    }
    for (const storageName of stale) sessionStorage.removeItem(storageName);
  }
}
