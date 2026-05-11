/**
 * One-time (or idempotent) bootstrap for an HR admin in Supabase.
 *
 * Multi-tenant: ensures a tenant row exists (reuse first row or create `nexus`), then
 * upserts `public.users` and `public.user_roles` with that `tenant_id`.
 *
 * Usage (PowerShell, from repo root, with secrets NOT in source control):
 *   $env:HR_ADMIN_BOOTSTRAP_PASSWORD = 'your-secure-password'
 *   node scripts/bootstrap-hr-admin.mjs
 *
 * Requires in env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: HR_ADMIN_EMAIL (default hradmin@nexus.com),
 *           HR_ADMIN_TENANT_SLUG (default `nexus` when creating tenant)
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

function loadDotEnv() {
  const p = join(process.cwd(), ".env");
  if (!existsSync(p)) return;
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

loadDotEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.HR_ADMIN_BOOTSTRAP_PASSWORD;
const email = (process.env.HR_ADMIN_EMAIL || "hradmin@nexus.com").trim().toLowerCase();
const tenantSlug = (process.env.HR_ADMIN_TENANT_SLUG || "nexus").trim().toLowerCase();

if (!url || !serviceKey) {
  // eslint-disable-next-line no-console
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!password) {
  // eslint-disable-next-line no-console
  console.error("Set HR_ADMIN_BOOTSTRAP_PASSWORD in the environment.");
  process.exit(1);
}

async function resolveTenantId(supabaseClient) {
  const { data: existingList, error: listErr } = await supabaseClient
    .from("tenants")
    .select("id, slug")
    .order("created_at", { ascending: true })
    .limit(1);
  if (listErr) {
    throw new Error(`tenants list: ${listErr.message}`);
  }
  const first = existingList?.[0];
  if (first?.id) {
    return first.id;
  }
  const slug = tenantSlug.replace(/[^a-z0-9-]/g, "-") || "nexus";
  const { data: inserted, error: insErr } = await supabaseClient
    .from("tenants")
    .insert({
      name: "Nexus (default tenant)",
      slug,
      plan: "starter",
      is_active: true,
    })
    .select("id")
    .single();
  if (insErr || !inserted?.id) {
    throw new Error(insErr?.message || "Failed to insert default tenant");
  }
  // eslint-disable-next-line no-console
  console.log("Created default tenant", slug, inserted.id);
  return inserted.id;
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (listErr) {
  // eslint-disable-next-line no-console
  console.error(listErr);
  process.exit(1);
}

const tenantId = await resolveTenantId(supabase);

const existing = listData?.users?.find(
  (u) => (u.email || "").toLowerCase() === email
);

let userId = existing?.id ?? null;

if (!userId) {
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { platform: "nexus", tenant_id: tenantId, role: "admin" },
  });
  if (createErr || !created?.user?.id) {
    // eslint-disable-next-line no-console
    console.error(createErr || "createUser failed");
    process.exit(1);
  }
  userId = created.user.id;
  // eslint-disable-next-line no-console
  console.log("Created auth user", email, userId);
} else {
  const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    app_metadata: { platform: "nexus", tenant_id: tenantId, role: "admin" },
  });
  if (updErr) {
    // eslint-disable-next-line no-console
    console.error("updateUser:", updErr);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log("Updated existing auth user", email, userId);
}

const { error: usersErr } = await supabase.from("users").upsert(
  {
    id: userId,
    tenant_id: tenantId,
    email,
    role: "admin",
    email_verified: true,
  },
  { onConflict: "id" }
);
if (usersErr) {
  // eslint-disable-next-line no-console
  console.error("public.users upsert:", usersErr);
  process.exit(1);
}

const { error: roleErr } = await supabase.from("user_roles").upsert(
  { user_id: userId, tenant_id: tenantId, role: "admin" },
  { onConflict: "user_id,tenant_id" }
);
if (roleErr) {
  // eslint-disable-next-line no-console
  console.error("user_roles upsert:", roleErr);
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log("Done. HR admin ready:", email);
