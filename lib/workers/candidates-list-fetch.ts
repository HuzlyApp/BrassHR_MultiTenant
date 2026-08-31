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
