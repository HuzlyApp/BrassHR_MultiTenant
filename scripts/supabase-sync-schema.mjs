#!/usr/bin/env node
/**
 * npm run supabase:sync-schema
 *
 * Dry-run by default: reports the plan to align staging with repo migrations
 * after verifying direction prod → staging.
 *
 * Apply mode: pushes committed migrations to staging only.
 *
 *   node scripts/supabase-sync-schema.mjs
 *   node scripts/supabase-sync-schema.mjs --apply
 *   node scripts/supabase-sync-schema.mjs --apply --allow-destructive  # rarely
 */
import {
  linkProject,
  run,
  writeSyncReport,
  resolveDirectionFromEnv,
  requireCiSecrets,
} from "./supabase-sync/common.mjs";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findDestructiveOperations } from "./supabase-sync/config.mjs";

const apply = process.argv.includes("--apply");
const allowDestructive = process.argv.includes("--allow-destructive");

function scanRepoMigrations() {
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const destructiveFiles = [];
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    const hits = findDestructiveOperations(sql);
    if (hits.length) {
      destructiveFiles.push({ file, patterns: hits });
    }
  }
  return { files, destructiveFiles };
}

function main() {
  const { source, dest, dryRun } = resolveDirectionFromEnv({
    dryRun: !apply,
  });
  const { stagingPass } = requireCiSecrets();
  const { files, destructiveFiles } = scanRepoMigrations();

  const plan = {
    executionDate: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    sourceEnvironment: "production",
    destinationEnvironment: "staging",
    sourceRef: source,
    destinationRef: dest,
    direction: `${source} → ${dest}`,
    migrationsInRepo: files.length,
    destructiveMigrationsInRepo: destructiveFiles,
    plan: [
      "Use committed supabase/migrations as source of truth",
      "Apply forward-only migrations to staging",
      "Run tests / drift check",
      "Apply to prod via gated production workflow",
      "Re-run supabase:check-drift to confirm alignment",
    ],
    warnings: [],
    failedValidations: [],
    manualActionsRequired: [],
  };

  if (destructiveFiles.length && apply && !allowDestructive) {
    plan.failedValidations.push("destructive_sql_without_review");
    plan.manualActionsRequired.push(
      "Re-run with --allow-destructive only after reviewing DROP/TYPE/TRUNCATE operations"
    );
    const path = writeSyncReport(plan, "sync-schema-report.json");
    console.log(JSON.stringify(plan, null, 2));
    console.error(`Report: ${path}`);
    process.exit(1);
  }

  if (!apply) {
    plan.warnings.push("Dry-run only. Pass --apply to push migrations to staging.");
    const path = writeSyncReport(plan, "sync-schema-report.json");
    console.log(JSON.stringify(plan, null, 2));
    console.error(`Report: ${path}`);
    process.exit(0);
  }

  linkProject(dest, stagingPass);
  const before = run("npx", ["supabase", "migration", "list"]);
  run("npx", ["supabase", "db", "push", "--include-all", "--yes"]);
  const after = run("npx", ["supabase", "migration", "list"]);

  plan.migrationsApplied = "db push completed to staging";
  plan.migrationListBefore = before.slice(0, 4000);
  plan.migrationListAfter = after.slice(0, 4000);
  plan.dryRun = dryRun;

  const path = writeSyncReport(plan, "sync-schema-report.json");
  console.log(JSON.stringify({ ...plan, migrationListBefore: undefined, migrationListAfter: undefined }, null, 2));
  console.error(`Report: ${path}`);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
