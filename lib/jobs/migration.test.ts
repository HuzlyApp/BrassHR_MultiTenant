import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const standaloneMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260720202000_workflow_mappings_standalone.sql"),
  "utf8"
);

describe("workflow mapping migration contract", () => {
  it("uses profession and employment type as the active mapping key", () => {
    expect(standaloneMigration).toContain("workflow_mappings_active_criteria_uidx");
    expect(standaloneMigration).toMatch(
      /tenant_id,\s+profession_id,\s+employment_type[\s\S]+WHERE is_active = true/
    );
    expect(standaloneMigration).not.toContain("placement_type");
  });
});
