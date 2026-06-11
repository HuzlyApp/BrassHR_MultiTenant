/**
 * Backfill a Resend received email into candidate_communications.
 *
 * Usage:
 *   npx tsx scripts/sync-resend-inbound-email.ts <resend-email-id>
 *
 * Example (from Resend dashboard Received email ID):
 *   npx tsx scripts/sync-resend-inbound-email.ts 56761188-7520-42d8-8898-ff6fc54ce618
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Resend } from "resend";
import { extractInboundEmailBody } from "../lib/communication/extract-inbound-body";
import { recordInboundCandidateEmail } from "../lib/communication/inbound-email";
import { createServiceRoleClient } from "../lib/supabase/service-role";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

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

async function main() {
  loadEnvFile();

  const emailId = process.argv[2]?.trim();
  if (!emailId) {
    console.error("Usage: npx tsx scripts/sync-resend-inbound-email.ts <resend-email-id>");
    process.exit(1);
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("RESEND_API_KEY is not configured");
    process.exit(1);
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    console.error("Supabase service role client unavailable");
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.receiving.get(emailId);
  if (error || !data) {
    console.error("Failed to fetch received email:", error?.message ?? "not found");
    process.exit(1);
  }

  const body = extractInboundEmailBody(data);
  const result = await recordInboundCandidateEmail(supabase, {
    from: data.from,
    subject: data.subject,
    body,
    providerMessageId: emailId,
  });

  console.log(JSON.stringify({ emailId, from: data.from, subject: data.subject, ...result }, null, 2));
  process.exit(result.recorded ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
