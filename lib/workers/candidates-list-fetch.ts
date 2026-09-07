import {
  buildCandidatesListUrl,
  DEFAULT_CANDIDATES_PAGE_SIZE,
} from "@/lib/workers/candidate-list-params";

/** @deprecated Prefer DEFAULT_CANDIDATES_PAGE_SIZE (25). Kept for export/bulk helpers. */
export const CANDIDATES_LIST_FETCH_LIMIT = 500;

export function withWorkersListFetchLimit(
  url: string,
  limit = CANDIDATES_LIST_FETCH_LIMIT
): string {
  const parsed = new URL(url, "http://localhost");
  if (!parsed.searchParams.has("limit")) {
    parsed.searchParams.set("limit", String(limit));
  }
  return `${parsed.pathname}${parsed.search}`;
}

function appendQueryParam(url: string, key: string, value: string): string {
  const parsed = new URL(url, "http://localhost");
  parsed.searchParams.set(key, value);
  return `${parsed.pathname}${parsed.search}`;
}

export type FetchAllWorkersResult<T> = {
  workers: T[];
  total: number;
};

export type FetchWorkersPageResult<T> = {
  workers: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  timingMs?: number;
};

export type CandidatesListQuery = {
  q?: string;
  jobRole?: string;
  location?: string;
  appliedFrom?: string;
  appliedTo?: string;
  status?: string;
  matchScore?: string;
  progressStatusId?: string;
  jobTitle?: string;
  stage?: string;
  sort?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  includePhotoUrls?: boolean;
};

/** Fetch a single page of candidates (server-side filters/sort/pagination). */
export async function fetchWorkersPageFromApi<T = Record<string, unknown>>(
  baseUrl: string,
  query: CandidatesListQuery = {},
  options?: { signal?: AbortSignal }
): Promise<FetchWorkersPageResult<T>> {
  const pageSize = query.pageSize ?? DEFAULT_CANDIDATES_PAGE_SIZE;
  const page = Math.max(1, query.page ?? 1);
  const offset = (page - 1) * pageSize;
  const pageUrl = buildCandidatesListUrl(baseUrl, {
    limit: pageSize,
    offset,
    q: query.q,
    jobRole: query.jobRole,
    location: query.location,
    appliedFrom: query.appliedFrom,
    appliedTo: query.appliedTo,
    status: query.status,
    matchScore: query.matchScore,
    progressStatusId: query.progressStatusId,
    jobTitle: query.jobTitle,
    stage: query.stage,
    sort: query.sort,
    sortDir: query.sortDir,
    includePhotoUrls: query.includePhotoUrls ?? true,
  });

  const res = await fetch(pageUrl, { cache: "no-store", signal: options?.signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Failed to fetch workers");
  }

  const workers: T[] = Array.isArray(data?.workers)
    ? data.workers
    : Array.isArray(data)
      ? data
      : [];
  const total = typeof data?.total === "number" ? data.total : workers.length;
  const limit = typeof data?.limit === "number" ? data.limit : pageSize;
  const resolvedOffset = typeof data?.offset === "number" ? data.offset : offset;

  return {
    workers,
    total,
    limit,
    offset: resolvedOffset,
    hasMore: Boolean(data?.hasMore) || resolvedOffset + workers.length < total,
    timingMs: typeof data?.timingMs === "number" ? data.timingMs : undefined,
  };
}

/** Page through `/api/workers` until all rows are loaded (export/bulk only). */
export async function fetchAllWorkersFromApi<T = Record<string, unknown>>(
  baseUrl: string,
  options?: { maxRows?: number; signal?: AbortSignal }
): Promise<FetchAllWorkersResult<T>> {
  const maxRows = options?.maxRows ?? 20_000;
  const pageSize = CANDIDATES_LIST_FETCH_LIMIT;
  const allRows: T[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total && allRows.length < maxRows) {
    const requestLimit = Math.min(pageSize, maxRows - allRows.length);
    const pageUrl = withWorkersListFetchLimit(
      appendQueryParam(baseUrl, "offset", String(offset)),
      requestLimit
    );
    const res = await fetch(pageUrl, { cache: "no-store", signal: options?.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data?.error === "string" ? data.error : "Failed to fetch workers");
    }

    const pageRows: T[] = Array.isArray(data?.workers)
      ? data.workers
      : Array.isArray(data)
        ? data
        : [];
    if (typeof data?.total === "number") total = data.total;
    allRows.push(...pageRows);
    if (pageRows.length === 0) break;
    offset += requestLimit;
    if (typeof data?.total === "number" && offset >= data.total) break;
  }

  return {
    workers: allRows,
    total: allRows.length > 0 ? allRows.length : Number.isFinite(total) ? total : 0,
  };
}

/** Keep header total and pagination footer in sync on candidate list screens. */
export function resolveCandidatesListTotal(params: {
  totalFromApi: number | null;
  visibleCount: number;
  hasClientFilters: boolean;
}): number {
  if (params.hasClientFilters) return params.visibleCount;
  if (typeof params.totalFromApi === "number") return params.totalFromApi;
  return params.visibleCount;
}
