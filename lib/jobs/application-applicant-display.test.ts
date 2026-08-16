import { describe, expect, it } from "vitest";
import {
  resolveApplicationApplicantEmail,
  resolveApplicationApplicantName,
} from "@/lib/jobs/application-applicant-display";

describe("resolveApplicationApplicantName", () => {
  it("prefers applicant profile name", () => {
    expect(
      resolveApplicationApplicantName({
        applicant_profiles: { first_name: "Jane", last_name: "Doe", email: "jane@example.com" },
        worker: { first_name: "Worker", last_name: "Name", email: "worker@example.com" },
      })
    ).toBe("Jane Doe");
  });

  it("falls back to worker name when profile name is missing", () => {
    expect(
      resolveApplicationApplicantName({
        applicant_profiles: { first_name: null, last_name: null, email: null },
        worker: { first_name: "rexemed", last_name: "Watkins", email: "rexemed964@davopa.com" },
      })
    ).toBe("rexemed Watkins");
  });

  it("falls back to email when names are missing", () => {
    expect(
      resolveApplicationApplicantName({
        applicant_profiles: {},
        worker: { email: "candidate@example.com" },
      })
    ).toBe("candidate@example.com");
  });
});

describe("resolveApplicationApplicantEmail", () => {
  it("prefers applicant profile email", () => {
    expect(
      resolveApplicationApplicantEmail({
        applicant_profiles: { email: "profile@example.com" },
        worker: { email: "worker@example.com" },
      })
    ).toBe("profile@example.com");
  });

  it("falls back to worker email when profile email is missing", () => {
    expect(
      resolveApplicationApplicantEmail({
        applicant_profiles: { email: null },
        worker: { email: "cibedo9623@davopa.com" },
      })
    ).toBe("cibedo9623@davopa.com");
  });
});
