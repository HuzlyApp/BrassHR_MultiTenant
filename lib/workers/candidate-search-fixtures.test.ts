import { describe, expect, it } from "vitest";
import {
  candidateListRequiresServerSearch,
  parseCandidateListQueryParams,
  toListCandidateIdsRpcArgs,
} from "@/lib/workers/candidate-list-params";

/**
 * Realistic candidate search fixtures (unit-level).
 * Server RPC keeps searches tenant-scoped and excludes converted employment rows
 * when p_exclude_converted is true (default All Candidates behavior).
 */
const FIXTURES = {
  fullName: { q: "Jane Doe", skills: "" },
  partialName: { q: "jan", skills: "" },
  email: { q: "jane.doe@hospital.org", skills: "" },
  phone: { q: "(555) 867-5309", skills: "" },
  resumeText: { q: "ventilator management", skills: "" },
  skillsOnly: { q: "", skills: "ICU, BLS" },
  combinedAnd: { q: "Jane", skills: "ICU,BLS" },
  whitespaceCase: { q: "  JANE   doe  ", skills: " icu , bls " },
  noResult: { q: "zzznomatch-xyz-999", skills: "UnobtaniumSkill" },
  pagination: { q: "nurse", skills: "ICU", limit: "25", offset: "25" },
} as const;

describe("candidate search fixtures → RPC args", () => {
  it("full-name search", () => {
    const args = toListCandidateIdsRpcArgs(
      parseCandidateListQueryParams(new URLSearchParams(FIXTURES.fullName)),
      "tenant-a"
    );
    expect(args.p_search).toBe("Jane Doe");
    expect(args.p_skills).toBeNull();
  });

  it("partial-name search", () => {
    const args = toListCandidateIdsRpcArgs(
      parseCandidateListQueryParams(new URLSearchParams(FIXTURES.partialName)),
      "tenant-a"
    );
    expect(args.p_search).toBe("jan");
  });

  it("email search preserves @", () => {
    const args = toListCandidateIdsRpcArgs(
      parseCandidateListQueryParams(new URLSearchParams(FIXTURES.email)),
      "tenant-a"
    );
    expect(args.p_search).toBe("jane.doe@hospital.org");
  });

  it("phone search normalizes punctuation for wire q (digits matched in RPC)", () => {
    const args = toListCandidateIdsRpcArgs(
      parseCandidateListQueryParams(new URLSearchParams(FIXTURES.phone)),
      "tenant-a"
    );
    expect(args.p_search).toBe("555 867-5309");
  });

  it("resume-text search", () => {
    const args = toListCandidateIdsRpcArgs(
      parseCandidateListQueryParams(new URLSearchParams(FIXTURES.resumeText)),
      "tenant-a"
    );
    expect(args.p_search).toBe("ventilator management");
  });

  it("skills-only search (AND across skills)", () => {
    const args = toListCandidateIdsRpcArgs(
      parseCandidateListQueryParams(new URLSearchParams(FIXTURES.skillsOnly)),
      "tenant-a"
    );
    expect(args.p_search).toBeNull();
    expect(args.p_skills).toEqual(["ICU", "BLS"]);
  });

  it("combined applicant + skills is AND (separate params)", () => {
    const args = toListCandidateIdsRpcArgs(
      parseCandidateListQueryParams(new URLSearchParams(FIXTURES.combinedAnd)),
      "tenant-a"
    );
    expect(args.p_search).toBe("Jane");
    expect(args.p_skills).toEqual(["ICU", "BLS"]);
  });

  it("case-insensitive / whitespace-normalized", () => {
    const args = toListCandidateIdsRpcArgs(
      parseCandidateListQueryParams(new URLSearchParams(FIXTURES.whitespaceCase)),
      "tenant-a"
    );
    expect(args.p_search).toBe("JANE doe");
    expect(args.p_skills).toEqual(["icu", "bls"]);
  });

  it("no-result search still sends filters", () => {
    const args = toListCandidateIdsRpcArgs(
      parseCandidateListQueryParams(new URLSearchParams(FIXTURES.noResult)),
      "tenant-a"
    );
    expect(args.p_search).toContain("zzznomatch");
    expect(args.p_skills).toEqual(["UnobtaniumSkill"]);
  });

  it("pagination after searching preserves q/skills and offset", () => {
    const args = toListCandidateIdsRpcArgs(
      parseCandidateListQueryParams(new URLSearchParams(FIXTURES.pagination)),
      "tenant-a"
    );
    expect(args.p_search).toBe("nurse");
    expect(args.p_skills).toEqual(["ICU"]);
    expect(args.p_limit).toBe(25);
    expect(args.p_offset).toBe(25);
  });

  it("reset clears search params", () => {
    const args = toListCandidateIdsRpcArgs(
      parseCandidateListQueryParams(new URLSearchParams()),
      "tenant-a"
    );
    expect(args.p_search).toBeNull();
    expect(args.p_skills).toBeNull();
    expect(args.p_offset).toBe(0);
  });

  it("multiple tenants stay scoped via p_tenant_id", () => {
    const params = parseCandidateListQueryParams(new URLSearchParams({ q: "alice" }));
    expect(toListCandidateIdsRpcArgs(params, "tenant-a").p_tenant_id).toBe("tenant-a");
    expect(toListCandidateIdsRpcArgs(params, "tenant-b").p_tenant_id).toBe("tenant-b");
  });

  it("excludes converted candidates by default (archived/hired employment)", () => {
    const args = toListCandidateIdsRpcArgs(
      parseCandidateListQueryParams(new URLSearchParams({ q: "alice" })),
      "tenant-a"
    );
    expect(args.p_exclude_converted).toBe(true);
  });

  it("marks free-text and skills as requiring server search", () => {
    expect(
      candidateListRequiresServerSearch(
        parseCandidateListQueryParams(new URLSearchParams({ q: "shawnda" }))
      )
    ).toBe(true);
    expect(
      candidateListRequiresServerSearch(
        parseCandidateListQueryParams(new URLSearchParams({ skills: "ICU" }))
      )
    ).toBe(true);
    expect(
      candidateListRequiresServerSearch(parseCandidateListQueryParams(new URLSearchParams()))
    ).toBe(false);
  });
});
