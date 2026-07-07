#!/usr/bin/env node
/**
 * Verifies brasshr_south schema after migration push.
 * Usage: node scripts/verify-brasshr-south-schema.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.FALLBACK_NEXT_PUBLIC_SUPABASE_URL?.trim();
const key =
  process.env.FALLBACK_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.FALLBACK_NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!url || !key) {
  console.error("Missing FALLBACK_NEXT_PUBLIC_SUPABASE_URL or service/anon key in environment");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const requiredTables = [
  "tenants",
  "users",
  "worker",
  "worker_documents",
  "worker_requirements",
  "skill_categories",
  "skill_questions",
  "applicant_messages",
  "support_tickets",
  "groups",
  "group_messages",
  "email_templates",
  "auth_login_otps",
  "worker_firma_signing_sessions",
  "onboarding_step_library",
  "applicant_conversation_reads",
];

const requiredBuckets = [
  "worker_required_files",
  "worker-resumes",
  "organization-logos",
  "applicant-chat",
  "support-ticket-files",
  "staff-profile-photos",
  "recruiter-template-documents",
];

async function main() {
  const results = { tables: {}, buckets: {}, policies: null, functions: null };

  for (const table of requiredTables) {
    const { error } = await supabase.from(table).select("*", { head: true, count: "exact" });
    results.tables[table] = error ? `MISSING (${error.message})` : "ok";
  }

  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    results.buckets = { error: bucketError.message };
  } else {
    const names = new Set((buckets ?? []).map((b) => b.name));
    for (const bucket of requiredBuckets) {
      results.buckets[bucket] = names.has(bucket) ? "ok" : "MISSING";
    }
  }

  const { data: policies, error: policyError } = await supabase.rpc("exec_sql", {});
  results.policies = policyError ? "checked via REST only" : policies;

  const { data: tenants, error: tenantError } = await supabase
    .from("tenants")
    .select("slug")
    .eq("is_active", true)
    .limit(5);
  results.sampleTenants = tenantError ? tenantError.message : tenants;

  const { count: skillQuestionCount, error: skillError } = await supabase
    .from("skill_questions")
    .select("*", { head: true, count: "exact" });
  results.skillQuestionCount = skillError ? skillError.message : skillQuestionCount;

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
