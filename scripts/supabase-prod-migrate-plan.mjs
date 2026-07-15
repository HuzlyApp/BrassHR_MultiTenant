/**
 * Production migration safety gate.
 * Does NOT apply migrations. Prints the target project and required confirmation phrase.
 *
 * Usage:
 *   node scripts/supabase-prod-migrate-plan.mjs
 *   node scripts/supabase-prod-migrate-plan.mjs --confirm APPLY_TO_PRODUCTION_avhdoifnsnoeavqxnwwm
 *
 * With the correct --confirm phrase, prints the exact CLI commands to run manually.
 * Still never executes db push / reset against production.
 */
const PROD_REF = "avhdoifnsnoeavqxnwwm";
const DEV_REF = "mgucromvpnxntwyssltd";
const CONFIRM = `APPLY_TO_PRODUCTION_${PROD_REF}`;

const confirmArg = (() => {
  const idx = process.argv.indexOf("--confirm");
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

console.log("============================================================");
console.log(" PRODUCTION MIGRATION PLAN — HUMAN CONFIRMATION REQUIRED");
console.log("============================================================");
console.log(` Target production project ref: ${PROD_REF}`);
console.log(` Dashboard: https://supabase.com/dashboard/project/${PROD_REF}`);
console.log(` Development project ref (do NOT confuse): ${DEV_REF}`);
console.log("");
console.log(" Never run: supabase db reset (remote)");
console.log(" Never push migrations without reviewing SQL + backups.");
console.log("");
console.log(" Recommended sequence AFTER migrations are verified on development:");
console.log("  1. Backup production (Dashboard → Database → Backups)");
console.log("  2. npx supabase link --project-ref " + PROD_REF);
console.log("  3. npx supabase migration list");
console.log("  4. Review pending versions carefully (history may diverge from MCP applies)");
console.log("  5. npx supabase db push --dry-run");
console.log("  6. npx supabase db push");
console.log("  7. Re-run advisors + smoke tests");
console.log("");

if (confirmArg !== CONFIRM) {
  console.log(" Status: BLOCKED — confirmation phrase not provided.");
  console.log(` To unlock the command printout, re-run with:`);
  console.log(`   node scripts/supabase-prod-migrate-plan.mjs --confirm ${CONFIRM}`);
  process.exit(2);
}

console.log(" Status: CONFIRMED by operator phrase.");
console.log(" Executable commands (run manually in your shell):");
console.log(`   npx supabase link --project-ref ${PROD_REF}`);
console.log("   npx supabase migration list");
console.log("   npx supabase db push --dry-run");
console.log("   npx supabase db push");
console.log("");
console.log(" This script intentionally does not execute those commands.");
