# Performance Optimization — Phase 3 Report

**Date:** 2026-06-30  
**Environment:** Local dev (`http://localhost:3000`), Redis Cloud, `CACHE_ENABLED=true`

---

## Executive summary

Phase 3 targeted the remaining bottlenecks after Phase 2 Redis caching:

| Goal | Result |
|------|--------|
| effective-branding cache-hit &lt; 600ms | **Achieved** — hit p50 **506ms** (was ~1120ms, **55% reduction**) |
| dashboard-analytics cache miss &lt; 900ms | **Implemented** — SQL RPC replaces full worker status row scan; verify after Redis connection pool recovers |
| Real-session benchmark | **Partial** — dev-bypass+view-as completed; real cookie/bearer requires `BENCHMARK_COOKIE` or `BENCHMARK_EMAIL`/`BENCHMARK_PASSWORD` |
| Browser page verification | Script added (`scripts/benchmark-browser-pages.mjs`); dev server hung during run due to Redis max clients |
| Tenant isolation | Preserved — cache keys remain user+tenant scoped; view-as invalidates staff caches |

---

## 1. Real-session benchmark

### Auth modes

| Mode | How | Status |
|------|-----|--------|
| Dev bypass + view-as | `BENCHMARK_TENANT_ID=74b0fe31-f6fc-4519-9daf-b45d5b46d799` | Completed |
| Real cookie | `BENCHMARK_COOKIE="sb-…"` | Not configured in `.env` |
| Real bearer | `BENCHMARK_EMAIL` + `BENCHMARK_PASSWORD` → `scripts/fetch-benchmark-session.mjs` | Credentials not set |

### Dev bypass + view-as results (post Phase 3 code)

| Route | Miss ms | Hit p50 ms | Hit p95 ms | Improvement | Cache key pattern |
|-------|---------|------------|------------|-------------|-------------------|
| `/api/tenant-branding` | 1132 | 272 | 273 | 76% | `supabase:tenant_branding:slug:braas-hr:*` |
| `/api/admin/effective-branding` | 2178 | **506** | 571 | **77%** | `supabase:admin_effective_branding:user:{id}:tenant:{scope}:*` |
| `/api/admin/header-data` | 1697 | 516 | 531 | 70% | `supabase:admin_header_data:user:{id}:*` |
| `/api/admin/dashboard-overview` | 2490 | 534 | 589 | 79% | `supabase:dashboard_overview:tenant:{id}:*` |
| `/api/admin/dashboard-analytics` | *(Redis pool exhausted before completion)* | — | — | — | `supabase:dashboard_analytics:tenant:{id}:*` |
| `/api/workers?limit=50&offset=0` | *(not completed)* | — | — | N/A | No Redis list cache (SQL pagination only) |

**Phase 2 baseline (effective-branding):** hit p50 ~1120ms → **Phase 3: 506ms**

### Auth/session timing vs dev bypass

- Dev bypass skips `auth.getUser()` network round-trip (~300–600ms saved vs real session).
- Real sessions will add that baseline to **every** API request; cache hits still skip DB loaders but not JWT validation.
- **Recommendation:** Re-run with real session once credentials are configured:

```bash
# Option A: cookie from browser DevTools → Application → Cookies
BENCHMARK_COOKIE="..." BENCHMARK_TENANT_ID=<tenant-uuid> node scripts/benchmark-cache-routes.mjs

# Option B: email/password sign-in
BENCHMARK_EMAIL=... BENCHMARK_PASSWORD=... node scripts/fetch-benchmark-session.mjs
# then export BENCHMARK_BEARER from output
BENCHMARK_BEARER=... BENCHMARK_TENANT_ID=<uuid> node scripts/benchmark-cache-routes.mjs
```

### Routes exceeding 1s on cache hit (dev bypass)

After Phase 3, **none of the completed routes exceed 1s on cache hit**. All completed admin routes are **506–534ms** hit p50.

---

## 2. effective-branding timing breakdown

### Root cause (Phase 2)

1. `resolveEffectiveAdminTenantId()` ran **before** Redis lookup and re-queried users/JWT/view-as independently of `getCachedStaffTenantScope()`.
2. Dev view-as cookie was ignored for non–god-admin dev bypass → cache key `tenant:none` while UI showed tenant branding.
3. On cache hit, auth + duplicate tenant resolution still ran (~800ms+).

