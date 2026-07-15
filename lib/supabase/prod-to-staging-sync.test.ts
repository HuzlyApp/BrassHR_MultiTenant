import { describe, expect, it } from "vitest";
import {
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  PROD_TO_STAGING_DATA_SYNC_ALLOWLIST,
  SCHEMA_ONLY_TABLES,
  assertProdToStagingDirection,
  findDestructiveOperations,
  isAllowlistedForDataSync,
  isSchemaOnlyTable,
} from "../../scripts/supabase-sync/config.mjs";

describe("prod → staging sync guards", () => {
  it("accepts production → staging", () => {
    expect(() =>
      assertProdToStagingDirection(PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF)
    ).not.toThrow();
  });

  it("rejects reverse direction", () => {
    expect(() =>
      assertProdToStagingDirection(STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF)
    ).toThrow(/source must be production/);
  });

  it("rejects same ref", () => {
    expect(() =>
      assertProdToStagingDirection(PRODUCTION_PROJECT_REF, PRODUCTION_PROJECT_REF)
    ).toThrow(/different/);
  });

  it("keeps PII tables off the data allowlist", () => {
    for (const table of ["worker", "workers", "users", "tenants", "agreements"]) {
      expect(PROD_TO_STAGING_DATA_SYNC_ALLOWLIST.includes(table)).toBe(false);
      expect(isSchemaOnlyTable(table) || SCHEMA_ONLY_TABLES.includes(table)).toBe(true);
    }
  });

  it("allowlists only reference tables for row sync", () => {
    expect(isAllowlistedForDataSync("skill_categories")).toBe(true);
    expect(isAllowlistedForDataSync("worker")).toBe(false);
  });

  it("flags destructive SQL for manual review", () => {
    expect(findDestructiveOperations("DROP TABLE public.worker;").length).toBeGreaterThan(0);
    expect(findDestructiveOperations("CREATE TABLE public.x (id uuid);").length).toBe(0);
  });
});
