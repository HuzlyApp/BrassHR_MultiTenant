import { describe, expect, it } from "vitest";
import {
  buildApplicantPortalUrl,
  restoreDynamicUrlPlaceholders,
  rewriteEmbeddedAppUrls,
} from "@/lib/email/dynamic-template-urls";

describe("buildApplicantPortalUrl", () => {
  it("uses the provided origin and tenant slug", () => {
    expect(buildApplicantPortalUrl("http://localhost:3000", "remotecompany")).toBe(
      "http://localhost:3000/?tenant=remotecompany"
    );
    expect(buildApplicantPortalUrl("https://hr.brasshr.com", "remotecompany")).toBe(
      "https://hr.brasshr.com/?tenant=remotecompany"
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
      applicantPortalUrl: "https://hr.brasshr.com/?tenant=remotecompany",
    });
    expect(output).toBe("Sign in here: https://hr.brasshr.com/?tenant=remotecompany");
  });
});
