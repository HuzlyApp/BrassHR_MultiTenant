import { describe, expect, it } from "vitest";
import { buildWorkerUpdatePayload } from "./worker-profile-field-update";

describe("candidate profile field mapping", () => {
  it("keeps allied-health role independent of summary and address fields", () => {
    const payload = buildWorkerUpdatePayload("allied_health_role", "Respiratory Therapist");
    expect(payload).toMatchObject({ allied_health_role: "Respiratory Therapist" });
    expect(payload).not.toHaveProperty("about_me");
    expect(payload).not.toHaveProperty("city");
    expect(payload).not.toHaveProperty("zip");
  });
  it("maps address and summary edits only to their own database columns", () => {
    expect(buildWorkerUpdatePayload("city", "Raleigh")).toMatchObject({ city: "Raleigh" });
    expect(buildWorkerUpdatePayload("about_me", "Experienced applicant")).toMatchObject({ about_me: "Experienced applicant" });
    expect(buildWorkerUpdatePayload("about_me", "Experienced applicant")).not.toHaveProperty("allied_health_role");
  });
});
