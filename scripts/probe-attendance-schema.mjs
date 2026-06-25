import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const envPath = new URL("../.env.local", import.meta.url);
const envText = fs.readFileSync(envPath, "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (!match) continue;
  const key = match[1].trim();
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("MISSING_ENV", { hasUrl: Boolean(url), hasKey: Boolean(key) });
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await sb.from("applicant_attendance_logs").select("*").limit(1);
if (error) {
  console.log("TABLE_ERROR:", error.message);
  process.exit(0);
}

console.log(
  "TABLE_OK columns:",
  data?.[0] ? Object.keys(data[0]).sort().join(", ") : "empty table"
);

const { error: claimErr } = await sb
  .from("applicant_attendance_logs")
  .select("claimed_at, claimed_by")
  .limit(1);
console.log(claimErr ? `CLAIM_COLS_MISSING: ${claimErr.message}` : "CLAIM_COLS_OK");

const { data: allRows, error: allErr } = await sb.from("applicant_attendance_logs").select("status, claimed_at");
if (allErr) {
  console.log("STATUS_ERROR:", allErr.message);
  process.exit(0);
}

const rows = allRows ?? [];
const byStatus = rows.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] ?? 0) + 1;
  return acc;
}, {});
const unclaimed = rows.filter((row) => row.status === "clocked_out" && !row.claimed_at).length;
const completed = rows.filter((row) => row.status === "clocked_out" && row.claimed_at).length;

console.log("STATUS_COUNTS:", JSON.stringify(byStatus), "total", rows.length);
console.log("UNCLAIMED_COMPLETED:", { unclaimed, completed });
