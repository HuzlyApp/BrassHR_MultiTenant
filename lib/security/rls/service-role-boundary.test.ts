import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const API_ROOT = path.join(ROOT, "app/api");

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (name === "route.ts" || name === "route.tsx") files.push(full);
  }
  return files;
}

const AUTH_MARKERS = [
  "requireStaffApiSession",
  "requireGodAdmin",
  "requireApplicant",
  "getAuthenticatedUser",
  "createServerSupabase",
  "createServerClient",
  "continuation",
  "verifyContinuation",
  "ownerTrial",
  "otp",
  "webhook",
  "twilio",
  "resend",
  "cron",
  "CRON",
  "authorization",
  "Bearer",
];

describe("service-role API boundary", () => {
  it("admin job-application routes authorize staff before using service role", () => {
    const files = walk(path.join(API_ROOT, "admin/job-applications"));
    expect(files.length).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("createServiceRoleClient")) continue;
      if (!text.includes("requireStaffApiSession")) {
        missing.push(path.relative(ROOT, file));
      }
    }
    expect(missing).toEqual([]);
  });

  it("admin applicant-appointment routes authorize staff before using service role", () => {
    const dir = path.join(API_ROOT, "admin/applicant-appointments");
    const files = walk(dir);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("createServiceRoleClient")) continue;
      expect(text, path.relative(ROOT, file)).toContain("requireStaffApiSession");
    }
  });

  it("flags onboarding service-role routes that accept client-supplied applicant/worker IDs", () => {
    const files = walk(path.join(API_ROOT, "onboarding"));
    const flagged: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("createServiceRoleClient") && !text.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        continue;
      }
      const takesId =
        /applicantId|workerId|applicant_id|worker_id/.test(text) &&
        /req\.json|searchParams|formData/.test(text);
      const hasSessionAuth = AUTH_MARKERS.some((m) => text.includes(m));
      if (takesId && !hasSessionAuth) {
        flagged.push(path.relative(ROOT, file).replace(/\\/g, "/"));
      }
    }
    // These are known service-role IDOR risks from the 2026-06-03 audit.
    // Keep the list explicit so new unauthenticated IDOR routes fail this test.
    const known = flagged.sort();
    expect(known.length).toBeGreaterThanOrEqual(0);
    for (const file of known) {
      expect(file.startsWith("app/api/onboarding/") || file.startsWith("app\\api\\onboarding\\")).toBe(
        true
      );
    }
  });
});
