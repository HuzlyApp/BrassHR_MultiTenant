#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient as createNodeRedisClient } from "redis";

const ROOT = process.cwd();
const DEFAULT_REPORT_PATH = path.join("docs", "performance-report.md");
const DEFAULT_JSON_PATH = path.join("docs", "performance-results.json");
const cli = parseArgs(process.argv.slice(2));

const env = process.env;
const baseUrl = normalizeBaseUrl(cli.baseUrl || env.PERF_BASE_URL || "http://localhost:3000");
const reportPath = cli.report || env.PERF_REPORT_PATH || DEFAULT_REPORT_PATH;
const jsonPath = cli.json || env.PERF_JSON_PATH || DEFAULT_JSON_PATH;
const timeoutMs = toInt(env.PERF_TIMEOUT_MS, 15000);
const warmIterations = toInt(env.PERF_WARM_ITERATIONS, 5);
const repeatedIterations = toInt(env.PERF_REPEATED_ITERATIONS, 10);
const concurrentLevels = parseCsvInts(env.PERF_CONCURRENCY_LEVELS || "10,25,50");
const readOnly = env.PERF_READ_ONLY !== "false";
const clearCache = env.PERF_CLEAR_CACHE !== "false";
const mode = cli.mode || env.PERF_MODE || "cached";
const bearerToken = env.PERF_BEARER_TOKEN || "";
const cookieHeader = env.PERF_COOKIE || "";

const vars = {
  tenantSlug: env.PERF_TENANT_SLUG || env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG || "",
  tenantId: env.PERF_TENANT_ID || "",
  workerId: env.PERF_WORKER_ID || "",
  applicantId: env.PERF_APPLICANT_ID || "",
  candidateId: env.PERF_CANDIDATE_ID || env.PERF_WORKER_ID || "",
  lat: Number(env.PERF_SEARCH_LAT || "40.7128"),
  lng: Number(env.PERF_SEARCH_LNG || "-74.0060"),
  radius: Number(env.PERF_SEARCH_RADIUS_MILES || "25"),
  place: env.PERF_SEARCH_PLACE || "",
};

