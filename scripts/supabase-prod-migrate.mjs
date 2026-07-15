#!/usr/bin/env node
/**
 * Production migration safety gate.
 *
 * Never applies automatically. Shows the target project ref and requires an
 * exact confirmation string before invoking `supabase db push`.
 *
 * Usage:
 *   node scripts/supabase-prod-migrate.mjs --plan
 *   node scripts/supabase-prod-migrate.mjs --apply --confirm-ref avhdoifnsnoeavqxnwwm
 */
import { spawnSync } from "node:child_process";

const PRODUCTION_REF = "avhdoifnsnoeavqxnwwm";
const DEVELOPMENT_REF = "mgucromvpnxntwyssltd";

const args = new Set(process.argv.slice(2));
const confirmRefArg = (() => {
  const i = process.argv.indexOf("--confirm-ref");
  return i >= 0 ? process.argv[i + 1] : null;
})();

function printPlan() {
  console.log(`
=== PRODUCTION MIGRATION PLAN (read-only) ===

Target project name : BrassHR
Target project ref  : ${PRODUCTION_REF}
Dashboard           : https://supabase.com/dashboard/project/${PRODUCTION_REF}
Development ref     : ${DEVELOPMENT_REF} (do NOT push prod migrations here by mistake)

 Preconditions
  1. All pending migrations applied and verified on development (${DEVELOPMENT_REF}).
  2. Migration SQL reviewed in a PR.
  3. Backup / PITR awareness confirmed for production.
  4. Explicit human approval recorded.

 Commands (manual)
  npx supabase login
  npx supabase link --project-ref ${PRODUCTION_REF}
  npx supabase migration list
  npx supabase db push

 Or via this gate:
  node scripts/supabase-prod-migrate.mjs --apply --confirm-ref ${PRODUCTION_REF}

 Forbidden
  - supabase db reset (remote)
  - Applying supabase/seed.sql to production
  - Copying production PII into development
`);
}

if (args.has("--plan") || (!args.has("--apply") && !args.has("--plan"))) {
  printPlan();
  if (!args.has("--apply")) process.exit(0);
}

if (args.has("--apply")) {
  if (confirmRefArg !== PRODUCTION_REF) {
    console.error(
      [
        "REFUSED: Production apply requires exact confirmation.",
        `  Expected: --confirm-ref ${PRODUCTION_REF}`,
        `  Received: ${confirmRefArg ?? "(missing)"}`,
        "Run with --plan first.",
      ].join("\n")
    );
    process.exit(1);
  }

  console.log(`Confirming production link to ${PRODUCTION_REF}…`);
  const link = spawnSync(
    "npx",
    ["supabase", "link", "--project-ref", PRODUCTION_REF],
    { stdio: "inherit", shell: true }
  );
  if (link.status !== 0) process.exit(link.status ?? 1);

  const list = spawnSync("npx", ["supabase", "migration", "list"], {
    stdio: "inherit",
    shell: true,
  });
  if (list.status !== 0) process.exit(list.status ?? 1);

  console.log("Pushing migrations to PRODUCTION…");
  const push = spawnSync("npx", ["supabase", "db", "push"], {
    stdio: "inherit",
    shell: true,
  });
  process.exit(push.status ?? 1);
}
