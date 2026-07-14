import { describe, expect, it } from "vitest";
import {
  buildApplicantPortalUrl,
  restoreDynamicUrlPlaceholders,
  rewriteEmbeddedAppUrls,
} from "@/lib/email/dynamic-template-urls";

describe("buildApplicantPortalUrl", () => {
  it("uses localhost worker-signin in local development", () => {
    expect(buildApplicantPortalUrl("http://localhost:3000", "remotecompany")).toBe(
      "http://localhost:3000/worker-signin?tenant=remotecompany"
    );
  });

  it("builds tenant vanity worker-signin URLs for production hosts", () => {
    expect(buildApplicantPortalUrl("https://brasshr.com", "jobs")).toBe(
      "https://jobs.brasshr.com/worker-signin?tenant=jobs"
    );
    expect(buildApplicantPortalUrl("https://test.brasshr.com", "remotecompany")).toBe(
      "https://remotecompany.brasshr.com/worker-signin?tenant=remotecompany"
    );
  });
});

describe("restoreDynamicUrlPlaceholders", () => {
  it("converts baked-in portal URLs back to placeholders", () => {
    const input =
      "Sign in here: http://localhost:3000/worker-signin?tenant=remotecompany";
    expect(restoreDynamicUrlPlaceholders(input)).toBe(
      "Sign in here: {{applicantPortalUrl}}"
    );
  });

  it("also restores legacy home-page portal URLs", () => {
    expect(
      restoreDynamicUrlPlaceholders("Sign in here: http://localhost:3000/?tenant=remotecompany")
    ).toBe("Sign in here: {{applicantPortalUrl}}");
  });
});

describe("rewriteEmbeddedAppUrls", () => {
  it("replaces stale localhost URLs with the live worker-signin URL", () => {
    const input =
      "Sign in here: http://localhost:3000/?tenant=remotecompany";
    const output = rewriteEmbeddedAppUrls(input, {
      applicantPortalUrl: "https://jobs.brasshr.com/worker-signin?tenant=jobs",
    });
    expect(output).toBe(
      "Sign in here: https://jobs.brasshr.com/worker-signin?tenant=jobs"
    );
  });
});
