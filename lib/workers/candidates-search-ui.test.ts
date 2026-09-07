import { describe, expect, it } from "vitest";
import {
  buildCandidatesSearchApplyPayload,
  isCandidatesSearchDirty,
} from "@/lib/workers/candidates-search-ui";

describe("candidates search UI helpers", () => {
  it("trims query and joins skills for apply payload", () => {
    expect(
      buildCandidatesSearchApplyPayload({
        query: "  Jane Doe  ",
        skillTags: ["ICU", " BLS "],
      })
    ).toEqual({ query: "Jane Doe", skillsFilter: "ICU, BLS" });
  });

  it("detects dirty draft vs applied search", () => {
    expect(
      isCandidatesSearchDirty({
        draftQuery: "a",
        appliedQuery: "a",
        draftSkillsKey: "icu",
        appliedSkillsKey: "icu",
      })
    ).toBe(false);
    expect(
      isCandidatesSearchDirty({
        draftQuery: "a",
        appliedQuery: "b",
        draftSkillsKey: "",
        appliedSkillsKey: "",
      })
    ).toBe(true);
  });

  it("supports empty reset payload", () => {
    expect(buildCandidatesSearchApplyPayload({ query: "   ", skillTags: [] })).toEqual({
      query: "",
      skillsFilter: "",
    });
  });
});
