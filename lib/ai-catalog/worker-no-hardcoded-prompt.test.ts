import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Candidate Match worker prompt source", () => {
  it("keeps Quick Match and Deep Match on the catalog resolve/render path", () => {
    const service = readFileSync("lib/jobs/match-analysis/service.ts", "utf8");
    const pipeline = readFileSync("lib/jobs/match-analysis/pipeline.ts", "utf8");
    expect(service).not.toContain("You extract and classify a candidate against a JD");
    expect(pipeline).not.toContain("You extract and classify a candidate against a JD");
    expect(service).not.toContain("ANALYZE_SYSTEM_PROMPT");
    expect(service).not.toContain("buildMatchAnalysisUserPrompt");
    expect(service).toContain("renderPromptTemplate");
    expect(service).toContain("resolved.systemPrompt");
    expect(pipeline).toContain("resolvePromptVersion");
    expect(pipeline).toContain('variantKey: promptVariantKey');
    expect(pipeline).not.toContain("hardcoded:quick_match");
  });

  it("does not load prompt files at runtime", () => {
    const service = readFileSync("lib/jobs/match-analysis/service.ts", "utf8");
    expect(service).not.toMatch(/readFileSync|prompts\/.+\.txt|\.md"/);
  });
});
