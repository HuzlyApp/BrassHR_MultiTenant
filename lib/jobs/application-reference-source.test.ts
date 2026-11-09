import { describe, expect, it } from "vitest";
import {
  applicationReferenceSourceTagClassName,
  formatApplicationReferenceSourceLabel,
  normalizeApplicationReferenceSource,
} from "./application-reference-source";

describe("application-reference-source", () => {
  it("normalizes applicant, admin, and api channels", () => {
    expect(normalizeApplicationReferenceSource("applicant")).toBe("applicant");
    expect(normalizeApplicationReferenceSource("ADMIN")).toBe("admin");
    expect(normalizeApplicationReferenceSource("api")).toBe("api");
    expect(normalizeApplicationReferenceSource("MSP")).toBeNull();
    expect(normalizeApplicationReferenceSource(null)).toBeNull();
  });

  it("labels onboarding, manual upload, and API upload", () => {
    expect(formatApplicationReferenceSourceLabel("applicant")).toBe(
      "Onboarding application"
    );
    expect(formatApplicationReferenceSourceLabel("admin")).toBe(
      "Manual resume upload"
    );
    expect(formatApplicationReferenceSourceLabel("api")).toBe("Uploaded via API");
    expect(formatApplicationReferenceSourceLabel("Internal")).toBeNull();
  });

  it("returns distinct tag classes per channel", () => {
    expect(applicationReferenceSourceTagClassName("applicant")).toContain("047857");
    expect(applicationReferenceSourceTagClassName("admin")).toContain("1D4ED8");
    expect(applicationReferenceSourceTagClassName("api")).toContain("C2410C");
  });
});
