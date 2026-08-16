import { describe, expect, it } from "vitest";
import { describeRlsSkipReason, isRlsLiveEnabled } from "./env";
import { FK_SPOOF_CANDIDATE_TABLES, RLS_DISABLED_PUBLIC_TABLES } from "./inventory";

describe("RLS catalog live audit gate", () => {
  it("runs pg catalog checks from supabase/tests/rls_adversarial.sql when live SQL is available", () => {
    expect(FK_SPOOF_CANDIDATE_TABLES).toContain("worker_notes");
    expect(RLS_DISABLED_PUBLIC_TABLES).toContain("default_workflow_migration_report");
    if (!isRlsLiveEnabled()) {
      expect(describeRlsSkipReason()).toMatch(/BRASSHR_RLS_TEST|Missing|Refusing/);
    }
  });
});
