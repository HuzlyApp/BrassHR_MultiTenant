import { describe, expect, it, vi } from "vitest";
import {
  buildCandidatesListUrl,
  parseCandidateListQueryParams,
  toListCandidateIdsRpcArgs,
} from "@/lib/workers/candidate-list-params";
import {
  normalizeCandidateListSearchDigits,
  normalizeCandidateListSearchText,
} from "@/lib/workers/candidate-search-normalize";
import { fetchWorkersPageFromApi } from "@/lib/workers/candidates-list-fetch";

describe("normalizeCandidateListSearchText", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeCandidateListSearchText("  Jane   Doe  ")).toBe("Jane Doe");
  });

  it("strips punctuation while keeping phone/email-safe chars", () => {
    expect(normalizeCandidateListSearchText("Jane, Doe!")).toBe("Jane Doe");
    expect(normalizeCandidateListSearchText("jane.doe@example.com")).toBe("jane.doe@example.com");
    expect(normalizeCandidateListSearchText("(555) 123-4567")).toBe("555 123-4567");
  });

  it("is case-preserving for the wire value (RPC lowercases)", () => {
    expect(normalizeCandidateListSearchText("ICU Nurse")).toBe("ICU Nurse");
  });
});

describe("normalizeCandidateListSearchDigits", () => {
  it("extracts phone digits when at least 3", () => {
    expect(normalizeCandidateListSearchDigits("(555) 123-4567")).toBe("5551234567");
    expect(normalizeCandidateListSearchDigits("12")).toBe("");
  });
});

describe("candidate list search params", () => {
  it("parses q and skills separately (AND semantics documented via p_skills)", () => {
    const params = parseCandidateListQueryParams(
      new URLSearchParams({
        q: "  Alice  Smith  ",
        skills: "ICU, BLS, icu",
        limit: "25",
        offset: "0",
      })
    );
    expect(params.q).toBe("Alice Smith");
    expect(params.skills).toEqual(["ICU", "BLS"]);
  });

  it("maps skills into RPC p_skills without merging into p_search", () => {
    const params = parseCandidateListQueryParams(
      new URLSearchParams({ q: "alice", skills: "ICU,ACLS" })
    );
    const args = toListCandidateIdsRpcArgs(params, "tenant-1");
    expect(args.p_search).toBe("alice");
    expect(args.p_skills).toEqual(["ICU", "ACLS"]);
    expect(args.p_tenant_id).toBe("tenant-1");
  });

  it("omits empty skills from RPC args", () => {
    const params = parseCandidateListQueryParams(new URLSearchParams({ q: "bob" }));
    const args = toListCandidateIdsRpcArgs(params, "tenant-1");
    expect(args.p_skills).toBeNull();
  });

  it("builds URL with separate skills param", () => {
    expect(
      buildCandidatesListUrl("/api/workers", {
        limit: 25,
        offset: 0,
        q: "nurse",
        skills: "ICU,BLS",
        includePhotoUrls: true,
      })
    ).toBe("/api/workers?limit=25&offset=0&q=nurse&skills=ICU%2CBLS&includePhotoUrls=1");
  });

  it("normalizes whitespace in q when building URL", () => {
    expect(
      buildCandidatesListUrl("/api/workers", {
        q: "  Jane   Doe  ",
        limit: 25,
        offset: 0,
      })
    ).toContain("q=Jane+Doe");
  });
});

describe("fetchWorkersPageFromApi search wiring", () => {
  it("sends q and skills as separate query params with pagination", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("q=Alice+Smith");
      expect(url).toContain("skills=ICU%2CBLS");
      expect(url).toContain("limit=25");
      expect(url).toContain("offset=25");
      return {
        ok: true,
        json: async () => ({
          workers: [{ id: "w1", first_name: "Alice" }],
          total: 26,
          limit: 25,
          offset: 25,
          hasMore: false,
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWorkersPageFromApi("/api/workers", {
      page: 2,
      pageSize: 25,
      q: "Alice Smith",
      skills: "ICU,BLS",
    });

    expect(result.total).toBe(26);
    expect(result.workers).toHaveLength(1);
    expect(result.offset).toBe(25);
    vi.unstubAllGlobals();
  });

  it("surfaces search failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "Search unavailable" }),
      }))
    );
    await expect(
      fetchWorkersPageFromApi("/api/workers", { q: "x", page: 1, pageSize: 25 })
    ).rejects.toThrow("Search unavailable");
    vi.unstubAllGlobals();
  });
});
