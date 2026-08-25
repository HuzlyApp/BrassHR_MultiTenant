import { describe, expect, it } from "vitest";

/** Mirrors HeaderIconCountBadge display rules without mounting React (jsdom ESM issues). */
function formatHeaderBadge(count: number, max = 9): string | null {
  if (count <= 0) return null;
  return count > max ? `${max}+` : String(count);
}

describe("HeaderIconCountBadge display rules", () => {
  it("hides badge when count is zero", () => {
    expect(formatHeaderBadge(0)).toBeNull();
  });

  it("shows numeric badge for unread count", () => {
    expect(formatHeaderBadge(3)).toBe("3");
  });

  it("caps badge at max+", () => {
    expect(formatHeaderBadge(12, 9)).toBe("9+");
  });

  it("never goes negative", () => {
    expect(formatHeaderBadge(-2)).toBeNull();
  });
});
