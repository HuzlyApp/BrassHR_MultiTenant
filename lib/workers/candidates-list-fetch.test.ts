import { describe, expect, it } from "vitest";
import {
  CANDIDATES_LIST_FETCH_LIMIT,
  resolveCandidatesListTotal,
  withWorkersListFetchLimit,
} from "@/lib/workers/candidates-list-fetch";
import {
  buildCandidatesListUrl,
  DEFAULT_CANDIDATES_PAGE_SIZE,
} from "@/lib/workers/candidate-list-params";

describe("withWorkersListFetchLimit", () => {
  it("adds default limit when missing", () => {
    expect(withWorkersListFetchLimit("/api/workers?includePhotoUrls=1")).toBe(
      `/api/workers?includePhotoUrls=1&limit=${CANDIDATES_LIST_FETCH_LIMIT}`
    );
  });

  it("preserves an explicit limit", () => {
    expect(withWorkersListFetchLimit("/api/workers?limit=25")).toBe("/api/workers?limit=25");
  });
});

describe("resolveCandidatesListTotal", () => {
  it("uses visible count when client filters are active", () => {
    expect(
      resolveCandidatesListTotal({
        totalFromApi: 500,
        visibleCount: 12,
        hasClientFilters: true,
      })
    ).toBe(12);
  });

  it("uses API total when unfiltered", () => {
    expect(
      resolveCandidatesListTotal({
        totalFromApi: 500,
        visibleCount: 500,
        hasClientFilters: false,
      })
    ).toBe(500);
  });
});

describe("DEFAULT_CANDIDATES_PAGE_SIZE", () => {
  it("defaults to 25 for server-side paging", () => {
    expect(DEFAULT_CANDIDATES_PAGE_SIZE).toBe(25);
    expect(
      buildCandidatesListUrl("/api/workers", {
        limit: DEFAULT_CANDIDATES_PAGE_SIZE,
        offset: 0,
        includePhotoUrls: true,
      })
    ).toBe(`/api/workers?limit=${DEFAULT_CANDIDATES_PAGE_SIZE}&offset=0&includePhotoUrls=1`);
  });
});
