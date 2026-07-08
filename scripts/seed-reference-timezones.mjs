// Seed reference_us_timezones in Supabase using the service role.
// Fixes FK error 23503 on account_settings.timezone when the reference
// table is empty. Idempotent: upserts on the primary key (value).
// Reads creds from .env.local.
//
//   node scripts/seed-reference-timezones.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const text = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!(key in env)) env[key] = value;
  }
  return env;
}

// value, label, region, region_sort_order, sort_order
const TIMEZONES = [
  ["America/New_York", "New York", "Eastern", 1, 1],
  ["America/Detroit", "Detroit, MI", "Eastern", 1, 2],
  ["America/Kentucky/Louisville", "Louisville, KY", "Eastern", 1, 3],
  ["America/Kentucky/Monticello", "Monticello, KY", "Eastern", 1, 4],
  ["America/Indiana/Indianapolis", "Indianapolis, IN", "Eastern", 1, 5],
  ["America/Indiana/Vincennes", "Vincennes, IN", "Eastern", 1, 6],
  ["America/Indiana/Winamac", "Winamac, IN", "Eastern", 1, 7],
  ["America/Indiana/Marengo", "Marengo, IN", "Eastern", 1, 8],
  ["America/Indiana/Petersburg", "Petersburg, IN", "Eastern", 1, 9],
  ["America/Indiana/Vevay", "Vevay, IN", "Eastern", 1, 10],
  ["America/Chicago", "Chicago, IL", "Central", 2, 11],
  ["America/Indiana/Tell_City", "Tell City, IN", "Central", 2, 12],
  ["America/Indiana/Knox", "Knox, IN", "Central", 2, 13],
  ["America/Menominee", "Menominee, MI", "Central", 2, 14],
  ["America/North_Dakota/Center", "Center, ND", "Central", 2, 15],
  ["America/North_Dakota/New_Salem", "New Salem, ND", "Central", 2, 16],
  ["America/North_Dakota/Beulah", "Beulah, ND", "Central", 2, 17],
  ["America/Denver", "Denver, CO", "Mountain", 3, 18],
  ["America/Boise", "Boise, ID", "Mountain", 3, 19],
  ["America/Phoenix", "Phoenix, AZ (no DST)", "Mountain", 3, 20],
  ["America/Los_Angeles", "Los Angeles, CA", "Pacific", 4, 21],
  ["America/Anchorage", "Anchorage, AK", "Alaska", 5, 22],
  ["America/Juneau", "Juneau, AK", "Alaska", 5, 23],
  ["America/Sitka", "Sitka, AK", "Alaska", 5, 24],
  ["America/Metlakatla", "Metlakatla, AK", "Alaska", 5, 25],
  ["America/Yakutat", "Yakutat, AK", "Alaska", 5, 26],
  ["America/Nome", "Nome, AK", "Alaska", 5, 27],
  ["America/Adak", "Adak, AK (Aleutian)", "Alaska", 5, 28],
  ["Pacific/Honolulu", "Honolulu, HI", "Hawaii", 6, 29],
  ["America/Puerto_Rico", "Puerto Rico", "US Territories", 7, 30],
  ["America/St_Thomas", "US Virgin Islands", "US Territories", 7, 31],
  ["Pacific/Guam", "Guam", "US Territories", 7, 32],
  ["Pacific/Saipan", "Northern Mariana Islands", "US Territories", 7, 33],
  ["Pacific/Pago_Pago", "American Samoa", "US Territories", 7, 34],
];

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count: beforeCount } = await supabase
    .from("reference_us_timezones")
    .select("*", { count: "exact", head: true });
  console.log(`Before → reference_us_timezones rows: ${beforeCount ?? 0}`);

  const rows = TIMEZONES.map(([value, label, region, region_sort_order, sort_order]) => ({
    value,
    label,
    region,
    region_sort_order,
    sort_order,
    active: true,
  }));

  const { error } = await supabase
    .from("reference_us_timezones")
    .upsert(rows, { onConflict: "value" });
  if (error) throw new Error(`Timezones upsert failed: ${error.message}`);
  console.log(`Upserted ${rows.length} timezones.`);

  const { count: afterCount } = await supabase
    .from("reference_us_timezones")
    .select("*", { count: "exact", head: true });
  console.log(`After → reference_us_timezones rows: ${afterCount ?? 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
