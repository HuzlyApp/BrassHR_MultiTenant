import { describe, expect, it } from "vitest";
import { applicationMatchesMatchScoreFilter } from "@/app/admin_recruiter/applications/EditApplicationsFiltersModal";

describe("applicationMatchesMatchScoreFilter", () => {
  it("matches shared range buckets like old candidates", () => {
    expect(applicationMatchesMatchScoreFilter(95, "90_100")).toBe(true);
    expect(applicationMatchesMatchScoreFilter(89, "90_100")).toBe(false);
    expect(applicationMatchesMatchScoreFilter(75, "70_80")).toBe(true);
    expect(applicationMatchesMatchScoreFilter(80, "70_80")).toBe(false);
  });

  it("supports custom ranges", () => {
    expect(applicationMatchesMatchScoreFilter(42, "custom:40-45")).toBe(true);
    expect(applicationMatchesMatchScoreFilter(50, "custom:40-45")).toBe(false);
    expect(applicationMatchesMatchScoreFilter(null, "custom:40-")).toBe(true);
  });

  it("keeps legacy dashboard deep links working", () => {
    expect(applicationMatchesMatchScoreFilter(92, "90_plus")).toBe(true);
    expect(applicationMatchesMatchScoreFilter(40, "under_50")).toBe(true);
    expect(applicationMatchesMatchScoreFilter(null, "no_score")).toBe(true);
  });
});
