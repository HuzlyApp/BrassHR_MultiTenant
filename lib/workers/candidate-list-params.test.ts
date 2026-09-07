import { describe, expect, it } from "vitest";
import {
  buildCandidatesListUrl,
  DEFAULT_CANDIDATES_PAGE_SIZE,
  parseCandidateListQueryParams,
  parseMatchScoreBounds,
  toListCandidateIdsRpcArgs,
} from "@/lib/workers/candidate-list-params";

describe("parseCandidateListQueryParams", () => {
  it("defaults to page size 25", () => {
    const params = parseCandidateListQueryParams(new URLSearchParams());
    expect(params.limit).toBe(DEFAULT_CANDIDATES_PAGE_SIZE);
    expect(params.offset).toBe(0);
    expect(params.excludeConverted).toBe(true);
  });

  it("parses search, filters, and sort", () => {
    const params = parseCandidateListQueryParams(
      new URLSearchParams({
        q: "nurse",
        skills: "ICU, BLS",
        jobRole: "RN",
        location: "Austin, TX",
        appliedFrom: "2026-01-01",
        appliedTo: "2026-01-31",
        matchScore: "80_90",
        sort: "name",
        sortDir: "asc",
        limit: "50",
        offset: "50",
      })
    );
    expect(params.q).toBe("nurse");
    expect(params.skills).toEqual(["ICU", "BLS"]);
    expect(params.jobRole).toBe("RN");
    expect(params.city).toBe("Austin");
    expect(params.state).toBe("TX");
    expect(params.limit).toBe(50);
    expect(params.offset).toBe(50);
    expect(params.sort).toBe("name");
    expect(params.sortDir).toBe("asc");
    expect(parseMatchScoreBounds(params.matchScore)).toEqual({
      min: 80,
      max: 90,
      maxInclusive: false,
    });
  });
});

describe("toListCandidateIdsRpcArgs", () => {
  it("maps params into RPC args with tenant scope", () => {
    const params = parseCandidateListQueryParams(
      new URLSearchParams({ q: "alice", skills: "ACLS", limit: "25", offset: "0" })
    );
    const args = toListCandidateIdsRpcArgs(params, "tenant-1");
    expect(args.p_tenant_id).toBe("tenant-1");
    expect(args.p_search).toBe("alice");
    expect(args.p_skills).toEqual(["ACLS"]);
    expect(args.p_limit).toBe(25);
    expect(args.p_exclude_converted).toBe(true);
  });
});

describe("buildCandidatesListUrl", () => {
  it("builds a relative workers URL with paging params", () => {
    expect(
      buildCandidatesListUrl("/api/workers?status=approved", {
        limit: 25,
        offset: 25,
        q: "bob",
        skills: "ICU",
        includePhotoUrls: true,
      })
    ).toBe(
      "/api/workers?status=approved&limit=25&offset=25&q=bob&skills=ICU&includePhotoUrls=1"
    );
  });
});
