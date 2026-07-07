#!/usr/bin/env node
/**
 * Deploy resend-inbound Edge Function to brasshr_south (fallback Supabase project)
 * and sync Resend-related secrets from .env.
 *
 * Usage:
 *   node scripts/deploy-resend-inbound-fallback.mjs
 *
 * Required in .env:
 *   FALLBACK_NEXT_PUBLIC_SUPABASE_URL (or pass --project-ref)
 *   RESEND_API_KEY
 *   RESEND_WEBHOOK_SECRET  (from Resend → Webhooks → signing secret for fallback URL)
 *
 * Optional:
 *   RESEND_FROM_DOMAIN=brasshr.com
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const FALLBACK_PROJECT_REF = "mgucromvpnxntwyssltd";
const FALLBACK_WEBHOOK_URL = `https://${FALLBACK_PROJECT_REF}.supabase.co/functions/v1/resend-inbound`;

function loadEnvFile() {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root });
}

function main() {
  loadEnvFile();

  const projectRef = process.argv.includes("--project-ref")
    ? process.argv[process.argv.indexOf("--project-ref") + 1]
    : FALLBACK_PROJECT_REF;

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  const fromDomain = process.env.RESEND_FROM_DOMAIN?.trim() || "brasshr.com";

  if (!resendApiKey) {
    console.error("RESEND_API_KEY is required in .env");
    process.exit(1);
  }

  console.log(`Deploying resend-inbound to project ${projectRef}...`);
  run(
    `supabase functions deploy resend-inbound --project-ref ${projectRef} --no-verify-jwt`,
  );

  const secretParts = [
    `RESEND_API_KEY=${JSON.stringify(resendApiKey)}`,
    `RESEND_FROM_DOMAIN=${JSON.stringify(fromDomain)}`,
  ];
  if (webhookSecret) {
    secretParts.push(`RESEND_WEBHOOK_SECRET=${JSON.stringify(webhookSecret)}`);
  } else {
    console.warn(
      "\nWARN: RESEND_WEBHOOK_SECRET not set in .env — inbound webhooks will return 403 until configured.",
    );
  }

  run(`supabase secrets set --project-ref ${projectRef} ${secretParts.join(" ")}`);

  console.log("\n--- Fallback Resend inbound webhook ---");
  console.log(`URL: ${FALLBACK_WEBHOOK_URL}`);
  console.log("\nResend dashboard steps:");
  console.log("  1. https://resend.com/webhooks → Add Webhook (or edit while on fallback)");
  console.log(`  2. Endpoint: ${FALLBACK_WEBHOOK_URL}`);
  console.log("  3. Event: email.received");
  console.log("  4. Copy signing secret (whsec_...) into .env as RESEND_WEBHOOK_SECRET");
  console.log("  5. Re-run this script to sync the secret to Supabase Edge Functions");
  console.log("\nHealth check:");
  console.log(`  curl ${FALLBACK_WEBHOOK_URL}`);
  console.log('  Expect: {"ok":true,"webhookSecretConfigured":true}');
}

main();
