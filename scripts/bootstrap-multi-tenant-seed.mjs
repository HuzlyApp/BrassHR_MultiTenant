/**
 * Seeds demo tenants (if migrations not applied), god admin credentials, optional HR admin linkage.
 *
 * Prerequisites: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage (repo root):
 *   node scripts/bootstrap-multi-tenant-seed.mjs
 *
 * Creates auth user godadmin@test.com / 123 unless it already exists:
 * - app_metadata: { platform: "nexus", role: "god_admin", god_admin: true }
 * - public.users: god_admin=true, tenant_id=NULL
 * Does not attach user_roles rows for god admin.
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
const GOD_EMAIL = "godadmin@test.com".toLowerCase();
const GOD_PW = "123";

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
const existing = listData?.users?.find((u) => (u.email || "").toLowerCase() === GOD_EMAIL);

let userId = existing?.id || null;

if (!userId) {
  const { data: created, error: cre } = await supabase.auth.admin.createUser({
    email: GOD_EMAIL,
    password: GOD_PW,
    email_confirm: true,
    app_metadata: { platform: "nexus", role: "god_admin", god_admin: true },
  });
  if (cre || !created.user?.id) {
    console.error(cre?.message || "Failed to create god admin");
    process.exit(1);
  }
  userId = created.user.id;
  console.log("Created god admin", GOD_EMAIL, userId);
} else {
  const { error: upd } = await supabase.auth.admin.updateUserById(userId, {
    password: GOD_PW,
    email_confirm: true,
    app_metadata: { platform: "nexus", role: "god_admin", god_admin: true },
  });
  if (upd) {
    console.error(upd.message);
    process.exit(1);
  }
  console.log("Updated god admin JWT metadata", GOD_EMAIL);
}

const { error: uErr } = await supabase.from("users").upsert(
  {
    id: userId,
    tenant_id: null,
    email: GOD_EMAIL,
    role: "admin",
    email_verified: true,
    god_admin: true,
  },
  { onConflict: "id" }
);
if (uErr) {
  console.error("users upsert:", uErr.message);
  console.error("(If migration for god_admin is missing, run supabase migrations first.)");
  process.exit(1);
}

console.log("Done. Tenant seed rows tenant-1 / tenant-2 come from migration 20260509120000_tenant_branding_multi_tenant.sql.");
console.log("Login:", GOD_EMAIL, "/", GOD_PW);