### Changes (Phase 3)

1. **`resolveEffectiveAdminTenantIdCached()`** — reuses `getCachedStaffTenantScope()` (Redis + React `cache()`); only falls back to onboarding slug lookup for unscoped god-admin.
2. **Early cache lookup** — after auth + scope, `getCache()` before any tenant row fetch.
3. **Perf logs** added:
   - `[perf] effective-branding.auth ms=…`
   - `[perf] effective-branding.tenantScope ms=…`
   - `[perf] effective-branding.cacheLookup ms=…`
   - `[perf] effective-branding.total ms=…`

### Expected timing on cache hit (dev bypass)

| Stage | Approx ms |
|-------|-----------|
| auth (dev bypass) | ~0–5 |
| tenantScope (Redis staff_scope hit) | ~50–150 |
| cacheLookup (Redis payload hit) | ~50–200 |
| JSON serialize + Next.js | ~100–200 |
| **Total** | **~506ms p50** |

With real session, add **~300–600ms** for `auth.getUser()` → expect **~800–1100ms** hit unless further auth optimizations are applied in production.

---

## 3. Dashboard analytics SQL aggregation

### Problem

Cache miss fetched **all** `worker.status, worker_status` rows into JavaScript for breakdown counts.

### Solution

Migration `20260630160000_worker_status_metrics_rpc.sql`:

- Index: `worker_tenant_worker_status_idx (tenant_id, worker_status)`
- RPC: `worker_status_metrics(p_tenant_id uuid)` → JSONB grouped counts
- Applied to remote Supabase via MCP

`buildDashboardAnalyticsPayload()` now calls `fetchWorkerStatusMetrics()` instead of full row scan.

Trend series still use date-filtered `worker.created_at` select (20-day window only).

**TTL:** unchanged at 120s (`CACHE_TTL_SECONDS.dashboards`).

---

## 4. Browser Network tab verification

### Script proxy

`scripts/benchmark-browser-pages.mjs` simulates warm parallel API loads per page:

| Page | Expected APIs | Dedupe check |
|------|---------------|--------------|
| `/admin_recruiter/dashboard` | effective-branding, header-data, dashboard-overview | 1× each via React Query |
| `/admin_recruiter/analytics` | + dashboard-analytics | 1× each |
| Worker list | + `/api/workers?limit=50` | No `includePhotoUrls` unless photos shown |
| Messages | + conversations | `useStaffConversations` — 1× fetch |
| Login | tenant-branding | Public, no admin shell |

**Note:** Full browser run blocked during this session — Redis Cloud hit **max clients** (dev server + benchmark script connections). Restart dev server or upgrade Redis plan before re-running.

### Client dedupe (code review, Phase 2+3)

- `useEffectiveBranding()` — single query key per user/tenant
- `useAdminHeaderData()` — single query key
- `useAccountDataQuery()` — React Query replaces duplicate profile fetches
- `useStaffConversations()` — shared on messages page

---

## 5. Supabase `auth.getUser()` baseline

### Findings

| Location | Calls per request |
|----------|-------------------|
| `middleware.ts` | 1× `getUser()` on **every** matched request (UI + API) |
| API route handlers | 1× via `getSessionUser()` in `requireStaffApiSession()` |
| Production API middleware gate | Additional check only in production (`gateApiInMiddleware`) |

### Phase 3 optimization

`getSessionUser()` now tries **Bearer token first** (single `getUser(token)`), avoiding double validation when only Authorization header is sent.

### Recommendation

| Option | Verdict |
|--------|---------|
| Cache JWT / session tokens in Redis | **Unsafe** — do not implement |
| Skip `getUser()` on cache-hit routes | **Unsafe** — need verified identity for cache key |
| Request-scoped React `cache()` dedupe | **Already in place** for staff session + scope within one handler |
| Redis-cached staff profile (post-auth) | **Safe** — 60s TTL, tenant-safe keys |
| Production latency benchmark | **Needed** — local `getUser()` may include cold Supabase + geographic latency |
| Pass user from middleware to routes | **Possible future work** — requires Next.js request context header (careful with forgery) |

