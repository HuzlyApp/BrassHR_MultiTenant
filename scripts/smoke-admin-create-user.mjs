#!/usr/bin/env node
/**
 * Smoke-test admin.createUser with local .env (no password/email printed).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const name of [".env", ".env.local"]) {
  const path = join(process.cwd(), name);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error(JSON.stringify({ ok: false, error: "missing url or service role key" }));
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const testEmail = `pipeline.smoke.${Date.now()}@example.com`;
const { data, error } = await supabase.auth.admin.createUser({
  email: testEmail,
  password: "Test123!Smoke",
  email_confirm: true,
});

if (error) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        error: error.message,
        status: error.status ?? null,
        name: error.name ?? null,
      },
      null,
      2
    )
  );
  process.exit(1);
}

const userId = data.user?.id;
if (userId) {
  await supabase.auth.admin.deleteUser(userId);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      createdThenDeleted: Boolean(userId),
      note: "service_role can create users on this project",
    },
    null,
    2
  )
);
