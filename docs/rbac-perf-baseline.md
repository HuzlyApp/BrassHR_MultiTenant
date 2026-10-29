# Staff RBAC performance baseline

Measured before any Phase 1 change. No application code was modified for this baseline.

The click delay is not slow SQL. A normal staff page pays about eight **serial HTTPS calls** to Supabase, and for servers in Singapore each of those calls waits about **250 ms**. That is about **2.0 s of authorization** before the page can render. The same queries run in **0.05–0.12 ms** inside Postgres.

## How this was measured

| Source | Window | What it shows |
| --- | --- | --- |
| `pg_stat_statements` on Supabase project BrassHR (`us-east-1`) | 2026-10-28 15:34 UTC → 2026-10-29 18:49 UTC (27.25 h) | Call counts and **server execution** time. Does not include network. |
| Supabase edge logs (`response.origin_time`, `x-envoy-upstream-service-time`) | 2026-10-29 17:50–18:50 UTC | Time the Next.js server waits on Auth and PostgREST. |
| Code path in `proxy.ts`, `lib/auth/module-access.server.ts`, `lib/auth/api-session.ts` | Current tree | How many of those calls one navigation or API request makes, and which ones are serial. |

Not measured yet: browser TTFB, React Profiler, k6/autocannon, or a `Server-Timing` header. Those need a build that is not in production. The per-request figures below are the code’s serial hop count multiplied by the measured origin time. Postgres `EXPLAIN` planning time from a cold session (22 ms on `permission_resources`) is **not** the steady-state cost; `pg_stat_statements` mean time for that statement is 0.116 ms.

Supabase is in **us-east-1**. Nothing in the app pins a Vercel region (`preferredRegion` is unset), so a function near the user in Asia opens Supabase through the Singapore Cloudflare colo and waits on the US origin.

## Top three bottlenecks

### 1. Asia app servers pay ~250 ms on every Supabase call

`/auth/v1/user` in the last hour, by the Cloudflare colo that accepted the server’s connection:

| Colo | Country | Calls | Origin p50 | Origin p95 |
| --- | --- | ---: | ---: | ---: |
| IAD | US | 13,506 | 19 ms | 57 ms |
| SIN | SG | 6,433 | 252 ms | 280 ms |
| MNL | PH | 214 | 261 ms | 773 ms |
| CEB | PH | 96 | 239 ms | 5,910 ms |

About one third of Auth calls in that hour came from Singapore or the Philippines. The same split shows up on `/rest/v1/users` and `/rest/v1/tenants` (about 34% of calls land in the 200–500 ms bucket). User-Agent on those calls is `node`, so this is the Next.js server, not the browser.

Postgres itself is not in that wait. Envoy upstream time on the authz routes is **p50 2 ms, p95 about 14–27 ms**. Origin time from IAD is 19 ms. Origin time from SIN is a round trip to `us-east-1`.

### 2. Middleware runs the full grant pipeline on every staff page, with no cache

`authorizeStaffHttpAccess` always reads Postgres over HTTP. Grants are not in Redis or the in-process cache. Redis only stores `staff_user_profile` and `staff_scope` (60 s), and the middleware path does not use them.

For a signed-in, non-god staff user opening a module page (`/admin_recruiter/jobs`, `/admin_recruiter/applications`, and the other prefixed modules), `proxy.ts` does this in order:

| Step | Remote call | Parallel with the step above? |
| --- | --- | --- |
| 1 | `auth.getUser()` → `/auth/v1/user` | no |
| 2 | `fetchOwnerOnboardingStatus` → `users` (onboarding columns) | no |
| 3 | `users.god_admin` (skipped only when the JWT already says god admin) | no |
| 4 | `users` profile (`tenant_id, role, is_active`) | no |
| 5 | full `permission_resources` catalog (15 rows) | no |
| 6 | `tenants` by slug/subdomain (the onboarding slug cookie is set) | no |
| 7 | `staff_roles` + `tenant_roles` + `user_roles` | yes, one wait |
| 8 | `tenant_role_permissions` for that role and resource | no |

Dashboard and `/admin_recruiter/home` are `always_granted`, so they skip step 8 (7 waits). Shell APIs skip step 8 as well, but they still pay steps 1 and 3–7.

Estimated authorization time before the page renders:

| Where the function runs | Hops | p50 origin × hops | p95 origin × hops |
| --- | ---: | ---: | ---: |
| Singapore (this timezone) | 8 | **2,016 ms** | **2,240 ms** |
| US East (IAD) | 8 | **152 ms** | **456 ms** |

There is no warm path. The second click repeats every hop. Target was under 5 ms warm and under 30 ms cold, with zero authz queries on the warm path. Current warm and cold are the same.

`pg_stat_statements` shows the bundle firing together. Counts since the stats reset:

