/**
 * Test send: APPLICATION_STATUS for tenant subdomain "test".
 * Run: npm run email:test:application-status
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { sendApplicationStatusTestEmail } from "../lib/email/send-application-status-test";

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("[email:test] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const result = await sendApplicationStatusTestEmail(supabase, {
    tenantLookup: ["subdomain test", "subdomaintest", "test"],
    to: "carlitoelipan@gmail.com",
    variables: {
      applicantName: "Carlito Elipan",
      tenantName: "subdomain test",
      applicationStatusUrl:
        "https://test.nexusmedpro.com/application/status/test-application-id",
      supportEmail: "support@nexusmedpro.com",
    },
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error("[email:test] Fatal error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
