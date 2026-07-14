import { afterEach, describe, expect, it } from "vitest";
import { resolveApplicantEmailOrigin } from "@/lib/email/applicant-public-origin";

describe("resolveApplicantEmailOrigin", () => {
  const prevRoot = process.env.ROOT_DOMAIN;

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.ROOT_DOMAIN;
    else process.env.ROOT_DOMAIN = prevRoot;
  });

  it("rewrites apex brasshr.com to the tenant vanity host", () => {
    process.env.ROOT_DOMAIN = "brasshr.com";
    expect(resolveApplicantEmailOrigin("https://brasshr.com", "jobs")).toBe(
      "https://jobs.brasshr.com"
    );
  });

  it("rewrites www apex and mismatched tenant hosts to the applicant tenant", () => {
    process.env.ROOT_DOMAIN = "brasshr.com";
    expect(resolveApplicantEmailOrigin("https://www.brasshr.com", "jobs")).toBe(
      "https://jobs.brasshr.com"
    );
    expect(resolveApplicantEmailOrigin("https://other.brasshr.com", "jobs")).toBe(
      "https://jobs.brasshr.com"
    );
  });

  it("keeps localhost for local development", () => {
    expect(resolveApplicantEmailOrigin("http://localhost:3000", "jobs")).toBe(
      "http://localhost:3000"
    );
  });
});