| Statement | Calls | Calls/hour | Mean SQL | Total SQL |
| --- | ---: | ---: | ---: | ---: |
| `permission_resources` catalog | 138,852 | 5,096 | 0.116 ms | 16.1 s |
| `tenants` by slug or subdomain | 138,897 | 5,098 | 0.054 ms | 7.6 s |
| `staff_roles` key, storage key, aliases | 138,867 | 5,097 | 0.053 ms | 7.3 s |
| `user_roles` role + `is_active` for user and tenant | 138,383 | 5,079 | 0.050 ms | 6.9 s |
| `tenant_roles` role keys for tenant | 138,381 | 5,079 | 0.045 ms | 6.2 s |
| `tenant_role_permissions` one grant | 120,778 | 4,433 | 0.058 ms | 7.1 s |
| `users` onboarding flags | 114,465 | 4,201 | 0.091 ms | 10.5 s |
| `auth.users` row read (the SQL behind `getUser`) | 148,662 | 5,456 | 0.063 ms | 9.3 s |

The grant read is about 87% of the catalog reads. The other 13% return earlier (shell route, dashboard `always_granted`, or a denial). Onboarding runs on pages and not on the API early-return, and it is about 82% of the catalog volume, so most of these evaluations are page navigations and prefetches, not API handlers.

Last-hour edge volume is higher than that average (catalog about 18.5k calls in one hour, Auth about 19.7k). SQL totals for the whole authz bundle over 27 hours are under a minute. The time staff feel is the network, multiplied by the hop count.

`EXPLAIN (ANALYZE, BUFFERS)` on the catalog: sequential scan, 15 rows, execution **0.180 ms**, shared buffers hit. Lookup tables already have the indexes the hot filters use:

- `user_roles` primary key `(user_id, tenant_id)`
- `tenant_roles` primary key `(tenant_id, role_key)`
- `tenant_role_permissions` primary key `(tenant_id, role_key, resource_key)`
- `permission_resources` primary key `(key)`
- `tenants` unique indexes on `slug` and `subdomain`

### 3. API handlers run that pipeline again, and `/api/admin/access` runs it a third time

Page middleware is the bulk of the catalog reads. API routes add a second full pass, and one shell route adds a third.

`/api/admin/*` in production:

1. Middleware: `getUser`, then `authorizeStaffHttpAccess`.
2. `requireStaffApiSession`: `getUser` again, then `resolveAppRoleForUser` (cached profile, then **two sequential** `user_roles` reads — one for the tenant, one for every membership), then `authorizeStaffHttpAccess` again when the path is `/api/admin`.

`GET /api/admin/access` then calls `loadSessionGrants`, which calls `authorizeStaffHttpAccess` a **third** time and reads the profile, tenant, role rows, and grant list again. The sidebar’s first load uses this route (`useStaffModuleAccess`, `staleTime` 60 s). After that, client navigation keeps the layout, so later clicks do not wait on it. A module page still fires its own API. Jobs, for example, fetches `/api/admin/jobs` with `cache: "no-store"` on mount.

From Singapore, one extra pass is on the order of **1.5–2.0 s** (the page chain without the onboarding read, plus another `getUser` and the two role reads). A list click is the page chain (~2.0 s to first byte) and then that API chain before rows appear. The handler role-only `user_roles` shape was called 12,772 times in the stats window (~6.4k handler resolutions, two queries each), which is much smaller than the 138k middleware bundle. It is real on every API, and it is not the majority of catalog traffic.

`x-brass-pathname` and `x-brass-method` are what the handler uses to repeat the check. Middleware overwrites those two on the forwarded request. The module decision is still computed from scratch in the handler.

## What this does to the targets

| Target | Baseline |
| --- | --- |
| Warm authz under 5 ms server time | Not met. No warm grant path. Singapore page authz is about **2.0 s**. US East is about **150 ms**. |
| Cold authz under 30 ms | Not met. Cold and warm are the same path. |
| Zero authz DB queries on a warm path | Not met. About **5,100 catalog reads per hour** on average, about **18,500** in the measured busy hour. |
| One authz evaluation per request | Not met for `/api/admin/*` (two). Not met for `/api/admin/access` (three). |
| Sidebar click p95 TTFB close to an unauthenticated route | Not measured in the browser. The server-side gap versus “no Supabase calls” is the hop total above. |

## Hypotheses

