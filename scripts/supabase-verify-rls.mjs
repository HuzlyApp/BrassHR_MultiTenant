#!/usr/bin/env node
/**
 * npm run supabase:verify-rls
 *
 * Compares RLS enablement + policy names between prod and staging (public schema).
 * Fails when staging is missing RLS that production has, or core policies differ.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  linkProject,
  dumpPublicSchema,
  requireCiSecrets,
  resolveDirectionFromEnv,
  writeSyncReport,
} from "./supabase-sync/common.mjs";

function parseRlsFromDump(sql) {
  const enabled = new Set();
  const policies = new Set();

  for (const m of sql.matchAll(
    /ALTER TABLE\s+(?:ONLY\s+)?(?:public\.)?"?([a-zA-Z0-9_]+)"?\s+ENABLE ROW LEVEL SECURITY/gi
  )) {
    enabled.add(m[1]);
  }
  for (const m of sql.matchAll(
    /CREATE POLICY\s+"?([a-zA-Z0-9_]+)"?\s+ON\s+(?:public\.)?"?([a-zA-Z0-9_]+)"?/gi
  )) {
    policies.add(`${m[2]}.${m[1]}`);
  }
  return { enabledTables: [...enabled].sort(), policies: [...policies].sort() };
}

function main() {
  const { source, dest } = resolveDirectionFromEnv({ dryRun: true });
  const { prodPass, stagingPass } = requireCiSecrets();

  const prodFile = join(process.cwd(), "schema-prod-public.sql");
  const stagingFile = join(process.cwd(), "schema-staging-public.sql");

  if (!existsSync(prodFile)) {
    linkProject(source, prodPass);
    dumpPublicSchema(prodFile);
  }
  if (!existsSync(stagingFile)) {
    linkProject(dest, stagingPass);
    dumpPublicSchema(stagingFile);
  }

  const prod = parseRlsFromDump(readFileSync(prodFile, "utf8"));
  const staging = parseRlsFromDump(readFileSync(stagingFile, "utf8"));

  const missingRlsOnStaging = prod.enabledTables.filter(
    (t) => !staging.enabledTables.includes(t)
  );
  const extraRlsOnStaging = staging.enabledTables.filter(
    (t) => !prod.enabledTables.includes(t)
  );
  const missingPolicies = prod.policies.filter((p) => !staging.policies.includes(p));
  const extraPolicies = staging.policies.filter((p) => !prod.policies.includes(p));

  const failed = [];
  if (missingRlsOnStaging.length) failed.push("staging_missing_rls_enabled");
  if (missingPolicies.length) failed.push("staging_missing_policies");

  const report = {
    executionDate: new Date().toISOString(),
    sourceEnvironment: "production",
    destinationEnvironment: "staging",
    sourceRef: source,
    destinationRef: dest,
    production: {
      rlsTableCount: prod.enabledTables.length,
      policyCount: prod.policies.length,
    },
    staging: {
      rlsTableCount: staging.enabledTables.length,
      policyCount: staging.policies.length,
    },
    missingRlsOnStaging,
    extraRlsOnStaging,
    missingPolicies: missingPolicies.slice(0, 200),
    extraPolicies: extraPolicies.slice(0, 200),
    failedValidations: failed,
    warnings: extraPolicies.length
      ? ["Staging has policies not present in production (informational)."]
      : [],
    manualActionsRequired: failed.length
      ? ["Add/align RLS migrations and push to staging."]
      : [],
  };

  const path = writeSyncReport(report, "verify-rls-report.json");
  console.log(JSON.stringify(report, null, 2));
  console.error(`Report: ${path}`);
  process.exit(failed.length ? 2 : 0);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
