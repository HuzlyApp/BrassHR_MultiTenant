import {
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  assertProdToStagingDirection,
  findDestructiveOperations,
} from "./config.mjs";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptions} [opts]
 */
export function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: true,
    ...opts,
  });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || "").trim();
    throw new Error(`${cmd} ${args.join(" ")} failed:\n${err || `exit ${res.status}`}`);
  }
  return res.stdout ?? "";
}

/**
 * @param {string} projectRef
 * @param {string} password
 */
export function linkProject(projectRef, password) {
  run("npx", [
    "supabase",
    "link",
    "--project-ref",
    projectRef,
    "--password",
    password,
  ]);
}

/**
 * @param {string} outFile
 * @param {{ schema?: string }} [options]
 */
export function dumpPublicSchema(outFile, options = {}) {
  const schema = options.schema ?? "public";
  run("npx", ["supabase", "db", "dump", "--schema", schema, "--file", outFile]);
}

/**
 * @param {Record<string, unknown>} report
 * @param {string} [filename]
 */
export function writeSyncReport(report, filename = "supabase-sync-report.json") {
  const dir = join(process.cwd(), "reports");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = join(dir, filename);
  writeFileSync(path, JSON.stringify(report, null, 2));
  return path;
}

/**
 * @param {{ dryRun?: boolean }} [opts]
 */
export function resolveDirectionFromEnv(opts = {}) {
  const source =
    process.env.SYNC_SOURCE_REF?.trim() ||
    process.env.PRODUCTION_PROJECT_ID?.trim() ||
    PRODUCTION_PROJECT_REF;
  const dest =
    process.env.SYNC_DEST_REF?.trim() ||
    process.env.DEVELOPMENT_PROJECT_ID?.trim() ||
    process.env.STAGING_PROJECT_ID?.trim() ||
    STAGING_PROJECT_REF;

  assertProdToStagingDirection(source, dest);
  return { source, dest, dryRun: opts.dryRun !== false };
}

/**
 * @param {string} sql
 * @param {{ allowDestructive?: boolean }} [opts]
 */
export function requireSafeMigrationSql(sql, opts = {}) {
  const hits = findDestructiveOperations(sql);
  if (hits.length && !opts.allowDestructive) {
    throw new Error(
      `Destructive SQL requires manual review. Matched: ${hits.join(", ")}`
    );
  }
  return hits;
}

export function requireCiSecrets() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const prodPass = process.env.PRODUCTION_DB_PASSWORD?.trim();
  const stagingPass =
    process.env.STAGING_DB_PASSWORD?.trim() ||
    process.env.DEVELOPMENT_DB_PASSWORD?.trim();
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is required");
  if (!prodPass) throw new Error("PRODUCTION_DB_PASSWORD is required");
  if (!stagingPass) {
    throw new Error("STAGING_DB_PASSWORD or DEVELOPMENT_DB_PASSWORD is required");
  }
  return { token, prodPass, stagingPass };
}
