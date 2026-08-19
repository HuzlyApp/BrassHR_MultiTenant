import { describe, expect, it } from "vitest";
import {
  employmentTypeDisplayLabel,
  employmentTypeFromLabel,
  employmentTypesMatch,
  isRnrEmploymentType,
  normalizeTemplateEmploymentType,
} from "@/lib/jobs/employment-type";

describe("RNR employment type aliases", () => {
  it("treats Contract and RNR as the same employment type", () => {
    expect(isRnrEmploymentType("RNR")).toBe(true);
    expect(isRnrEmploymentType("Contract")).toBe(true);
    expect(isRnrEmploymentType("W2")).toBe(false);
    expect(employmentTypesMatch("Contract", "RNR")).toBe(true);
    expect(employmentTypesMatch("W2", "RNR")).toBe(false);
  });

  it("displays RNR for both stored values", () => {
    expect(employmentTypeDisplayLabel("Contract")).toBe("RNR");
    expect(employmentTypeDisplayLabel("RNR")).toBe("RNR");
    expect(employmentTypeDisplayLabel("1099")).toBe("1099");
  });

  it("maps UI labels back to the job employment type", () => {
    expect(employmentTypeFromLabel("RNR")).toBe("Contract");
    expect(employmentTypeFromLabel("R&R")).toBe("Contract");
    expect(employmentTypeFromLabel("W2")).toBe("W2");
  });

  it("normalizes template employment types", () => {
    expect(normalizeTemplateEmploymentType("Contract")).toBe("RNR");
    expect(normalizeTemplateEmploymentType("RNR")).toBe("RNR");
    expect(normalizeTemplateEmploymentType("W2")).toBe("W2");
  });
});
