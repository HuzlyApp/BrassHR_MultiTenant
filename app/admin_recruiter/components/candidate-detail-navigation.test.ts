import { describe, expect, it } from "vitest";
import {
  isCandidateDetailPage,
  parseCandidateDetailRoute,
} from "./candidate-detail-navigation";

describe("parseCandidateDetailRoute", () => {
  it("parses profile and nested resume routes", () => {
    expect(
      parseCandidateDetailRoute(
        "/admin_recruiter/new/profile/bffbde92-8b3f-457b-899c-e0f866453d79"
      )
    ).toEqual({
      applicantId: "bffbde92-8b3f-457b-899c-e0f866453d79",
      activeTab: "Profile",
    });

    expect(
      parseCandidateDetailRoute(
        "/admin_recruiter/new/profile/resume/bffbde92-8b3f-457b-899c-e0f866453d79"
      )
    ).toEqual({
      applicantId: "bffbde92-8b3f-457b-899c-e0f866453d79",
      activeTab: "Resume",
    });
  });

  it("parses figma tab routes including ai-analysis and pre-hire", () => {
    expect(
      parseCandidateDetailRoute(
        "/admin_recruiter/new/ai-analysis/bffbde92-8b3f-457b-899c-e0f866453d79"
      )
    ).toEqual({
      applicantId: "bffbde92-8b3f-457b-899c-e0f866453d79",
      activeTab: "AI Analysis",
    });

    expect(
      parseCandidateDetailRoute(
        "/admin_recruiter/new/pre-hire/bffbde92-8b3f-457b-899c-e0f866453d79"
      )
    ).toEqual({
      applicantId: "bffbde92-8b3f-457b-899c-e0f866453d79",
      activeTab: "Pre-Hire",
    });
  });

  it("returns null for list shells", () => {
    expect(parseCandidateDetailRoute("/admin_recruiter/new/profile")).toBeNull();
    expect(parseCandidateDetailRoute("/admin_recruiter/new")).toBeNull();
  });

  it("does not treat worker profile routes as candidate detail chrome", () => {
    expect(
      parseCandidateDetailRoute(
        "/admin_recruiter/workers/359ef5c5-7630-4310-8ea1-f9ddf0bd2916/profile"
      )
    ).toBeNull();
    expect(
      parseCandidateDetailRoute(
        "/admin_recruiter/workers/359ef5c5-7630-4310-8ea1-f9ddf0bd2916/profile/resume"
      )
    ).toBeNull();
  });
});

describe("isCandidateDetailPage", () => {
  it("includes ai-analysis and pre-hire detail routes", () => {
    expect(
      isCandidateDetailPage(
        "/admin_recruiter/new/ai-analysis/bffbde92-8b3f-457b-899c-e0f866453d79"
      )
    ).toBe(true);
    expect(
      isCandidateDetailPage(
        "/admin_recruiter/new/pre-hire/bffbde92-8b3f-457b-899c-e0f866453d79"
      )
    ).toBe(true);
  });
});
