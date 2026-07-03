import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signupUsCitiesSeedRows } from "../lib/signup/us-cities-by-state.ts";

const rows = signupUsCitiesSeedRows();
const values = rows
  .map(
    (r) =>
      `  ('${r.state_code}', '${r.city_name.replace(/'/g, "''")}', ${r.sort_order})`
  )
  .join(",\n");

const sql = `-- Seed major US cities for all states (signup business info city dropdown).
-- Safe to re-run: uses ON CONFLICT DO NOTHING.

INSERT INTO public.signup_us_cities (state_code, city_name, sort_order) VALUES
${values}
ON CONFLICT (state_code, city_name) DO NOTHING;
`;

const out = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "migrations",
  "20260704180000_seed_signup_us_cities_all_states.sql"
);
fs.writeFileSync(out, sql);
console.log(`Wrote ${rows.length} cities to ${out}`);
