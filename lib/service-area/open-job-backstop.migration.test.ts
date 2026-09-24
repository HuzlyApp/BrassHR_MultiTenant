import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SERVICE_AREA_COPY } from "@/lib/service-area/copy";

describe("open job service-area database backstop", () => {
  const legacySql = readFileSync(
    new URL("../../supabase/migrations/20260911204637_open_job_service_area_backstop.sql", import.meta.url),
    "utf8"
  );
  const sql = readFileSync(
    new URL("../../supabase/migrations/20260923065943_remote_all_states_default.sql", import.meta.url),
    "utf8"
  );

  it("only fires for open/published/active jobs and preserves drafts", () => {
    expect(legacySql).toMatch(/WHEN \(lower\(COALESCE\(NEW\.status, ''\)\) IN \('open', 'published', 'active'\)\)/);
    expect(sql).toMatch(/Drafts are allowed/);
    expect(sql).not.toMatch(/\brejected\b/i);
  });

  it("raises the required user-facing message", () => {
    expect(sql).toContain(SERVICE_AREA_COPY.location_not_enabled);
  });

  it("covers NYC neighborhood aliases used by the application evaluator", () => {
    expect(sql).toContain("'chelsea'");
    expect(sql).toContain("'soho'");
    expect(sql).toContain("'tribeca'");
    expect(sql).toContain("'hells kitchen'");
  });

  it("normalizes Remote, Hybrid and checks remote_allowed_states", () => {
    expect(sql).toContain("remote,-hybrid");
    expect(sql).toMatch(/v_type IN \('hybrid', 'remote,-hybrid', 'remote-hybrid'\)/);
    expect(sql).toContain("NEW.remote_allowed_states");
  });

  it("treats empty remote_allowed_states as All States", () => {
    expect(sql).toMatch(/Empty = All States/);
    expect(sql).toMatch(/array_length\(v_remote, 1\) IS NOT NULL/);
  });
});
