import { describe, expect, it } from "vitest";
import {
  normalizeApplicantEmail,
  pickDeliverableEmailFromRecord,
  pickDeliverableEmailFromSources,
  readApplicantEmailFromParsedResumeJson,
  resolveEmailFromResumeRow,
} from "@/lib/onboarding/resolve-applicant-signing-email";

describe("resolve-applicant-signing-email", () => {
  it("normalizes email with trim and lowercase", () => {
    expect(normalizeApplicantEmail("  Jane@Example.COM ")).toBe("jane@example.com");
    expect(normalizeApplicantEmail(null)).toBe("");
  });

  it("picks deliverable email from field aliases", () => {
    expect(
      pickDeliverableEmailFromRecord({
        work_email: "  Worker@Example.com ",
      })
    ).toBe("worker@example.com");
    expect(
      pickDeliverableEmailFromRecord({
        email: "applicant+e876124e@placeholder.local",
        contact_email: "real@example.com",
      })
    ).toBe("real@example.com");
  });

  it("rejects placeholder-only records", () => {
    expect(
      pickDeliverableEmailFromRecord({
        email: "applicant+e876124e@placeholder.local",
        work_email: "bad@internal.local",
      })
    ).toBeNull();
  });

  it("resolves first deliverable email from ordered sources", () => {
    expect(
      pickDeliverableEmailFromSources(
        "",
        "applicant+e876124e@placeholder.local",
        "saved@example.com"
      )
    ).toBe("saved@example.com");
  });

  it("reads email from parsed resume JSON", () => {
    const email = readApplicantEmailFromParsedResumeJson(
      JSON.stringify({ email: "Resume.User@Example.com", first_name: "Resume" })
    );
    expect(email).toBe("resume.user@example.com");
  });

  it("resolves email from worker resume row parsed_data", () => {
    const email = resolveEmailFromResumeRow({
      parsed_data: { candidate_email: "candidate@example.com" },
      extracted_text: null,
    });
    expect(email).toBe("candidate@example.com");
  });
});
