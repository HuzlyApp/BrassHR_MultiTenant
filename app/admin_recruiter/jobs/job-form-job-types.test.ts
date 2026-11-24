import { describe, expect, it } from "vitest";
import {
  jobFormJobTypesInclude,
  parseJobFormJobTypes,
  serializeJobFormJobTypes,
  toDateInputValue,
  toggleJobFormJobType,
} from "./job-form-shared";

describe("toDateInputValue", () => {
  it("keeps YYYY-MM-DD values", () => {
    expect(toDateInputValue("2026-11-30")).toBe("2026-11-30");
  });

  it("strips time from ISO timestamps for date inputs", () => {
    expect(toDateInputValue("2026-11-30T00:00:00.000Z")).toBe("2026-11-30");
    expect(toDateInputValue("2026-12-01 15:30:00+00")).toBe("2026-12-01");
  });

  it("returns null for empty/invalid values", () => {
    expect(toDateInputValue(null)).toBeNull();
    expect(toDateInputValue("")).toBeNull();
    expect(toDateInputValue("not-a-date")).toBeNull();
  });
});

describe("job form employment type chips", () => {
  it("parses a single legacy value", () => {
    expect(parseJobFormJobTypes("Full-time")).toEqual(["Full-time"]);
  });

  it("normalizes Travel/Local Contract aliases", () => {
    expect(parseJobFormJobTypes("Travel contract")).toEqual(["Travel Contract"]);
    expect(parseJobFormJobTypes("local contract, Per-Diem")).toEqual([
      "Local Contract",
      "Paid-time",
    ]);
  });

  it("parses comma-separated values and drops blanks", () => {
    expect(parseJobFormJobTypes("Full-time, Part-time,  ,Permanent")).toEqual([
      "Full-time",
      "Part-time",
      "Permanent",
    ]);
  });

  it("serializes selected types in catalog order", () => {
    expect(serializeJobFormJobTypes(["Part-time", "Permanent", "Full-time"])).toBe(
      "Permanent, Full-time, Part-time"
    );
  });

  it("toggles types on and off without replacing the rest", () => {
    expect(toggleJobFormJobType("", "Full-time")).toBe("Full-time");
    expect(toggleJobFormJobType("Full-time", "Part-time")).toBe("Full-time, Part-time");
    expect(toggleJobFormJobType("Full-time, Part-time", "Full-time")).toBe("Part-time");
  });

  it("matches a filter against any selected type", () => {
    expect(jobFormJobTypesInclude("Full-time, Part-time", "Part-time")).toBe(true);
    expect(jobFormJobTypesInclude("Full-time, Part-time", "Permanent")).toBe(false);
  });
});
