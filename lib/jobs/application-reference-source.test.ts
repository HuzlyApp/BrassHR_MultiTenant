import { describe, expect, it } from "vitest";
import {
  applicationReferenceSourceTagClassName,
  formatApplicationReferenceSourceLabel,
  normalizeApplicationReferenceSource,
} from "./application-reference-source";

describe("application-reference-source", () => {
  it("normalizes applicant and admin channels", () => {
    expect(normalizeApplicationReferenceSource("applicant")).toBe("applicant");
    expect(normalizeApplicationReferenceSource("ADMIN")).toBe("admin");
    expect(normalizeApplicationReferenceSource("MSP")).toBeNull();
    expect(normalizeApplicationReferenceSource(null)).toBeNull();
  });

  it("labels onboarding vs manual resume upload", () => {
    expect(formatApplicationReferenceSourceLabel("applicant")).toBe(
      "Onboarding application"
    );
    expect(formatApplicationReferenceSourceLabel("admin")).toBe(
      "Manual resume upload"
    );
    expect(formatApplicationReferenceSourceLabel("Internal")).toBeNull();
  });

  it("returns distinct tag classes per channel", () => {
    expect(applicationReferenceSourceTagClassName("applicant")).toContain("047857");
    expect(applicationReferenceSourceTagClassName("admin")).toContain("1D4ED8");
  });
});
