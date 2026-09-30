/**
 * Measure Candidates list bottlenecks (RPC + /api/workers phases).
 * Usage:
 *   node scripts/measure-candidates-load.mjs
 *   BENCHMARK_TENANT_ID=<uuid> node scripts/measure-candidates-load.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function time(label, fn) {
  const started = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - started);
  return { label, ms, result };
}

loadEnvFile();

const tenantId =
  process.env.BENCHMARK_TENANT_ID?.trim() ||
  process.env.DEV_BENCHMARK_TENANT_ID?.trim() ||
  "efe85d96-536e-497b-9e1a-d8876d29feea";
const base = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

const rpcArgs = {
  p_tenant_id: tenantId,
  p_pipeline_status: null,
  p_exclude_converted: true,
  p_search: null,
  p_job_role: null,
  p_city: null,
  p_state: null,
  p_created_from: null,
  p_created_to: null,
  p_sort: "created_at",
  p_sort_dir: "desc",
  p_limit: 15,
  p_offset: 0,
  p_match_score_min: null,
  p_match_score_max: null,
  p_match_score_max_inclusive: true,
  p_progress_status_id: null,
  p_job_title: null,
  p_skills: null,
};

const rows = [];

async function runRpc(label, args) {
  const { ms, result } = await time(label, async () => {
    const { data, error } = await sb.rpc("list_candidate_ids_page", args);
    if (error) throw new Error(error.message);
    return {
      n: (data ?? []).length,
      total: data?.[0]?.total_count ?? 0,
    };
  });
  rows.push({ label, ms, ...result });
  console.log(`${label}: ${ms}ms n=${result.n} total=${result.total}`);
  return result;
}

console.log("tenant:", tenantId);
console.log("base:", base);

await runRpc("rpc_unfiltered_page1", rpcArgs);
await runRpc("rpc_search_micheal", { ...rpcArgs, p_search: "micheal" });

const idPage = await sb.rpc("list_candidate_ids_page", rpcArgs);
const ids = (idPage.data ?? []).map((r) => r.id).filter(Boolean);

{
  const { ms, result } = await time("worker_hydrate_15", async () => {
    const { data, error } = await sb
      .from("worker")
      .select(
        "id,user_id,first_name,last_name,job_role,email,phone,address1,city,state,zip,created_at,tenant_id,profile_photo,assigned_recruiter_user_id,status"
      )
      .in("id", ids);
    if (error) throw new Error(error.message);
    return { n: (data ?? []).length };
  });
  rows.push({ label: "worker_hydrate_15", ms, ...result });
  console.log(`worker_hydrate_15: ${ms}ms n=${result.n}`);
}

{
  const { ms, result } = await time("apps_status_match_for_page", async () => {
    const { data, error } = await sb
      .from("job_applications")
      .select("id,worker_id,status_id,status,ai_match_score,ai_match_status,ai_match_category,created_at,updated_at")
      .eq("tenant_id", tenantId)
      .in("worker_id", ids);
    if (error) throw new Error(error.message);
    return { n: (data ?? []).length };
  });
  rows.push({ label: "apps_status_match_for_page", ms, ...result });
  console.log(`apps_status_match_for_page: ${ms}ms n=${result.n}`);
}

{
  const { ms, result } = await time("legacy_tenant_range_15", async () => {
    const { data, error, count } = await sb
      .from("worker")
      .select("id", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(0, 14);
    if (error) throw new Error(error.message);
    return { n: (data ?? []).length, total: count };
  });
  rows.push({ label: "legacy_tenant_range_15", ms, ...result });
  console.log(`legacy_tenant_range_15: ${ms}ms n=${result.n} total=${result.total}`);
}

async function hitApi(path) {
  const cookie = [
    `view_as_tenant_id=${tenantId}`,
    process.env.BENCHMARK_COOKIE?.trim() || "",
  ]
    .filter(Boolean)
    .join("; ");
  const headers = { cookie };
  if (process.env.BENCHMARK_BEARER?.trim()) {
    headers.authorization = `Bearer ${process.env.BENCHMARK_BEARER.trim()}`;
  }
  const started = performance.now();
  const res = await fetch(`${base}${path}`, { headers, cache: "no-store" });
  const text = await res.text();
  const ms = Math.round(performance.now() - started);
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return {
    path,
    status: res.status,
    httpMs: ms,
    timingMs: json?.timingMs ?? null,
    total: json?.total ?? null,
    serverPaged: json?.serverPaged ?? null,
    workers: Array.isArray(json?.workers) ? json.workers.length : null,
    bytes: text.length,
    error: json?.error ?? null,
  };
}

for (const path of [
  "/api/workers?limit=15&offset=0",
  "/api/workers?limit=15&offset=0&includePhotoUrls=1",
  "/api/workers?limit=15&offset=0&q=micheal&includePhotoUrls=1",
  "/api/workers/metrics?",
]) {
  // warm + sample
  await hitApi(path);
  const a = await hitApi(path);
  const b = await hitApi(path);
  console.log("API", path, a, b);
  rows.push({ label: `api:${path}:a`, ...a });
  rows.push({ label: `api:${path}:b`, ...b });
}

const outPath = resolve(process.cwd(), "docs/candidates-load-baseline.json");
writeFileSync(outPath, JSON.stringify({ tenantId, base, at: new Date().toISOString(), rows }, null, 2));
console.log("wrote", outPath);
