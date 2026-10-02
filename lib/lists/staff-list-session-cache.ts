/**
 * Session-scoped stale-while-revalidate cache for staff list pages.
 *
 * TanStack Query is mounted for header, branding, and messaging, but Candidates
 * and Jobs lists are local state plus `fetch`. Persisting the shared QueryClient
 * would also store notifications and other queries. This cache is limited to
 * one list page per user, tenant, route, and query key.
 *
 * Policy:
 * - Storage: in-memory for this tab, sessionStorage for reload. Not localStorage.
 * - Max age: 10 minutes. Older entries are ignored. Callers still revalidate.
 * - Scope: `userId:tenantId`. A missing or different user/tenant never matches.
 * - Session payload cap: 200 KB. Oversized entries stay in memory only.
 * - Logout, user change, and tenant switch call `clearStaffListSessionCache`.
 * - Mutations call `invalidateStaffListCache` for that route.
 * - The server remains authoritative. A cache hit never skips the API.
 */

export const STAFF_LIST_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const MAX_SESSION_BYTES = 200_000;

export type StaffListRoute = "candidates" | "jobs";

export type StaffListCacheMeta = Record<string, string | number | boolean | null>;

type CacheEntry<T> = {
  scope: string;
  route: StaffListRoute;
  key: string;
  rows: T[];
  total: number;
  storedAt: number;
  meta?: StaffListCacheMeta;
};

export type StaffListCacheHit<T> = {
  rows: T[];
  total: number;
  meta?: StaffListCacheMeta;
};

const ROUTES: StaffListRoute[] = ["candidates", "jobs"];

const memory = new Map<string, CacheEntry<unknown>>();
const invalidatedAt = new Map<StaffListRoute, number>();
let clock = () => Date.now();

function prefix(route: StaffListRoute): string {
  return `brasshr:${route}-list:v1:`;
}

function invalidatedKey(route: StaffListRoute): string {
  return `brasshr:${route}-list-invalidated-at`;
}

function now(): number {
  return clock();
}

function readInvalidatedAt(route: StaffListRoute): number {
  const memoryAt = invalidatedAt.get(route) ?? 0;
  if (typeof sessionStorage === "undefined") return memoryAt;
  const parsed = Number(sessionStorage.getItem(invalidatedKey(route)));
  return Math.max(memoryAt, Number.isFinite(parsed) ? parsed : 0);
}

function cacheMapKey(route: StaffListRoute, scope: string, key: string): string {
  return `${route}\n${scope}\n${key}`;
}

function validScope(scope: string): string | null {
  const trimmed = scope.trim();
  if (!trimmed || trimmed.startsWith(":") || trimmed.endsWith(":")) return null;
  const [userId, tenantId] = trimmed.split(":");
  if (!userId || !tenantId) return null;
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

function storageKey(route: StaffListRoute, scope: string, key: string): string {
  return `${prefix(route)}${scope}:${hashKey(key)}`;
}

function isFresh(storedAt: number, route: StaffListRoute): boolean {
  if (!Number.isFinite(storedAt)) return false;
  const current = now();
  if (storedAt > current + 60_000) return false;
  if (storedAt <= readInvalidatedAt(route)) return false;
  return current - storedAt <= STAFF_LIST_CACHE_MAX_AGE_MS;
}

function asHit<T>(entry: CacheEntry<T>): StaffListCacheHit<T> | null {
  if (!Array.isArray(entry.rows) || typeof entry.total !== "number") return null;
  if (!isFresh(entry.storedAt, entry.route)) return null;
  if (entry.meta) return { rows: entry.rows, total: entry.total, meta: entry.meta };
  return { rows: entry.rows, total: entry.total };
}

function readSessionEntry<T>(route: StaffListRoute, scope: string, key: string): CacheEntry<T> | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(route, scope, key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (parsed.scope !== scope || parsed.route !== route || parsed.key !== key) return null;
    if (!asHit(parsed)) return null;
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
    sessionStorage.setItem(storageKey(entry.route, entry.scope, entry.key), serialized);
  } catch {
    /* quota or disabled storage: memory still serves this tab */
  }
}

