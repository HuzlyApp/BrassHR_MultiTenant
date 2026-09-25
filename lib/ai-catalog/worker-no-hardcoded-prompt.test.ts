import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Candidate Match worker prompt source", () => {
  it("keeps the Quick Match body in prompts.ts, not inlined in the worker", () => {
    const service = readFileSync("lib/jobs/match-analysis/service.ts", "utf8");
    const pipeline = readFileSync("lib/jobs/match-analysis/pipeline.ts", "utf8");
    expect(service).not.toContain("You extract and classify a candidate against a JD");
    expect(pipeline).not.toContain("You extract and classify a candidate against a JD");
    expect(service).toContain("ANALYZE_SYSTEM_PROMPT");
    expect(service).toMatch(/resolved\?\.systemPrompt/);
    expect(pipeline).toContain("resolvePromptVersion");
  });

  it("does not load prompt files at runtime", () => {
    const service = readFileSync("lib/jobs/match-analysis/service.ts", "utf8");
    expect(service).not.toMatch(/readFileSync|prompts\/.+\.txt|\.md"/);
  });
});