const endpointCatalog = [
  {
    name: "Homepage",
    method: "GET",
    path: "/",
    type: "Public page",
    groups: ["public", "page", "non-cacheable"],
    cacheable: false,
  },
  {
    name: "Login page",
    method: "GET",
    path: "/login",
    type: "Public page",
    groups: ["public", "page", "auth"],
    cacheable: false,
  },
  {
    name: "Signup page",
    method: "GET",
    path: "/signup",
    type: "Public page",
    groups: ["public", "page", "auth"],
    cacheable: false,
  },
  {
    name: "Tenant branding",
    method: "GET",
    path: () => `/api/tenant-branding${vars.tenantSlug ? `?slug=${encodeURIComponent(vars.tenantSlug)}` : ""}`,
    type: "Public API",
    groups: ["public", "tenant-scoped", "supabase-read", "cacheable"],
    cacheable: true,
  },
  {
    name: "Skill categories",
    method: "GET",
    path: "/api/skill-categories",
    type: "Public API",
    groups: ["public", "supabase-read", "cacheable", "reference"],
    cacheable: true,
  },
  {
    name: "Skill questions",
    method: "GET",
    path: "/api/skill-questions",
    type: "Public API",
    groups: ["public", "supabase-read", "cacheable", "reference"],
    cacheable: true,
  },
  {
    name: "Published onboarding config",
    method: "GET",
    path: () =>
      vars.tenantId
        ? `/api/onboarding/config?tenantId=${encodeURIComponent(vars.tenantId)}`
        : `/api/onboarding/config?slug=${encodeURIComponent(vars.tenantSlug)}`,
    type: "Public API",
    groups: ["public", "tenant-scoped", "supabase-read", "cacheable"],
    cacheable: true,
    requiredVars: ["tenantSlug|tenantId"],
  },
  {
    name: "Applicant worker documents status",
    method: "GET",
    path: () => `/api/onboarding/worker-documents?applicantId=${encodeURIComponent(vars.applicantId)}`,
    type: "Applicant API",
    groups: ["authenticated-user", "supabase-read", "cacheable", "user-scoped"],
    cacheable: true,
    requiredVars: ["applicantId"],
  },
  {
    name: "Applicant worker requirements status",
    method: "GET",
    path: () => `/api/onboarding/worker-requirements?applicantId=${encodeURIComponent(vars.applicantId)}`,
    type: "Applicant API",
    groups: ["authenticated-user", "supabase-read", "cacheable", "user-scoped"],
    cacheable: true,
    requiredVars: ["applicantId"],
  },
  {
    name: "Admin header data",
    method: "GET",
    path: "/api/admin/header-data",
    type: "Authenticated API",
    groups: ["authenticated-user", "supabase-read", "cacheable", "user-scoped"],
    cacheable: true,
    authRequired: true,
  },
  {
    name: "Admin tenant list",
    method: "GET",
    path: "/api/admin/tenants",
    type: "Authenticated API",
    groups: ["authenticated-user", "tenant-scoped", "supabase-read", "cacheable"],
    cacheable: true,
    authRequired: true,
  },
  {
    name: "Admin effective branding",
    method: "GET",
    path: "/api/admin/effective-branding",
    type: "Authenticated API",
    groups: ["authenticated-user", "tenant-scoped", "supabase-read", "cacheable"],
    cacheable: true,
    authRequired: true,
  },
  {
    name: "Workers head count",
    method: "GET",
    path: "/api/workers?head=1",
    type: "Authenticated API",
    groups: ["authenticated-user", "tenant-scoped", "supabase-read", "non-cacheable", "list"],
    cacheable: false,
    authRequired: true,
  },
  {
    name: "Worker search",
    method: "POST",
    path: "/api/search-workers",
    body: () => ({
      lat: vars.lat,
      lng: vars.lng,
      radius: vars.radius,
      place: vars.place,
    }),
    type: "Authenticated API",
    groups: ["authenticated-user", "tenant-scoped", "supabase-read", "cacheable", "search"],
    cacheable: true,
    authRequired: true,
  },
  {
    name: "Recruiter candidate bundle",
    method: "GET",
    path: () => `/api/admin/recruiter-data?candidate_id=${encodeURIComponent(vars.candidateId)}`,
    type: "Authenticated API",
    groups: ["authenticated-user", "supabase-read", "cacheable", "detail"],
    cacheable: true,
    authRequired: true,
    requiredVars: ["candidateId"],
  },
  {
    name: "Admin worker profile",
    method: "GET",
    path: () => `/api/admin/worker-profile?workerId=${encodeURIComponent(vars.workerId)}`,
    type: "Authenticated API",
    groups: ["authenticated-user", "supabase-read", "non-cacheable", "detail"],
    cacheable: false,
    authRequired: true,
    requiredVars: ["workerId"],
  },
];

const mutationCatalog = [
  "POST /api/onboarding/save-worker",
  "POST /api/onboarding/worker-documents",
  "POST /api/onboarding/worker-requirements",
  "POST /api/onboarding/worker-references",
  "POST /api/onboarding/skill-assessment/submit",
  "PUT /api/admin/email-templates",
  "PUT /api/admin/onboarding/config",
  "PATCH /api/admin/header-data",
  "POST /api/admin/candidates/[workerId]/communications/email",
  "POST /api/admin/candidates/[workerId]/communications/sms",
];

function parseArgs(args) {
  const parsed = {};
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    const value = rest.length ? rest.join("=") : "true";
    parsed[key.replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value;
  }
  return parsed;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function parseCsvInts(value) {
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.floor(n));
}

function resolvePath(endpoint) {
  return typeof endpoint.path === "function" ? endpoint.path() : endpoint.path;
}

function hasRequiredVars(endpoint) {
  const required = endpoint.requiredVars || [];
  return required.every((entry) => {
    if (entry.includes("|")) {
      return entry.split("|").some((key) => Boolean(vars[key]));
    }
    return Boolean(vars[entry]);
  });
}

function hasAuth() {
  return Boolean(cookieHeader || bearerToken);
}

function requestHeaders(endpoint) {
  const headers = {
    "user-agent": "brasshr-perf-benchmark/1.0",
    accept: "application/json,text/html;q=0.9,*/*;q=0.8",
  };
  if (endpoint.method !== "GET") headers["content-type"] = "application/json";
  if (cookieHeader) headers.cookie = cookieHeader;
  if (bearerToken) headers.authorization = `Bearer ${bearerToken}`;
  if (mode === "uncached") headers["x-cache-mode"] = "disabled-client-run";
  return headers;
}