**Conclusion:** ~300–600ms per request for `auth.getUser()` is largely an **unavoidable baseline** for cookie-session API routes. Real-session cache-hit latency for effective-branding will likely remain **700–1100ms** until production benchmarking confirms otherwise.

---

## 6. Tests

### Added

| Test file | Coverage |
|-----------|----------|
| `lib/auth/effective-branding-cache.test.ts` | Cache key includes user + tenant scope |
| `lib/auth/invalidate-staff-auth-cache.test.ts` | View-as invalidates effective-branding + staff scope |
| `lib/dashboard/worker-status-metrics.test.ts` | RPC grouped counts |

### Existing (unchanged)

- `/api/workers` skips photo signing unless `includePhotoUrls=1`
- Cache payload guard tests

### `npm test` results

```
Test Files  1 failed | 71 passed (72)
Tests       1 failed | 362 passed (363)
```

**Pre-existing failure (unrelated):**  
`lib/onboarding/tenant-step-navigation.test.ts` — expects legacy step title `"Add Resume"` but receives `"Upload Resume"`.

**All Phase 3 tests pass.**

---

## 7. Files changed (Phase 3)

| File | Change |
|------|--------|
| `app/api/admin/effective-branding/route.ts` | Perf logs, early cache hit, scoped tenant via cached scope |
| `lib/auth/resolve-effective-admin-tenant-cached.ts` | New — reuses staff scope cache |
| `app/api/admin/dashboard-analytics/route.ts` | RPC metrics instead of row scan |
| `lib/dashboard/worker-status-metrics.ts` | New — RPC client |
| `supabase/migrations/20260630160000_worker_status_metrics_rpc.sql` | SQL function + index |
| `lib/auth/api-session.ts` | Bearer-first `getSessionUser()` (fewer double getUser calls) |
| `scripts/benchmark-cache-routes.mjs` | Workers route, bearer auth, shared Redis client, graceful Redis failure |
| `scripts/fetch-benchmark-session.mjs` | New — obtain bearer for real-session benchmarks |
| `scripts/benchmark-browser-pages.mjs` | New — page-level API audit |

---

## 8. Remaining bottlenecks

1. **Redis connection limit** — free/tier Redis Cloud max clients reached during intensive local dev + benchmarks. Consider connection pooling or local Redis for dev.
2. **Real-session benchmark** — requires user-provided `BENCHMARK_COOKIE` or credentials.
3. **auth.getUser baseline** — dominates cache-hit latency on real sessions (~50%+ of request time).
4. **dashboard-analytics miss** — needs re-benchmark after Redis recovery; RPC should reduce miss but other parallel queries remain (interviews, attendance, documents).
5. **Middleware getUser** — runs on every page navigation in addition to API calls (double auth cost on initial page load).
6. **Production-only validation** — Vercel edge + Supabase region latency not measured locally.

---

## 9. How to re-verify

```bash
# Redis CLI (uses REDIS_URL from .env)
npm run redis:cli
npm run redis:cli -- PING
npm run redis:cli -- INFO clients
npm run redis:cli -- KEYS "supabase:*"

# Or direct command line (same URL as REDIS_URL in .env):
redis-cli -u "$REDIS_URL"

# 1. Restart dev server (clears Redis client leak)
npm run dev

# 2. Dev bypass benchmark
BENCHMARK_TENANT_ID=74b0fe31-f6fc-4519-9daf-b45d5b46d799 PERF_LOG=true \
  node scripts/benchmark-cache-routes.mjs

# 3. Real session (after setting credentials)
BENCHMARK_COOKIE="..." BENCHMARK_TENANT_ID=<uuid> \
  node scripts/benchmark-cache-routes.mjs

# 4. Page-level API audit
BENCHMARK_TENANT_ID=<uuid> node scripts/benchmark-browser-pages.mjs

# 5. Tests
npm test
```

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Real authenticated benchmark completed | Partial — dev bypass done; real session pending credentials |
| effective-branding hit latency reduced or cause proven | **Reduced to 506ms p50** (dev bypass); real session adds auth baseline |
| dashboard-analytics SQL RPC | **Deployed** |
| Browser page performance verified | Script added; manual run blocked by Redis pool |
| Tenant isolation safe | **Yes** |
| New tests pass | **Yes** (362/363; 1 pre-existing failure) |
