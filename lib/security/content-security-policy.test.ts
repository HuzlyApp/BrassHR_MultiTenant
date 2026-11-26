import { afterEach, expect, it, vi } from "vitest";
import { appContentSecurityPolicy, APP_PERMISSIONS_POLICY, usesSessionProxy } from "./content-security-policy";
afterEach(() => vi.unstubAllEnvs());
it("uses nonces without inline scripts, production eval, or unrestricted connections", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.supabase.co");
  const policy = appContentSecurityPolicy({ nonce: "server-nonce", development: false });
  const scripts = policy.split("; ").find(rule => rule.startsWith("script-src"))!;
  expect(scripts).toContain("'nonce-server-nonce' 'strict-dynamic'");
  expect(scripts).not.toMatch(/unsafe-inline|unsafe-eval/);
  const connections = policy.split("; ").find(rule => rule.startsWith("connect-src"))!;
  expect(connections).toContain("https://database.supabase.co");
  expect(connections).toContain("wss://database.supabase.co");
  expect(connections).not.toMatch(/(?:^|\s)(?:https:|wss:|\*)(?:\s|$)/);
  expect(APP_PERMISSIONS_POLICY).not.toContain("=*");
  expect(APP_PERMISSIONS_POLICY).toContain("display-capture=()");
});
it("retains explicit public jobs embedding and local development support", () => {
  expect(appContentSecurityPolicy({ frameAncestors: "*", development: true })).toContain("frame-ancestors *");
  expect(appContentSecurityPolicy({ development: true })).toContain("'unsafe-eval'");
});
it("does not put public integrations or portal APIs behind the staff session gate", () => {
  expect(usesSessionProxy("/api/v1/applicants")).toBe(false);
  expect(usesSessionProxy("/api/applicant-portal/resumes")).toBe(false);
  expect(usesSessionProxy("/jobs/example")).toBe(false);
  expect(usesSessionProxy("/api/admin/jobs")).toBe(true);
  expect(usesSessionProxy("/administrator")).toBe(false);
});
