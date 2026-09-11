import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SERVICE_AREA_COPY } from "@/lib/service-area/copy";

describe("open job service-area database backstop", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20260911204637_open_job_service_area_backstop.sql", import.meta.url),
    "utf8"
  );

  it("only fires for open/published/active jobs and preserves drafts", () => {
    expect(sql).toMatch(/WHEN \(lower\(COALESCE\(NEW\.status, ''\)\) IN \('open', 'published', 'active'\)\)/);
    expect(sql).toMatch(/Drafts are not affected/);
    expect(sql).not.toMatch(/\brejected\b/i);
  });

  it("raises the required user-facing message", () => {
    expect(sql).toContain(SERVICE_AREA_COPY.location_not_enabled);
  });
});
