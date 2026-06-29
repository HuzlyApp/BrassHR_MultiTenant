/**
 * Benchmark cache miss vs hit latency for selected API routes.
 * Usage: node scripts/benchmark-cache-routes.mjs [--base=http://localhost:3000]
 *
 * Optional env:
 *   BENCHMARK_COOKIE=...  (for authenticated admin routes)
 *   BENCHMARK_TENANT_ID=...  (view_as_tenant_id cookie for dashboard routes in dev)
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "redis";

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

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function hashBody(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

const ROUTES = [
  {
    name: "tenant-branding",
    path: "/api/tenant-branding?slug=braas-hr",
    cachePatterns: ["supabase:tenant_branding:slug:braas-hr:*"],
    ttl: "900s (tenantConfig)",
    auth: false,
  },
  {
    name: "effective-branding",
    path: "/api/admin/effective-branding",
    cachePatterns: ["supabase:admin_effective_branding:*", "supabase:tenants:tenant:*:branding:*"],
    ttl: "600s (userScoped)",
    auth: true,
  },
  {
    name: "header-data",
    path: "/api/admin/header-data",
    cachePatterns: ["supabase:admin_header_data:*"],
    ttl: "600s (userScoped)",
    auth: true,
  },
  {
    name: "dashboard-overview",
    path: "/api/admin/dashboard-overview",
    cachePatterns: ["supabase:dashboard_overview:*"],
    ttl: "120s (dashboards)",
    auth: true,
  },
  {
    name: "dashboard-analytics",
    path: "/api/admin/dashboard-analytics",
    cachePatterns: ["supabase:dashboard_analytics:*"],
    ttl: "120s (dashboards)",
    auth: true,
  },
  {
    name: "workers",
    path: "/api/workers?limit=50&offset=0",
    cachePatterns: [],
    ttl: "none (SQL pagination, no Redis list cache)",
    auth: true,
    latencyOnly: true,
  },
];

async function redisClient() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error("REDIS_URL missing");
  const client = createClient({ url });
  await client.connect();
  return client;
}

async function deletePatterns(client, patterns) {
  let deleted = 0;
  for (const pattern of patterns) {
    const keys = await client.keys(pattern);
    if (keys.length) {
      deleted += await client.del(keys);
    }
  }
  return deleted;
}

async function fetchRoute(base, path, auth) {
  const started = performance.now();
  const headers = {};
  const cookieParts = [];
  if (auth.cookie) cookieParts.push(auth.cookie);
  if (auth.tenantId) cookieParts.push(`view_as_tenant_id=${auth.tenantId}`);
  if (cookieParts.length) headers.cookie = cookieParts.join("; ");
  if (auth.bearer) headers.authorization = `Bearer ${auth.bearer}`;
  const res = await fetch(`${base}${path}`, { headers, cache: "no-store" });
  const body = await res.text();
  const ms = Math.round(performance.now() - started);
  return {
    status: res.status,
    ms,
    bytes: Buffer.byteLength(body, "utf8"),
    hash: hashBody(body),
    ok: res.ok,
  };
}

async function benchmarkRoute(base, route, auth, client) {
  const cleared = client ? await deletePatterns(client, route.cachePatterns) : 0;

  const runs = [];
  for (let i = 0; i < 6; i += 1) {
    runs.push(await fetchRoute(base, route.path, auth));
    if (i === 0 && runs[0].status >= 500) break;
  }

  const miss = runs[0];
  if (route.name.startsWith("dashboard-") && miss.status === 400) {
    return {
      route: route.name,
      path: route.path,
      clearedKeys: cleared,
      ttl: route.ttl,
      status: miss.status,
      missMs: miss.ms,
      hitP50: 0,
      hitP95: 0,
      improvementPct: null,
      bytes: miss.bytes,
      hash: miss.hash,
      identicalHits: false,
      cacheLikelyWorking: false,
      note: "Invalid benchmark — set BENCHMARK_TENANT_ID for tenant scope",
    };
  }

  const hits = runs.slice(1).filter((r) => r.status === miss.status);
  const hitMs = hits.map((r) => r.ms).sort((a, b) => a - b);
  const identicalHits =
    hits.length > 0 && hits.every((r) => r.hash === miss.hash && r.status === miss.status);

  const missMs = miss.ms;
  const hitP50 = percentile(hitMs, 50);
  const hitP95 = percentile(hitMs, 95);
  const improvement =
    missMs > 0 && hitP50 > 0 ? Math.round(((missMs - hitP50) / missMs) * 100) : null;

  return {
    route: route.name,
    path: route.path,
    clearedKeys: cleared,
    ttl: route.ttl,
    status: miss.status,
    missMs,
    hitP50,
    hitP95,
    improvementPct: improvement,
    bytes: miss.bytes,
    hash: miss.hash,
    identicalHits,
    cacheLikelyWorking: route.latencyOnly
      ? miss.status === 200
      : miss.status === 200 &&
        hits.length >= 2 &&
        identicalHits &&
        improvement !== null &&
        improvement >= 10,
    note: route.latencyOnly
      ? "Latency-only route (no Redis cache)"
      : miss.status === 400
        ? "Needs tenant scope (set BENCHMARK_TENANT_ID)"
        : miss.status === 401 || miss.status === 403
          ? "Needs auth cookie"
          : !identicalHits
            ? "Response body differed between requests"
            : improvement !== null && improvement < 10
              ? "Hit not much faster — loader may still run or bottleneck elsewhere"
              : "",
  };
}

loadEnvFile();

const baseArg = process.argv.find((a) => a.startsWith("--base="));
const base = baseArg?.split("=")[1] ?? "http://localhost:3000";
const cookie = process.env.BENCHMARK_COOKIE?.trim() || "";
const bearer = process.env.BENCHMARK_BEARER?.trim() || "";
const tenantId = process.env.BENCHMARK_TENANT_ID?.trim() || "";
const authMode =
  bearer ? "bearer" : cookie ? "cookie" : tenantId ? "dev-bypass+view-as" : "dev-bypass";

const auth = { cookie, bearer, tenantId };

console.log("=== Cache Route Benchmark ===");
console.log("base:", base);
console.log("auth mode:", authMode);
console.log("CACHE_ENABLED:", process.env.CACHE_ENABLED === "true");
console.log("PERF_LOG:", process.env.PERF_LOG === "true");
console.log("REDIS_URL set:", Boolean(process.env.REDIS_URL?.trim()));
console.log("auth cookie set:", Boolean(cookie));
console.log("auth bearer set:", Boolean(bearer));
console.log("tenant id set:", Boolean(tenantId));
console.log("");

let client = null;
try {
  client = await redisClient();
  const pong = await client.ping();
  console.log("Redis PING:", pong);
} catch (err) {
  console.warn("Redis unavailable — measuring warm hits without cache bust:", err?.message ?? err);
}
console.log("");

const results = [];
for (const route of ROUTES) {
  const row = await benchmarkRoute(base, route, auth, client);
  results.push(row);
  console.log(JSON.stringify(row));
}
if (client) await client.quit();

console.log("\n=== Summary Table ===");
console.log(
  "Route | Status | Miss ms | Hit p50 ms | Improvement | Bytes | Cache working? | Notes",
);
for (const r of results) {
  console.log(
    [
      r.route,
      r.status,
      r.missMs,
      r.hitP50 || "—",
      r.improvementPct != null ? `${r.improvementPct}%` : "—",
      r.bytes,
      r.cacheLikelyWorking ? "yes" : "no",
      r.note || "",
    ].join(" | "),
  );
}
