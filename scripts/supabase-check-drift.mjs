#!/usr/bin/env node
/**
 * npm run supabase:check-drift
 *
 * Compares production vs staging public schema dumps (structure only).
 * Direction is always prod → staging. Never copies rows.
 *
 * Exit codes: 0 in sync, 2 drift, 1 error
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  linkProject,
  dumpPublicSchema,
  writeSyncReport,
  resolveDirectionFromEnv,
  requireCiSecrets,
} from "./supabase-sync/common.mjs";

function normalize(sql) {
  return sql
    .replace(/\r\n/g, "\n")
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Heuristic object inventory for richer drift reports (not a full pg catalog). */
function inventory(sql) {
  const tables = new Set();
  const indexes = new Set();
  const functions = new Set();
  const triggers = new Set();
  const policies = new Set();
  const views = new Set();

  for (const m of sql.matchAll(
    /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?"?([a-zA-Z0-9_]+)"?/gi
  )) {
    tables.add(m[1]);
  }
  for (const m of sql.matchAll(
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?"?([a-zA-Z0-9_]+)"?/gi
  )) {
    indexes.add(m[1]);
  }
  for (const m of sql.matchAll(
    /CREATE\s+(?:OR REPLACE\s+)?FUNCTION\s+(?:public\.)?"?([a-zA-Z0-9_]+)"?/gi
  )) {
    functions.add(m[1]);
  }
  for (const m of sql.matchAll(
    /CREATE\s+(?:OR REPLACE\s+)?TRIGGER\s+"?([a-zA-Z0-9_]+)"?/gi
  )) {
    triggers.add(m[1]);
  }
  for (const m of sql.matchAll(
    /CREATE POLICY\s+"?([a-zA-Z0-9_]+)"?\s+ON\s+(?:public\.)?"?([a-zA-Z0-9_]+)"?/gi
  )) {
    policies.add(`${m[2]}.${m[1]}`);
  }
  for (const m of sql.matchAll(
    /CREATE\s+(?:OR REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:public\.)?"?([a-zA-Z0-9_]+)"?/gi
  )) {
    views.add(m[1]);
  }

  return {
    tables: [...tables].sort(),
    indexes: [...indexes].sort(),
    functions: [...functions].sort(),
    triggers: [...triggers].sort(),
    policies: [...policies].sort(),
    views: [...views].sort(),
  };
}

function diffSets(a, b) {
  return {
    onlyInProduction: a.filter((x) => !b.includes(x)),
    onlyInStaging: b.filter((x) => !a.includes(x)),
  };
}

function main() {
  const { source, dest } = resolveDirectionFromEnv({ dryRun: true });
  const { prodPass, stagingPass } = requireCiSecrets();

  const prodFile = join(process.cwd(), "schema-prod-public.sql");
  const stagingFile = join(process.cwd(), "schema-staging-public.sql");

  console.error(`Source (prod): ${source}`);
  console.error(`Destination (staging): ${dest}`);

  linkProject(source, prodPass);
  dumpPublicSchema(prodFile);

  linkProject(dest, stagingPass);
  dumpPublicSchema(stagingFile);

  const prodRaw = readFileSync(prodFile, "utf8");
  const stagingRaw = readFileSync(stagingFile, "utf8");
  const inSync = normalize(prodRaw) === normalize(stagingRaw);
  const prodInv = inventory(prodRaw);
  const stagingInv = inventory(stagingRaw);

  const report = {
    executionDate: new Date().toISOString(),
    sourceEnvironment: "production",
    destinationEnvironment: "staging",
    sourceRef: source,
    destinationRef: dest,
    schemaInSync: inSync,
    productionDumpBytes: prodRaw.length,
    stagingDumpBytes: stagingRaw.length,
    objectDiffs: {
      tables: diffSets(prodInv.tables, stagingInv.tables),
      views: diffSets(prodInv.views, stagingInv.views),
      indexes: diffSets(prodInv.indexes, stagingInv.indexes),
      functions: diffSets(prodInv.functions, stagingInv.functions),
      triggers: diffSets(prodInv.triggers, stagingInv.triggers),
      policies: diffSets(prodInv.policies, stagingInv.policies),
    },
    warnings: inSync
      ? []
      : [
          "Public schema dumps differ. Inspect artifacts and generate a forward-only migration.",
          "Do not blindly restore a dump that drops objects.",
        ],
    failedValidations: inSync ? [] : ["schema_drift"],
    manualActionsRequired: inSync
      ? []
      : [
          "Review schema-prod-public.sql vs schema-staging-public.sql",
          "Commit a forward-only migration for missing objects",
          "Apply to staging via migrations CI or supabase:sync-schema --apply",
          "Manual review required for DROP / type-change / RLS-disable operations",
        ],
    note: "Schema-only comparison. PII/rows are never synchronized.",
  };

  const path = writeSyncReport(report, "check-drift-report.json");
  console.log(JSON.stringify(report, null, 2));
  console.error(`Report: ${path}`);

  process.exit(inSync ? 0 : 2);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
