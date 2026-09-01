/** Max rows the workers list API returns in one request (see parseWorkersListParams). */
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

/** Page through `/api/workers` until all rows are loaded (or maxRows reached). */
export async function fetchAllWorkersFromApi<T = Record<string, unknown>>(
  baseUrl: string,
  options?: { maxRows?: number }
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
    const res = await fetch(pageUrl, { cache: "no-store" });
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