| # | Hypothesis | Result |
| --- | --- | --- |
| 1 | Fine-grained authz in middleware on every navigation, prefetch, and API | **Confirmed.** Matcher is an allowlist of staff, applicant, and auth routes. It does not include `_next/static`. It does include every `/admin_recruiter` and `/api/admin` request, and Next.js `Link` prefetches those pages by default (the sidebar does not set `prefetch={false}`). Prefetch share was not split out of the logs. |
| 2 | Module check runs twice | **Confirmed for APIs.** Pages pay it once, in middleware. `/api/admin/access` pays it three times. |
| 3 | Serial uncached grant queries | **Confirmed as hop count, rejected as SQL cost.** The three role reads are parallel. The other reads are serial. Mean SQL is under 0.12 ms. |
| 4 | `auth.getUser()` hits the Auth server instead of a local JWT check | **Confirmed.** Middleware and `getSessionUser` call `auth.getUser()`. Edge logs show `/auth/v1/user`. No `getClaims()` on this path. A sampled service-role token is HS256. |
| 5 | Matcher runs on static assets | **Rejected.** `proxy.ts` `config.matcher` is an allowlist. Static files are not in it. |
| 6 | Redis round trip per cached grant | **Rejected for grants.** Grants are not cached. Profile and scope use Redis with a 60 s TTL and a 3 s command timeout, only after the handler starts. That RTT was not measured. |
| 7 | Per-request Postgres connections, or app and database in different regions | **Region: confirmed. Connections: rejected.** `createServiceRoleClient()` is a new supabase-js client per call, and it talks HTTP to PostgREST, not a direct Postgres session. Envoy time stays ~2 ms, so the pool is not the p50. The region gap is the 252 ms vs 19 ms split. |
| 8 | RLS `auth.uid()` re-evaluated per row | **Not the navigation cost.** The authz reads use the service role and bypass RLS. The performance advisor still reports **47** `auth_rls_initplan` policies (including `users`, `tenants`, `job_applications`) and **115** multiple permissive policies. Those matter for user-scoped list queries, which are a different bill: top statements by total SQL time are logical replication decode (46.8% of `pg_stat_statements` time), match-analysis RPCs (mean 407 ms), and resume text reads (mean 945 ms). |
| 9 | Client waterfall on `/api/admin/access` before every click | **Partly rejected for repeat clicks.** The shell is a client layout. Access data is React Query with `staleTime` 60 s, so a later sidebar click does not wait on that fetch. The first load does, and each module page then starts its own `/api/admin/*` fetch. `AdminStaffAuthGuard` blocks the first paint on a browser `getSession()` (“Checking sign-in…”). It does not reset that gate on later pathname changes. |

## Advisors (performance), authz-relevant only

Fetched 2026-10-29. Full project counts: 245 unindexed foreign keys, 47 `auth_rls_initplan`, 115 multiple permissive policies, 288 unused indexes, 6 duplicate indexes, 1 `auth_db_connections_absolute`.

On the authz tables:

- `user_roles.tenant_id` and `tenant_role_permissions.resource_key` foreign keys have no standalone index. The hot filters are covered by the primary keys above.
- `users` has two identical `tenant_id` indexes (`idx_users_tenant`, `idx_users_tenant_id`) and multiple permissive `SELECT` policies (`tenant_isolation`, `users_read_own`), both flagged for per-row `auth.uid()`.
- `auth_db_connections_absolute` is open. It is not visible in the authz p50: upstream time stays a few milliseconds.

## Security properties observed (unchanged)

- Fail closed: a missing service-role client or any query error in `authorizeStaffHttpAccess` returns 403 `unavailable` or a denial. Unknown paths and unknown roles are denied.
- God admins return allow before the catalog read. `/api/admin/view-as-tenant` is classified god-only.
- Tenant id for the check comes from the JWT, the profile row, or an active `user_roles` membership. The slug is accepted only when it matches one of those.
- Disabled profiles are rejected in `authorizeStaffHttpAccess`. `requireStaffApiSession` also rejects anonymous sessions, non-staff, `must_change_password`, and `is_active = false`, using the 60 s profile cache.
- Revocation today is “next request”, because nothing is cached. That is the only property this design gets cheaply. A later cache has to keep it.

## What Phase 1 should attack first

Stop when a Singapore navigation’s authorization is one cached read (or none) instead of eight cross-region calls.

1. One decision per request, reused by the handler. Do not call `authorizeStaffHttpAccess` again from `requireStaffApiSession` or `loadSessionGrants`.
2. One compiled grant snapshot per tenant and role, in process, with a version check. The snapshot is 15 resources. Loading it per request over 250 ms links is the entire page delay.
3. Keep the Auth server call off the hot path once the snapshot work is in. From Singapore, `getUser` alone is 252 ms, which still misses a 30 ms cold target if it stays on every navigation.

Region pinning (run the app in `iad1` next to the database, or move the database) cuts the 252 ms to ~19 ms even before the cache. It does not remove the duplicate API evaluation, and 8 × 19 ms is still about 150 ms, above the 5 ms warm target. Cache and a single decision are what get to the target. Pinning is the fastest way to make current clicks feel shorter while that lands.

Phase 1 has not been implemented.
