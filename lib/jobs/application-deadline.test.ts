import { afterEach, describe, expect, it, vi } from "vitest";
import { jobApplicationDeadlineError } from "./validation";

afterEach(() => vi.useRealTimers());
describe("application deadline validation", () => {
  it("allows optional dates, today and future dates, and explains invalid deadlines", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 26, 12));
    expect(jobApplicationDeadlineError(null)).toBeUndefined();
    expect(jobApplicationDeadlineError("2026-11-26")).toBeUndefined();
    expect(jobApplicationDeadlineError("2026-12-01")).toBeUndefined();
    expect(jobApplicationDeadlineError("2020-01-01")).toMatch(/past/);
    expect(jobApplicationDeadlineError("2027-12-01")).toMatch(/six months/);
    expect(jobApplicationDeadlineError("nonsense")).toMatch(/valid/);
  });
});
