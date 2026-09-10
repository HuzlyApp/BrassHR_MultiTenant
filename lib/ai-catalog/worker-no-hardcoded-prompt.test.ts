import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Candidate Match worker prompt source", () => {
  it("does not hard-code the Candidate Match system prompt body", () => {
    const service = readFileSync("lib/jobs/match-analysis/service.ts", "utf8");
    const pipeline = readFileSync("lib/jobs/match-analysis/pipeline.ts", "utf8");
    expect(service).not.toContain("You are an expert staffing matching analyst");
    expect(pipeline).not.toContain("You are an expert staffing matching analyst");
    expect(service).toContain("resolved.systemPrompt");
    expect(pipeline).toContain("resolvePromptVersion");
  });

  it("does not load prompt files at runtime", () => {
    const service = readFileSync("lib/jobs/match-analysis/service.ts", "utf8");
    expect(service).not.toMatch(/readFileSync|prompts\/.+\.txt|\.md"/);
  });
});