export function readStaffListCache<T>(
  route: StaffListRoute,
  scope: string,
  key: string
): StaffListCacheHit<T> | null {
  const trimmedScope = validScope(scope);
  if (!trimmedScope || !key) return null;
  const mapKey = cacheMapKey(route, trimmedScope, key);
  const entry = memory.get(mapKey) as CacheEntry<T> | undefined;
  if (entry && entry.scope === trimmedScope && entry.route === route && entry.key === key) {
    const hit = asHit(entry);
    if (hit) return hit;
    memory.delete(mapKey);
  }
  const stored = readSessionEntry<T>(route, trimmedScope, key);
  if (!stored) return null;
  memory.set(mapKey, stored);
  return asHit(stored);
}

export function writeStaffListCache<T>(
  route: StaffListRoute,
  scope: string,
  key: string,
  rows: T[],
  total: number,
  options?: { sessionRows?: T[]; meta?: StaffListCacheMeta }
): void {
  const trimmedScope = validScope(scope);
  if (!trimmedScope || !key || !Number.isFinite(total)) return;
  const entry: CacheEntry<T> = {
    scope: trimmedScope,
    route,
    key,
    rows,
    total,
    storedAt: now(),
    ...(options?.meta ? { meta: options.meta } : {}),
  };
  memory.set(cacheMapKey(route, trimmedScope, key), entry);
  writeSessionEntry({
    ...entry,
    rows: options?.sessionRows ?? rows,
  });
}

export function invalidateStaffListCache(route: StaffListRoute): void {
  const stamped = now();
  invalidatedAt.set(route, stamped);
  for (const mapKey of [...memory.keys()]) {
    if (mapKey.startsWith(`${route}\n`)) memory.delete(mapKey);
  }
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(invalidatedKey(route), String(stamped));
  const stale: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const storageName = sessionStorage.key(i);
    if (storageName?.startsWith(prefix(route))) stale.push(storageName);
  }
  for (const storageName of stale) sessionStorage.removeItem(storageName);
}

/** Drop every staff list entry. Use on logout, user change, and tenant switch. */
export function clearStaffListSessionCache(): void {
  memory.clear();
  const stamped = now();
  if (typeof sessionStorage === "undefined") {
    for (const route of ROUTES) invalidatedAt.set(route, stamped);
    return;
  }
  for (const route of ROUTES) {
    invalidatedAt.set(route, stamped);
    sessionStorage.setItem(invalidatedKey(route), String(stamped));
  }
  const stale: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const storageName = sessionStorage.key(i);
    if (!storageName) continue;
    if (ROUTES.some((route) => storageName.startsWith(prefix(route)))) stale.push(storageName);
  }
  for (const storageName of stale) sessionStorage.removeItem(storageName);
}

export function setStaffListCacheClockForTests(next: () => number): void {
  clock = next;
}

export function resetStaffListCacheForTests(): void {
  memory.clear();
  invalidatedAt.clear();
  clock = () => Date.now();
  if (typeof sessionStorage === "undefined") return;
  for (const route of ROUTES) sessionStorage.removeItem(invalidatedKey(route));
  const stale: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const storageName = sessionStorage.key(i);
    if (!storageName) continue;
    if (ROUTES.some((route) => storageName.startsWith(prefix(route)))) stale.push(storageName);
  }
  for (const storageName of stale) sessionStorage.removeItem(storageName);
}

const JOBS_LIST_KEY = "all";

export function readJobsListCache<T>(scope: string): StaffListCacheHit<T> | null {
  return readStaffListCache<T>("jobs", scope, JOBS_LIST_KEY);
}

export function writeJobsListCache<T>(
  scope: string,
  rows: T[],
  total: number,
  sessionRows?: T[],
  meta?: StaffListCacheMeta
): void {
  writeStaffListCache("jobs", scope, JOBS_LIST_KEY, rows, total, { sessionRows, meta });
}

export function invalidateJobsListCache(): void {
  invalidateStaffListCache("jobs");
}
