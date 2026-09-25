import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Candidate Match worker prompt source", () => {
  it("resolves Quick / Verifications / Follow-Up / Deep / Submission from the catalog", () => {
    const service = readFileSync("lib/jobs/match-analysis/service.ts", "utf8");
    const pipeline = readFileSync("lib/jobs/match-analysis/pipeline.ts", "utf8");
    const submission = readFileSync("lib/jobs/match-analysis/generate-submission-resume.ts", "utf8");
    const draft = readFileSync("lib/jobs/match-analysis/draft-submission-resume.ts", "utf8");

    expect(service).not.toContain("ANALYZE_SYSTEM_PROMPT");
    expect(service).not.toContain("FOLLOW_UP_SYSTEM_PROMPT");
    expect(service).toMatch(/resolved\.systemPrompt/);
    expect(pipeline).toContain("resolvePromptVersion");
    expect(pipeline).toContain("matchProgressionVariantKey");
    expect(submission).toContain("resolved.systemPrompt");
    expect(submission).not.toMatch(/const SYSTEM_PROMPT = `/);
    expect(draft).toContain("resolvePromptVersion");
    expect(draft).toContain('variantKey: matchProgressionVariantKey("submission")');
  });

  it("does not load prompt files at runtime", () => {
    const service = readFileSync("lib/jobs/match-analysis/service.ts", "utf8");
    expect(service).not.toMatch(/readFileSync|prompts\/.+\.txt|\.md"/);
  });
});
