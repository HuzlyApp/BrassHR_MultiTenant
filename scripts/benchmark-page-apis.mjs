/**
 * Simulates admin page load API waterfall and counts duplicate-prone calls.
 * Usage: BENCHMARK_TENANT_ID=<uuid> node scripts/benchmark-page-apis.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const ADMIN_DASHBOARD_APIS = [
  "/api/admin/effective-branding",
  "/api/admin/header-data",
  "/api/admin/dashboard-overview",
  "/api/admin/dashboard-analytics",
];

async function fetchOne(base, path, tenantId) {
  const started = performance.now();
  const headers = {};
  if (tenantId) headers.cookie = `view_as_tenant_id=${tenantId}`;
  const res = await fetch(`${base}${path}`, { headers, cache: "no-store" });
  const body = await res.text();
  return {
    path,
    status: res.status,
    ms: Math.round(performance.now() - started),
    bytes: Buffer.byteLength(body, "utf8"),
  };
}

loadEnvFile();
const base = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://localhost:3000";
const tenantId = process.env.BENCHMARK_TENANT_ID?.trim() ?? "";

console.log("=== Admin Page API Waterfall (cold) ===");
console.log("base:", base, "tenant:", tenantId || "(none)");

const cold = [];
for (const path of ADMIN_DASHBOARD_APIS) {
  cold.push(await fetchOne(base, path, tenantId));
}
console.log("\nCold (sequential, cache cleared by prior benchmark if run):");
for (const r of cold) {
  console.log(`${r.path} | ${r.status} | ${r.ms}ms | ${r.bytes}B`);
}
console.log("Total cold ms:", cold.reduce((s, r) => s + r.ms, 0));

console.log("\n=== Warm repeat (simulates React Query dedupe on 2nd navigation) ===");
const warm = await Promise.all(ADMIN_DASHBOARD_APIS.map((path) => fetchOne(base, path, tenantId)));
for (const r of warm) {
  console.log(`${r.path} | ${r.status} | ${r.ms}ms | ${r.bytes}B`);
}
console.log("Total warm ms (parallel):", Math.max(...warm.map((r) => r.ms)));

console.log("\nExpected after dedupe: 1x effective-branding, 1x header-data per navigation (client-side).");
console.log("Server parallel warm total should be dominated by slowest single route when caches are hot.");
