import { describe, expect, it } from "vitest";
import {
  formatWorkerPayRateDisplay,
  normalizeWorkerPayRateAmount,
  normalizeWorkerPayRatePeriod,
} from "./worker-pay-rate";

describe("worker pay rate helpers", () => {
  it("normalizes period labels", () => {
    expect(normalizeWorkerPayRatePeriod("hourly")).toBe("Hourly");
    expect(normalizeWorkerPayRatePeriod("WEEKLY")).toBe("Weekly");
    expect(normalizeWorkerPayRatePeriod("Monthly")).toBe("Monthly");
    expect(normalizeWorkerPayRatePeriod(null)).toBe("Hourly");
  });

  it("formats display with dynamic suffix", () => {
    expect(formatWorkerPayRateDisplay("25.00", "Hourly")).toBe("$ 25 / hr");
    expect(formatWorkerPayRateDisplay("1200", "Weekly")).toBe("$ 1200 / wk");
    expect(formatWorkerPayRateDisplay("4500.50", "Monthly")).toBe("$ 4500.5 / mo");
    expect(formatWorkerPayRateDisplay(null, "Hourly")).toBe("—");
  });

  it("validates amount", () => {
    expect(normalizeWorkerPayRateAmount("25")).toEqual({ ok: true, value: "25.00" });
    expect(normalizeWorkerPayRateAmount("")).toEqual({
      ok: false,
      error: "Pay rate is required.",
    });
  });
});
