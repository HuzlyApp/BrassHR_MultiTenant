/**
 * Browser-style page load API audit (script proxy for Network tab checks).
 * Usage: BENCHMARK_TENANT_ID=<uuid> node scripts/benchmark-browser-pages.mjs
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

const PAGES = [
  {
    name: "admin dashboard",
    path: "/admin_recruiter/dashboard",
    apis: [
      "/api/admin/effective-branding",
      "/api/admin/header-data",
      "/api/admin/dashboard-overview",
    ],
  },
  {
    name: "admin analytics",
    path: "/admin_recruiter/analytics",
    apis: [
      "/api/admin/effective-branding",
      "/api/admin/header-data",
      "/api/admin/dashboard-analytics",
    ],
  },
  {
    name: "worker list",
    path: "/admin_recruiter/workers",
    apis: [
      "/api/admin/effective-branding",
      "/api/admin/header-data",
      "/api/workers?limit=50&offset=0",
    ],
  },
  {
    name: "messages",
    path: "/admin_recruiter/messages",
    apis: [
      "/api/admin/effective-branding",
      "/api/admin/header-data",
      "/api/admin/conversations",
    ],
  },
  {
    name: "login branding",
    path: "/login",
    apis: ["/api/tenant-branding?slug=braas-hr"],
  },
];

async function fetchApi(base, path, auth) {
  const started = performance.now();
  const headers = {};
  const cookieParts = [];
  if (auth.cookie) cookieParts.push(auth.cookie);
  if (auth.tenantId) cookieParts.push(`view_as_tenant_id=${auth.tenantId}`);
  if (cookieParts.length) headers.cookie = cookieParts.join("; ");
  if (auth.bearer) headers.authorization = `Bearer ${auth.bearer}`;
  const res = await fetch(`${base}${path}`, { headers, cache: "no-store" });
  await res.text();
  return { path, status: res.status, ms: Math.round(performance.now() - started) };
}

loadEnvFile();
const base = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://localhost:3000";
const auth = {
  cookie: process.env.BENCHMARK_COOKIE?.trim() || "",
  bearer: process.env.BENCHMARK_BEARER?.trim() || "",
  tenantId: process.env.BENCHMARK_TENANT_ID?.trim() || "",
};

console.log("=== Browser Page API Audit (warm cache, parallel) ===");
console.log("base:", base, "tenant:", auth.tenantId || "(none)");

for (const page of PAGES) {
  const results = await Promise.all(page.apis.map((p) => fetchApi(base, p, auth)));
  const counts = new Map();
  for (const r of results) {
    counts.set(r.path, (counts.get(r.path) ?? 0) + 1);
  }
  const duplicates = [...counts.entries()].filter(([, n]) => n > 1).map(([p]) => p);
  const slowest = results.reduce((a, b) => (b.ms > a.ms ? b : a), results[0]);

  console.log(`\n--- ${page.name} (${page.path}) ---`);
  console.log("API count:", results.length);
  console.log("Duplicates:", duplicates.length ? duplicates.join(", ") : "none");
  console.log("Slowest:", slowest?.path, slowest?.ms + "ms", "status", slowest?.status);
  for (const r of results.sort((a, b) => b.ms - a.ms)) {
    console.log(`  ${r.path} | ${r.status} | ${r.ms}ms`);
  }
}

console.log("\nDedupe expectations:");
console.log("- effective-branding: 1x per admin shell navigation (React Query)");
console.log("- header-data: 1x per admin shell navigation");
console.log("- conversations: 1x on messages page (useStaffConversations hook)");
console.log("- /api/workers: no includePhotoUrls unless photo column visible");