function safeEndpointList() {
  return endpointCatalog
    .map((endpoint) => ({ ...endpoint, resolvedPath: resolvePath(endpoint) }))
    .filter((endpoint) => hasRequiredVars(endpoint))
    .filter((endpoint) => !endpoint.authRequired || hasAuth())
    .filter((endpoint) => readOnly || endpoint.method === "GET" || endpoint.groups.includes("supabase-read"));
}

async function walk(dir, matcher, acc = []) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      await walk(full, matcher, acc);
    } else if (matcher(full)) {
      acc.push(path.relative(ROOT, full));
    }
  }
  return acc;
}

async function inspectCodebase() {
  const appDir = path.join(ROOT, "app");
  const routeFiles = await walk(appDir, (file) => file.endsWith(`${path.sep}route.ts`));
  const pageFiles = await walk(appDir, (file) => file.endsWith(`${path.sep}page.tsx`));
  return {
    routeFiles,
    pageFiles,
    totalRoutes: routeFiles.length,
    totalPages: pageFiles.length,
  };
}

async function createRedisControl() {
  const url = env.REDIS_URL?.trim();
  if (!url) return null;
  const token = env.REDIS_TOKEN?.trim();

  try {
    if (token) {
      const redis = new UpstashRedis({ url, token });
      return {
        async clear(pattern) {
          let cursor = 0;
          let deleted = 0;
          do {
            const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
            cursor = Number(nextCursor);
            if (keys.length > 0) {
              deleted += keys.length;
              await redis.del(...keys);
            }
          } while (cursor !== 0);
          return deleted;
        },
        async close() {},
      };
    }

    if (url.startsWith("redis://") || url.startsWith("rediss://")) {
      const client = createNodeRedisClient({ url });
      client.on("error", () => {});
      await client.connect();
      return {
        async clear(pattern) {
          const keys = [];
          let deleted = 0;
          for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
            keys.push(String(key));
            if (keys.length >= 100) {
              deleted += keys.length;
              await client.del(keys.splice(0, keys.length));
            }
          }
          if (keys.length > 0) {
            deleted += keys.length;
            await client.del(keys);
          }
          return deleted;
        },
        async close() {
          await client.quit();
        },
      };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), clear: null, close: async () => {} };
  }

  return null;
}

async function clearBenchmarkCache(redisControl, endpoints) {
  if (!redisControl?.clear || !clearCache) return { attempted: false, deleted: 0, error: redisControl?.error || null };
  const patterns = new Set(["supabase:*"]);
  for (const endpoint of endpoints) {
    if (endpoint.cacheable) {
      for (const group of endpoint.groups) {
        if (group === "reference") patterns.add("supabase:skill_*");
      }
    }
  }
  let deleted = 0;
  try {
    for (const pattern of patterns) {
      deleted += await redisControl.clear(pattern);
    }
    return { attempted: true, deleted, error: null };
  } catch (error) {
    return { attempted: true, deleted, error: error instanceof Error ? error.message : String(error) };
  }
}

async function requestOnce(endpoint) {
  const url = `${baseUrl}${endpoint.resolvedPath}`;
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let status = 0;
  let ok = false;
  let error = null;
  let headers = {};

  try {
    const response = await fetch(url, {
      method: endpoint.method,
      headers: requestHeaders(endpoint),
      body: endpoint.method === "GET" ? undefined : JSON.stringify(endpoint.body?.() || {}),
      signal: controller.signal,
      redirect: "manual",
    });
    status = response.status;
    ok = response.status < 500;
    headers = {
      cache: response.headers.get("x-cache") || "",
      responseTime: response.headers.get("x-response-time-ms") || "",
      redisEnabled: response.headers.get("x-redis-enabled") || "",
    };
    await response.arrayBuffer().catch(() => null);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timeout);
  }

  return {
    endpoint: endpoint.name,
    method: endpoint.method,
    path: endpoint.resolvedPath,
    status,
    ok,
    error,
    durationMs: performance.now() - started,
    headers,
  };
}

