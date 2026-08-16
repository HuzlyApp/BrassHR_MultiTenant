import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  FK_SPOOF_CANDIDATE_TABLES,
  HIGH_RISK_SECURITY_DEFINER_FUNCTIONS,
  RECRUITING_RESOURCES,
  RLS_DISABLED_PUBLIC_TABLES,
} from "./inventory";

const ROOT = path.resolve(__dirname, "../../..");

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === ".next") continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

describe("RLS policy audit (static)", () => {
  it("flags public tables that historically had RLS disabled", () => {
    expect(RLS_DISABLED_PUBLIC_TABLES).toContain("default_workflow_migration_report");
  });

  it("treats recruiting child tables as FK-spoof candidates until a tenant-match trigger exists", () => {
    expect(FK_SPOOF_CANDIDATE_TABLES.length).toBeGreaterThan(5);
    expect(FK_SPOOF_CANDIDATE_TABLES).toContain("worker_notes");
    expect(FK_SPOOF_CANDIDATE_TABLES).toContain("application_screening_answers");
    expect(FK_SPOOF_CANDIDATE_TABLES).toContain("interview_schedules");
  });

  it("records SECURITY DEFINER functions that must not trust caller tenant_id", () => {
    const names = HIGH_RISK_SECURITY_DEFINER_FUNCTIONS.map((fn) => fn.name);
    expect(names).toContain("change_job_application_status");
    expect(names).toContain("current_tenant_id");
    expect(names).toContain("worker_belongs_to_auth");
  });

  it("maps every recruiting resource to an ownership chain", () => {
    for (const row of RECRUITING_RESOURCES) {
      expect(row.tenantSource.length).toBeGreaterThan(0);
      expect(row.rls).toBe("on");
    }
  });

  it("keeps change_job_application_status executable only by service_role in migrations", () => {
    const sql = readFileSync(
      path.join(ROOT, "supabase/migrations/20260810222237_application_statuses_and_history.sql"),
      "utf8"
    );
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.change_job_application_status[\s\S]*TO service_role/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.change_job_application_status[\s\S]*FROM PUBLIC/);
  });

  it("hardening migration revokes anon execute on change_job_application_status", () => {
    const sql = readFileSync(
      path.join(ROOT, "supabase/migrations/20260813230000_rls_adversarial_hardening.sql"),
      "utf8"
    );
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.change_job_application_status[\s\S]*FROM anon/);
    expect(sql).toContain("enforce_application_child_tenant");
    expect(sql).toContain("protect_users_security_columns");
  });

  it("does not grant change_job_application_status to anon in later migrations", () => {
    const migrationsDir = path.join(ROOT, "supabase/migrations");
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    for (const file of files) {
      const sql = readFileSync(path.join(migrationsDir, file), "utf8");
      const grantAnon = /GRANT EXECUTE ON FUNCTION public\.change_job_application_status[\s\S]{0,80}anon/i.test(
        sql
      );
      expect({ file, grantAnon }).toEqual({ file, grantAnon: false });
    }
  });

  it("does not use user_metadata / raw_user_meta_data for tenant authorization", () => {
    const sqlFiles = walk(path.join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql"));
    for (const file of sqlFiles) {
      const sql = readFileSync(file, "utf8");
      expect(sql).not.toMatch(/auth\.jwt\(\)\s*->>\s*'user_metadata'/i);
      expect(sql).not.toMatch(/raw_user_meta_data/);
    }
  });
});
