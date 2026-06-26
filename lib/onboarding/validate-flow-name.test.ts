import { describe, expect, it, vi } from "vitest";
import {
  findDuplicateFlowName,
  isValidFlowNameInput,
  normalizeFlowNameKey,
} from "@/lib/onboarding/validate-flow-name";

describe("normalizeFlowNameKey", () => {
  it("compares names case-insensitively", () => {
    expect(normalizeFlowNameKey("Final Test")).toBe(normalizeFlowNameKey("final test"));
  });
});

describe("findDuplicateFlowName tenant-default scope", () => {
  it("allows names that match onboarding_flows records", async () => {
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: [{ id: "flow-1", name: "Final Test" }], error: null })),
      })),
    }));

    const supabase = { from } as never;

    const result = await findDuplicateFlowName(supabase, "tenant-1", "Final Test", {
      scope: "tenant-default",
    });

    expect(result).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("still validates required name input", async () => {
    const supabase = { from: vi.fn() } as never;
    expect(await findDuplicateFlowName(supabase, "tenant-1", " ", { scope: "tenant-default" })).toBe(
      "Workflow name is required."
    );
  });

  it("skips duplicate check when name unchanged", async () => {
    const supabase = { from: vi.fn() } as never;
    const result = await findDuplicateFlowName(supabase, "tenant-1", "Final Test", {
      scope: "tenant-default",
      excludeFlowName: "Final Test",
    });
    expect(result).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe("isValidFlowNameInput", () => {
  it("rejects empty and too-short names", () => {
    expect(isValidFlowNameInput("")).toBe("Workflow name is required.");
    expect(isValidFlowNameInput("a")).toBe("Workflow name must be at least 2 characters.");
    expect(isValidFlowNameInput("Final Test")).toBeNull();
  });
});
