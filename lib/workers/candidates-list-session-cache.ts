import {
  invalidateStaffListCache,
  readStaffListCache,
  resetStaffListCacheForTests,
  writeStaffListCache,
  type StaffListCacheMeta,
} from "@/lib/lists/staff-list-session-cache";

let latestRequestId = 0;

export function readCandidatesListCache<T>(
  scope: string,
  key: string
): { rows: T[]; total: number } | null {
  const hit = readStaffListCache<T>("candidates", scope, key);
  if (!hit) return null;
  return { rows: hit.rows, total: hit.total };
}

export function writeCandidatesListCache<T>(
  scope: string,
  key: string,
  rows: T[],
  total: number,
  sessionRows?: T[]
): void {
  writeStaffListCache("candidates", scope, key, rows, total, { sessionRows });
}

/** Drop cached lists after a candidate edit so Back does not restore stale rows. */
export function invalidateCandidatesListCache(): void {
  invalidateStaffListCache("candidates");
}

export function nextCandidatesListRequest(): number {
  latestRequestId += 1;
  return latestRequestId;
}

export function isLatestCandidatesListRequest(requestId: number): boolean {
  return requestId === latestRequestId;
}

export function resetCandidatesListCacheForTests(): void {
  latestRequestId = 0;
  resetStaffListCacheForTests();
}

export type { StaffListCacheMeta };
