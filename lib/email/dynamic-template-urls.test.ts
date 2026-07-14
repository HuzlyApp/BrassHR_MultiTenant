import { describe, expect, it } from "vitest";
import {
  buildApplicantPortalUrl,
  restoreDynamicUrlPlaceholders,
  rewriteEmbeddedAppUrls,
} from "@/lib/email/dynamic-template-urls";

describe("buildApplicantPortalUrl", () => {
  it("uses localhost origin in local development", () => {
    expect(buildApplicantPortalUrl("http://localhost:3000", "remotecompany")).toBe(
      "http://localhost:3000/?tenant=remotecompany"
    );
  });

  it("rewrites production hosts to the tenant vanity domain", () => {
    expect(buildApplicantPortalUrl("https://brasshr.com", "jobs")).toBe(
      "https://jobs.brasshr.com/?tenant=jobs"
    );
    expect(buildApplicantPortalUrl("https://test.brasshr.com", "remotecompany")).toBe(
      "https://remotecompany.brasshr.com/?tenant=remotecompany"
    );
  });
});

describe("restoreDynamicUrlPlaceholders", () => {
  it("converts baked-in portal URLs back to placeholders", () => {
    const input =
      "Sign in here: http://localhost:3000/?tenant=remotecompany";
    expect(restoreDynamicUrlPlaceholders(input)).toBe(
      "Sign in here: {{applicantPortalUrl}}"
    );
  });
});

describe("rewriteEmbeddedAppUrls", () => {
  it("replaces stale localhost URLs with the live portal URL", () => {
    const input =
      "Sign in here: http://localhost:3000/?tenant=remotecompany";
    const output = rewriteEmbeddedAppUrls(input, {
      applicantPortalUrl: "https://test.brasshr.com/?tenant=remotecompany",
    });
    expect(output).toBe("Sign in here: https://test.brasshr.com/?tenant=remotecompany");
  });
});
