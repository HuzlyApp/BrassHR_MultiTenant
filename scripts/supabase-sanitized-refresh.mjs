#!/usr/bin/env node
/**
 * Manual sanitized staging refresh — NEVER automatic.
 *
 * npm run supabase:sanitized-refresh -- --plan
 *
 * This prints the plan and safety requirements. Actual export/sanitize/load
 * is intentionally not auto-wired to prod dumps (too dangerous without review).
 */
import {
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  SCHEMA_ONLY_TABLES,
  PROD_TO_STAGING_DATA_SYNC_ALLOWLIST,
} from "./supabase-sync/config.mjs";
import { writeSyncReport } from "./supabase-sync/common.mjs";

const confirmed = process.argv.includes("--confirm-manual-sanitized-refresh");

const plan = {
  executionDate: new Date().toISOString(),
  sourceEnvironment: "production",
  destinationEnvironment: "staging",
  sourceRef: PRODUCTION_PROJECT_REF,
  destinationRef: STAGING_PROJECT_REF,
  automatic: false,
  status: confirmed ? "acknowledged_manual_only" : "plan_only",
  requirements: [
    "Require explicit manual execution (this script)",
    "Export only approved tables/columns",
    "Remove/replace PII (emails, phones synthetic)",
    "Remove passwords, tokens, secrets, Auth identities",
    "Remove payments/bank info",
    "Remove signed documents and agreements",
    "Replace tenant/user identifiers where needed",
    "Disable outbound email/SMS/payment/webhooks on staging",
    "Produce audit report of what was copied and sanitized",
  ],
  neverInclude: SCHEMA_ONLY_TABLES,
  referenceAllowlistInstead: PROD_TO_STAGING_DATA_SYNC_ALLOWLIST,
  note:
    "Do not implement blind prod→staging data clone. Prefer synthetic seed scripts (scripts/bootstrap-multi-tenant-seed.mjs) for staging.",
  warnings: confirmed
    ? ["Confirmed awareness only — no data was moved."]
    : ["Pass --confirm-manual-sanitized-refresh to acknowledge; still does not move data."],
  failedValidations: [],
  manualActionsRequired: [
    "Design column-level sanitizer before any refresh is coded",
    "Use staging-only credentials and kill-switches for Resend/Twilio/Firma",
  ],
};

const path = writeSyncReport(plan, "sanitized-refresh-plan.json");
console.log(JSON.stringify(plan, null, 2));
console.error(`Report: ${path}`);
process.exit(0);
