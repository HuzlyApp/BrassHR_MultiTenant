#!/usr/bin/env node
/**
 * Compare production vs development public schema (structure only).
 * Never copies rows / PII.
 *
 * Usage (CI or local with env set):
 *   node scripts/supabase-schema-drift.mjs
 *   node scripts/supabase-schema-drift.mjs --json
 *
 * Env:
 *   PRODUCTION_PROJECT_ID / DEVELOPMENT_PROJECT_ID (optional defaults)
 *   Uses `npx supabase` + SUPABASE_ACCESS_TOKEN + DB passwords via linked projects.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PRODUCTION_REF =
  process.env.PRODUCTION_PROJECT_ID?.trim() || "avhdoifnsnoeavqxnwwm";
const DEVELOPMENT_REF =
  process.env.DEVELOPMENT_PROJECT_ID?.trim() || "mgucromvpnxntwyssltd";

const asJson = process.argv.includes("--json");

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: true,
    ...opts,
  });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || "").trim();
    throw new Error(`${cmd} ${args.join(" ")} failed: ${err || `exit ${res.status}`}`);
  }
  return res.stdout ?? "";
}

function dumpSchema(projectRef, password, outFile) {
  run("npx", [
    "supabase",
    "link",
    "--project-ref",
    projectRef,
    "--password",
    password,
  ]);
  // Schema-only dump of public schema
  run("npx", [
    "supabase",
    "db",
    "dump",
    "--schema",
    "public",
    "--file",
    outFile,
  ]);
}

function normalizeSchemaSql(sql) {
  return sql
    .replace(/\r\n/g, "\n")
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function main() {
  const prodPass = process.env.PRODUCTION_DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD;
  const devPass = process.env.DEVELOPMENT_DB_PASSWORD;
  const token = process.env.SUPABASE_ACCESS_TOKEN;

  if (!token) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required");
  }
  if (!prodPass || !devPass) {
    throw new Error("PRODUCTION_DB_PASSWORD and DEVELOPMENT_DB_PASSWORD are required");
  }

  const dir = mkdtempSync(join(tmpdir(), "brasshr-schema-"));
  const prodFile = join(dir, "prod_public.sql");
  const devFile = join(dir, "dev_public.sql");

  try {
    console.error(`Dumping PRODUCTION schema (${PRODUCTION_REF})…`);
    dumpSchema(PRODUCTION_REF, prodPass, prodFile);

    console.error(`Dumping DEVELOPMENT schema (${DEVELOPMENT_REF})…`);
    dumpSchema(DEVELOPMENT_REF, devPass, devFile);

    const prod = normalizeSchemaSql(readFileSync(prodFile, "utf8"));
    const dev = normalizeSchemaSql(readFileSync(devFile, "utf8"));
    const inSync = prod === dev;

    const summary = {
      productionRef: PRODUCTION_REF,
      developmentRef: DEVELOPMENT_REF,
      schemaInSync: inSync,
      productionDumpBytes: readFileSync(prodFile).length,
      developmentDumpBytes: readFileSync(devFile).length,
      note: "Comparison is schema-only (public). Rows/PII are never copied.",
    };

    if (asJson) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(JSON.stringify(summary, null, 2));
    }

    // Persist dumps as artifacts path hint for CI
    writeFileSync(join(process.cwd(), "schema-prod-public.sql"), readFileSync(prodFile));
    writeFileSync(join(process.cwd(), "schema-dev-public.sql"), readFileSync(devFile));

    if (!inSync) {
      console.error(
        "DRIFT DETECTED: public schema dumps differ. Review schema-prod-public.sql vs schema-dev-public.sql."
      );
      console.error(
        "To catch up development, generate a migration from the gap and push to South — do not dump/restore production data."
      );
      process.exit(2);
    }

    console.error("OK: public schemas match (normalized).");
    process.exit(0);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
