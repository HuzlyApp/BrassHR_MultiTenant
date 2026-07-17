import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260717231055_job_requisitions_and_workflow_assignments.sql"
  ),
  "utf8"
);

describe("job requisition migration contract", () => {
  it("defines the explicit job lifecycle", () => {
    expect(migration).toContain("'draft', 'published', 'closed', 'archived'");
    expect(migration).toContain("job_requisitions_published_required_chk");
  });

  it("uses exactly the documented three-field active mapping key", () => {
    expect(migration).toContain("workflow_mappings_active_criteria_uidx");
    expect(migration).toMatch(
      /tenant_id,\s+profession_id,\s+employment_type,\s+placement_type[\s\S]+WHERE is_active = true/
    );
  });

  it("pins workflow snapshots to job applications", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.applicant_workflow_instances");
    expect(migration).toContain("workflow_snapshot jsonb NOT NULL");
    expect(migration).toContain("applicant_workflow_instance_id");
  });

  it("enables tenant-scoped RLS and admin-only workflow writes", () => {
    expect(migration).toContain("ALTER TABLE public.job_requisitions ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("public.user_is_tenant_admin(tenant_id)");
    expect(migration).toContain("job_requisitions_public_read");
  });

  it("seeds independent W2 and 1099 editable presets with resume first", () => {
    expect(migration).toContain("Default W2 Onboarding");
    expect(migration).toContain("Default 1099 Onboarding");
    expect(migration).toContain('"stepId":"resume-basic-profile"');
  });
});
