import { describe, expect, it } from "vitest";

/** Mirrors Industry Prompts editor dirty/unsaved detection. */
function promptEditorIsDirty(input: {
  systemPrompt: string;
  userPrompt: string;
  baselineSystem: string;
  baselineUser: string;
}): boolean {
  return input.systemPrompt !== input.baselineSystem || input.userPrompt !== input.baselineUser;
}

describe("industry prompt unsaved-change handling", () => {
  it("is clean when editor matches baseline", () => {
    expect(
      promptEditorIsDirty({
        systemPrompt: "A",
        userPrompt: "B",
        baselineSystem: "A",
        baselineUser: "B",
      })
    ).toBe(false);
  });

  it("detects system or user prompt edits", () => {
    expect(
      promptEditorIsDirty({
        systemPrompt: "A2",
        userPrompt: "B",
        baselineSystem: "A",
        baselineUser: "B",
      })
    ).toBe(true);
    expect(
      promptEditorIsDirty({
        systemPrompt: "A",
        userPrompt: "B2",
        baselineSystem: "A",
        baselineUser: "B",
      })
    ).toBe(true);
  });
});