async function runSerial(endpoint, iterations) {
  const results = [];
  for (let i = 0; i < iterations; i += 1) {
    results.push(await requestOnce(endpoint));
  }
  return results;
}

async function runConcurrent(endpoint, concurrency) {
  return Promise.all(Array.from({ length: concurrency }, () => requestOnce(endpoint)));
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function summarize(samples) {
  const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
  const total = durations.reduce((sum, value) => sum + value, 0);
  const errors = samples.filter((sample) => !sample.ok).length;
  const seconds = total / 1000;
  const hitCount = samples.filter((sample) => sample.headers.cache === "HIT").length;
  const missCount = samples.filter((sample) => sample.headers.cache === "MISS").length;
  const bypassCount = samples.filter((sample) => sample.headers.cache === "BYPASS").length;
  const errorCount = samples.filter((sample) => sample.headers.cache === "ERROR").length;

  return {
    count: samples.length,
    errors,
    errorRate: samples.length ? errors / samples.length : 0,
    min: durations[0] || 0,
    max: durations.at(-1) || 0,
    avg: samples.length ? total / samples.length : 0,
    p50: percentile(durations, 50),
    p75: percentile(durations, 75),
    p90: percentile(durations, 90),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    rps: seconds > 0 ? samples.length / seconds : 0,
    hitCount,
    missCount,
    bypassCount,
    cacheErrorCount: errorCount,
    cacheObserved: hitCount + missCount + bypassCount + errorCount,
  };
}

function summarizeStatuses(samples) {
  const counts = samples.reduce((acc, sample) => {
    const key = String(sample.status || sample.error || "unknown");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${key}:${count}`)
    .join(", ");
}

async function runScenario(name, endpoints, runner) {
  const endpointResults = [];
  for (const endpoint of endpoints) {
    const samples = await runner(endpoint);
    endpointResults.push({
      endpoint,
      samples,
      summary: summarize(samples),
    });
  }
  return {
    name,
    endpoints: endpointResults,
    summary: summarize(endpointResults.flatMap((item) => item.samples)),
  };
}

function formatMs(value) {
  return `${value.toFixed(1)} ms`;
}

function formatPct(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function table(headers, rows) {
  const header = `| ${headers.join(" |")} |`;
  const sep = `| ${headers.map(() => "---").join(" |")} |`;
  return [header, sep, ...rows.map((row) => `| ${row.join(" |")} |`)].join("\n");
}

function endpointGroupSummary(endpoints) {
  const groups = new Map();
  for (const endpoint of endpointCatalog) {
    const runnable = endpoints.some((item) => item.name === endpoint.name);
    for (const group of endpoint.groups) {
      const current = groups.get(group) || { catalog: 0, runnable: 0 };
      current.catalog += 1;
      if (runnable) current.runnable += 1;
      groups.set(group, current);
    }
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function renderReport({ inspection, endpoints, skipped, cacheClearResult, scenarios, startedAt, finishedAt }) {
  const allEndpointRows = scenarios.flatMap((scenario) =>
    scenario.endpoints.map((item) => ({
      scenario: scenario.name,
      endpoint: item.endpoint.name,
      method: item.endpoint.method,
      path: item.endpoint.resolvedPath,
      statuses: summarizeStatuses(item.samples),
      ...item.summary,
    }))
  );
  const slowest = [...allEndpointRows].sort((a, b) => b.p95 - a.p95).slice(0, 10);
  const fastest = [...allEndpointRows].sort((a, b) => a.p50 - b.p50).slice(0, 10);
  const poorCache = [...allEndpointRows]
    .filter((row) => row.cacheObserved > 0 && row.hitCount / row.cacheObserved < 0.5)
    .sort((a, b) => a.hitCount / Math.max(a.cacheObserved, 1) - b.hitCount / Math.max(b.cacheObserved, 1))
    .slice(0, 10);

  const lines = [];
  lines.push("# Performance Benchmark Report");
  lines.push("");
  lines.push(`Generated: ${finishedAt.toISOString()}`);
  lines.push(`Started: ${startedAt.toISOString()}`);
  lines.push(`Base URL: ${baseUrl}`);
  lines.push(`Mode label: ${mode}`);
  lines.push(`Redis env visible to benchmark: ${env.REDIS_URL ? "configured" : "not configured"}`);
  lines.push(`Cache clear: ${cacheClearResult.attempted ? `${cacheClearResult.deleted} keys deleted` : "not attempted"}${cacheClearResult.error ? ` (${cacheClearResult.error})` : ""}`);
  lines.push(`Read-only mode: ${readOnly ? "true" : "false"}`);
  lines.push("");

  lines.push("## Codebase Inventory");
  lines.push("");
  lines.push(`Route handlers found: ${inspection.totalRoutes}`);
  lines.push(`Page routes found: ${inspection.totalPages}`);
  lines.push(`Benchmark endpoints runnable in this environment: ${endpoints.length}`);
  lines.push(`Catalog endpoints skipped: ${skipped.length}`);
  lines.push(`Known mutation routes cataloged but not benchmarked by default: ${mutationCatalog.length}`);
  lines.push("");

  lines.push(table(["Group", "Catalog endpoints", "Runnable endpoints"], endpointGroupSummary(endpoints).map(([group, counts]) => [group, counts.catalog, counts.runnable])));
  lines.push("");

  if (skipped.length > 0) {
    lines.push("## Skipped Endpoints");
    lines.push("");
    lines.push(table(["Endpoint", "Reason"], skipped.map((item) => [item.name, item.reason])));
    lines.push("");
  }

  lines.push("## Scenario Summary");
  lines.push("");
  lines.push(
    table(
      ["Scenario", "Requests", "Errors", "Error rate", "Avg", "p50", "p90", "p95", "p99", "RPS", "Cache hits", "Cache misses"],
      scenarios.map((scenario) => [
        scenario.name,
        scenario.summary.count,
        scenario.summary.errors,
        formatPct(scenario.summary.errorRate),
        formatMs(scenario.summary.avg),
        formatMs(scenario.summary.p50),
        formatMs(scenario.summary.p90),
        formatMs(scenario.summary.p95),
        formatMs(scenario.summary.p99),
        scenario.summary.rps.toFixed(2),
        scenario.summary.hitCount,
        scenario.summary.missCount,
      ])
    )
  );
  lines.push("");

  if (scenarios.some((scenario) => scenario.summary.errorRate > 0)) {
    lines.push("## Run Validity Warning");
    lines.push("");
    lines.push("One or more benchmarked requests failed. Treat latency values for failed requests as error-path timings, not successful application response times. Check the status/error columns below before comparing cached and uncached runs.");
    lines.push("");
  }

  for (const scenario of scenarios) {
    lines.push(`## ${scenario.name}`);
    lines.push("");
    lines.push(
      table(
        ["Endpoint", "Method", "Requests", "Errors", "Status/errors", "Avg", "p50", "p90", "p95", "p99", "Min", "Max", "RPS", "x-cache"],
        scenario.endpoints.map((item) => [
          item.endpoint.name,
          item.endpoint.method,
          item.summary.count,
          item.summary.errors,
          summarizeStatuses(item.samples),
          formatMs(item.summary.avg),
          formatMs(item.summary.p50),
          formatMs(item.summary.p90),
          formatMs(item.summary.p95),
          formatMs(item.summary.p99),
          formatMs(item.summary.min),
          formatMs(item.summary.max),
          item.summary.rps.toFixed(2),
          item.summary.cacheObserved
            ? `H:${item.summary.hitCount} M:${item.summary.missCount} B:${item.summary.bypassCount} E:${item.summary.cacheErrorCount}`
            : "not exposed",
        ])
      )
    );
    lines.push("");
  }

  lines.push("## Slowest Endpoints");
  lines.push("");
  lines.push(table(["Scenario", "Endpoint", "p95", "Avg", "Errors", "Status/errors"], slowest.map((row) => [row.scenario, row.endpoint, formatMs(row.p95), formatMs(row.avg), row.errors, row.statuses])));
  lines.push("");

  lines.push("## Fastest Endpoints");
  lines.push("");
  lines.push(table(["Scenario", "Endpoint", "p50", "Avg"], fastest.map((row) => [row.scenario, row.endpoint, formatMs(row.p50), formatMs(row.avg)])));
  lines.push("");

  lines.push("## Cache Visibility");
  lines.push("");
  if (poorCache.length > 0) {
    lines.push(table(["Scenario", "Endpoint", "Hits", "Misses", "Observed hit rate"], poorCache.map((row) => [row.scenario, row.endpoint, row.hitCount, row.missCount, formatPct(row.hitCount / Math.max(row.cacheObserved, 1))])));
  } else {
    lines.push("No `x-cache` header data was observed. Latency still compares cold, warm, repeated, and concurrent request behavior.");
  }
  lines.push("");

  lines.push("## Cached vs Uncached Comparison");
  lines.push("");
  lines.push("This report records the current run only. For an uncached comparison, run the app with `CACHE_ENABLED=false` and execute `npm run perf:test:uncached`; compare that report with a cached run from `npm run perf:test:cached`.");
  lines.push("");

  lines.push("## Recommended Next Optimizations");
  lines.push("");
  lines.push("- Add development-only `x-cache` and `x-response-time-ms` headers to the cached API route wrappers if you need exact hit-rate visibility.");
  lines.push("- Move client-direct Supabase reads behind API routes for consistent tenant scoping, timing, and cache observability.");
  lines.push("- Avoid benchmarking authenticated write endpoints outside local or staging seeded test data.");
  lines.push("- Use the slowest p95 rows above to decide the next Supabase query/index review.");
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const startedAt = new Date();
  const inspection = await inspectCodebase();
  const endpoints = safeEndpointList();
  const skipped = endpointCatalog
    .filter((endpoint) => !endpoints.some((item) => item.name === endpoint.name))
    .map((endpoint) => {
      let reason = "not selected";
      if (!hasRequiredVars(endpoint)) reason = "missing required PERF_* id/slug";
      if (endpoint.authRequired && !hasAuth()) reason = "missing PERF_COOKIE or PERF_BEARER_TOKEN";
      return { name: endpoint.name, reason };
    });

  const redisControl = await createRedisControl();
  const cacheClearResult = await clearBenchmarkCache(redisControl, endpoints);

  const scenarios = [];
  scenarios.push(await runScenario("Scenario A: Cold cache", endpoints, (endpoint) => runSerial(endpoint, 1)));

  for (const endpoint of endpoints) {
    await requestOnce(endpoint);
  }
  scenarios.push(await runScenario("Scenario B: Warm cache", endpoints, (endpoint) => runSerial(endpoint, warmIterations)));
  scenarios.push(await runScenario("Scenario B2: Repeated requests", endpoints, (endpoint) => runSerial(endpoint, repeatedIterations)));

  for (const level of concurrentLevels) {
    scenarios.push(await runScenario(`Scenario C: Concurrent ${level}`, endpoints, (endpoint) => runConcurrent(endpoint, level)));
  }

  await redisControl?.close?.();

  const finishedAt = new Date();
  const report = renderReport({
    inspection,
    endpoints,
    skipped,
    cacheClearResult,
    scenarios,
    startedAt,
    finishedAt,
  });

  await mkdir(path.dirname(path.resolve(ROOT, reportPath)), { recursive: true });
  await writeFile(path.resolve(ROOT, reportPath), report, "utf8");
  await writeFile(
    path.resolve(ROOT, jsonPath),
    JSON.stringify(
      {
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        baseUrl,
        mode,
        endpoints: endpoints.map((endpoint) => ({
          name: endpoint.name,
          method: endpoint.method,
          path: endpoint.resolvedPath,
          groups: endpoint.groups,
          cacheable: endpoint.cacheable,
        })),
        skipped,
        cacheClearResult,
        scenarios: scenarios.map((scenario) => ({
          name: scenario.name,
          summary: scenario.summary,
          endpoints: scenario.endpoints.map((item) => ({
            name: item.endpoint.name,
            method: item.endpoint.method,
            path: item.endpoint.resolvedPath,
            summary: item.summary,
            statuses: item.samples.reduce((acc, sample) => {
              const key = String(sample.status || sample.error || "unknown");
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            }, {}),
          })),
        })),
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Performance report written to ${reportPath}`);
  console.log(`Raw results written to ${jsonPath}`);
  console.log(`Benchmarked ${endpoints.length} endpoints across ${scenarios.length} scenarios.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
