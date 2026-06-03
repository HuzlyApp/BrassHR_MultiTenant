# Performance Benchmark Report

Generated: 2026-06-03T13:17:41.885Z
Started: 2026-06-03T13:17:41.276Z
Base URL: http://localhost:3000
Mode label: cached
Redis env visible to benchmark: not configured
Cache clear: not attempted
Read-only mode: true

## Codebase Inventory

Route handlers found: 72
Page routes found: 93
Benchmark endpoints runnable in this environment: 6
Catalog endpoints skipped: 10
Known mutation routes cataloged but not benchmarked by default: 10

| Group |Catalog endpoints |Runnable endpoints |
| --- |--- |--- |
| auth |2 |2 |
| authenticated-user |9 |0 |
| cacheable |11 |3 |
| detail |2 |0 |
| list |1 |0 |
| non-cacheable |3 |1 |
| page |3 |3 |
| public |7 |6 |
| reference |2 |2 |
| search |1 |0 |
| supabase-read |13 |3 |
| tenant-scoped |6 |1 |
| user-scoped |3 |0 |

## Skipped Endpoints

| Endpoint |Reason |
| --- |--- |
| Published onboarding config |missing required PERF_* id/slug |
| Applicant worker documents status |missing required PERF_* id/slug |
| Applicant worker requirements status |missing required PERF_* id/slug |
| Admin header data |missing PERF_COOKIE or PERF_BEARER_TOKEN |
| Admin tenant list |missing PERF_COOKIE or PERF_BEARER_TOKEN |
| Admin effective branding |missing PERF_COOKIE or PERF_BEARER_TOKEN |
| Workers head count |missing PERF_COOKIE or PERF_BEARER_TOKEN |
| Worker search |missing PERF_COOKIE or PERF_BEARER_TOKEN |
| Recruiter candidate bundle |missing PERF_COOKIE or PERF_BEARER_TOKEN |
| Admin worker profile |missing PERF_COOKIE or PERF_BEARER_TOKEN |

## Scenario Summary

| Scenario |Requests |Errors |Error rate |Avg |p50 |p90 |p95 |p99 |RPS |Cache hits |Cache misses |
| --- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |
| Scenario A: Cold cache |6 |6 |100.00% |12.4 ms |1.9 ms |65.8 ms |65.8 ms |65.8 ms |80.43 |0 |0 |
| Scenario B: Warm cache |30 |30 |100.00% |1.1 ms |1.0 ms |1.4 ms |1.7 ms |1.7 ms |896.35 |0 |0 |
| Scenario B2: Repeated requests |60 |60 |100.00% |1.3 ms |1.2 ms |1.8 ms |1.9 ms |2.9 ms |769.65 |0 |0 |
| Scenario C: Concurrent 10 |60 |60 |100.00% |5.4 ms |5.5 ms |6.0 ms |6.0 ms |6.2 ms |185.56 |0 |0 |
| Scenario C: Concurrent 25 |150 |150 |100.00% |12.7 ms |12.8 ms |13.9 ms |14.0 ms |14.1 ms |78.49 |0 |0 |
| Scenario C: Concurrent 50 |300 |300 |100.00% |25.3 ms |25.1 ms |28.8 ms |29.0 ms |29.2 ms |39.57 |0 |0 |

## Run Validity Warning

One or more benchmarked requests failed. Treat latency values for failed requests as error-path timings, not successful application response times. Check the status/error columns below before comparing cached and uncached runs.

## Scenario A: Cold cache

| Endpoint |Method |Requests |Errors |Status/errors |Avg |p50 |p90 |p95 |p99 |Min |Max |RPS |x-cache |
| --- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |
| Homepage |GET |1 |1 |fetch failed:1 |65.8 ms |65.8 ms |65.8 ms |65.8 ms |65.8 ms |65.8 ms |65.8 ms |15.19 |not exposed |
| Login page |GET |1 |1 |fetch failed:1 |2.1 ms |2.1 ms |2.1 ms |2.1 ms |2.1 ms |2.1 ms |2.1 ms |474.43 |not exposed |
| Signup page |GET |1 |1 |fetch failed:1 |1.5 ms |1.5 ms |1.5 ms |1.5 ms |1.5 ms |1.5 ms |1.5 ms |648.51 |not exposed |
| Tenant branding |GET |1 |1 |fetch failed:1 |1.9 ms |1.9 ms |1.9 ms |1.9 ms |1.9 ms |1.9 ms |1.9 ms |536.80 |not exposed |
| Skill categories |GET |1 |1 |fetch failed:1 |1.9 ms |1.9 ms |1.9 ms |1.9 ms |1.9 ms |1.9 ms |1.9 ms |536.80 |not exposed |
| Skill questions |GET |1 |1 |fetch failed:1 |1.4 ms |1.4 ms |1.4 ms |1.4 ms |1.4 ms |1.4 ms |1.4 ms |721.55 |not exposed |

## Scenario B: Warm cache

| Endpoint |Method |Requests |Errors |Status/errors |Avg |p50 |p90 |p95 |p99 |Min |Max |RPS |x-cache |
| --- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |
| Homepage |GET |5 |5 |fetch failed:5 |1.1 ms |1.1 ms |1.3 ms |1.3 ms |1.3 ms |1.0 ms |1.3 ms |906.96 |not exposed |
| Login page |GET |5 |5 |fetch failed:5 |1.3 ms |1.2 ms |1.7 ms |1.7 ms |1.7 ms |1.1 ms |1.7 ms |753.74 |not exposed |
| Signup page |GET |5 |5 |fetch failed:5 |1.0 ms |0.9 ms |1.0 ms |1.0 ms |1.0 ms |0.8 ms |1.0 ms |1052.32 |not exposed |
| Tenant branding |GET |5 |5 |fetch failed:5 |0.9 ms |0.9 ms |1.1 ms |1.1 ms |1.1 ms |0.8 ms |1.1 ms |1072.04 |not exposed |
| Skill categories |GET |5 |5 |fetch failed:5 |1.3 ms |1.2 ms |1.7 ms |1.7 ms |1.7 ms |1.0 ms |1.7 ms |763.74 |not exposed |
| Skill questions |GET |5 |5 |fetch failed:5 |1.1 ms |1.0 ms |1.3 ms |1.3 ms |1.3 ms |0.9 ms |1.3 ms |932.73 |not exposed |

## Scenario B2: Repeated requests

| Endpoint |Method |Requests |Errors |Status/errors |Avg |p50 |p90 |p95 |p99 |Min |Max |RPS |x-cache |
| --- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |
| Homepage |GET |10 |10 |fetch failed:10 |1.4 ms |1.3 ms |1.8 ms |1.9 ms |1.9 ms |1.0 ms |1.9 ms |733.47 |not exposed |
| Login page |GET |10 |10 |fetch failed:10 |1.3 ms |1.2 ms |1.4 ms |1.7 ms |1.7 ms |0.9 ms |1.7 ms |790.93 |not exposed |
| Signup page |GET |10 |10 |fetch failed:10 |1.5 ms |1.1 ms |2.3 ms |2.9 ms |2.9 ms |1.0 ms |2.9 ms |647.19 |not exposed |
| Tenant branding |GET |10 |10 |fetch failed:10 |1.2 ms |1.2 ms |1.4 ms |1.5 ms |1.5 ms |1.0 ms |1.5 ms |830.96 |not exposed |
| Skill categories |GET |10 |10 |fetch failed:10 |1.2 ms |1.1 ms |1.9 ms |1.9 ms |1.9 ms |0.9 ms |1.9 ms |808.43 |not exposed |
| Skill questions |GET |10 |10 |fetch failed:10 |1.2 ms |1.0 ms |1.5 ms |1.5 ms |1.5 ms |1.0 ms |1.5 ms |845.67 |not exposed |

## Scenario C: Concurrent 10

| Endpoint |Method |Requests |Errors |Status/errors |Avg |p50 |p90 |p95 |p99 |Min |Max |RPS |x-cache |
| --- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |
| Homepage |GET |10 |10 |fetch failed:10 |6.0 ms |5.9 ms |6.1 ms |6.2 ms |6.2 ms |5.9 ms |6.2 ms |167.20 |not exposed |
| Login page |GET |10 |10 |fetch failed:10 |5.9 ms |5.9 ms |6.0 ms |6.0 ms |6.0 ms |5.7 ms |6.0 ms |169.84 |not exposed |
| Signup page |GET |10 |10 |fetch failed:10 |5.5 ms |5.5 ms |5.5 ms |5.5 ms |5.5 ms |5.3 ms |5.5 ms |183.25 |not exposed |
| Tenant branding |GET |10 |10 |fetch failed:10 |5.0 ms |4.9 ms |5.1 ms |5.4 ms |5.4 ms |4.7 ms |5.4 ms |201.55 |not exposed |
| Skill categories |GET |10 |10 |fetch failed:10 |5.6 ms |5.7 ms |5.7 ms |5.8 ms |5.8 ms |5.4 ms |5.8 ms |177.33 |not exposed |
| Skill questions |GET |10 |10 |fetch failed:10 |4.4 ms |4.4 ms |4.5 ms |4.6 ms |4.6 ms |4.2 ms |4.6 ms |226.88 |not exposed |

## Scenario C: Concurrent 25

| Endpoint |Method |Requests |Errors |Status/errors |Avg |p50 |p90 |p95 |p99 |Min |Max |RPS |x-cache |
| --- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |
| Homepage |GET |25 |25 |fetch failed:25 |12.9 ms |13.1 ms |13.4 ms |13.5 ms |13.6 ms |12.1 ms |13.6 ms |77.47 |not exposed |
| Login page |GET |25 |25 |fetch failed:25 |12.7 ms |12.9 ms |13.4 ms |13.4 ms |13.5 ms |11.6 ms |13.5 ms |78.77 |not exposed |
| Signup page |GET |25 |25 |fetch failed:25 |12.3 ms |12.3 ms |12.9 ms |13.0 ms |13.2 ms |11.6 ms |13.2 ms |81.06 |not exposed |
| Tenant branding |GET |25 |25 |fetch failed:25 |13.5 ms |13.5 ms |14.1 ms |14.1 ms |14.2 ms |12.5 ms |14.2 ms |74.06 |not exposed |
| Skill categories |GET |25 |25 |fetch failed:25 |13.6 ms |13.9 ms |14.0 ms |14.1 ms |14.1 ms |11.8 ms |14.1 ms |73.70 |not exposed |
| Skill questions |GET |25 |25 |fetch failed:25 |11.4 ms |11.3 ms |12.4 ms |12.5 ms |12.7 ms |10.7 ms |12.7 ms |87.50 |not exposed |

## Scenario C: Concurrent 50

| Endpoint |Method |Requests |Errors |Status/errors |Avg |p50 |p90 |p95 |p99 |Min |Max |RPS |x-cache |
| --- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |--- |
| Homepage |GET |50 |50 |fetch failed:50 |28.1 ms |27.8 ms |28.8 ms |29.2 ms |29.3 ms |27.4 ms |29.3 ms |35.62 |not exposed |
| Login page |GET |50 |50 |fetch failed:50 |23.4 ms |23.0 ms |24.5 ms |24.9 ms |25.3 ms |22.8 ms |25.3 ms |42.82 |not exposed |
| Signup page |GET |50 |50 |fetch failed:50 |24.6 ms |23.6 ms |26.2 ms |26.3 ms |26.4 ms |23.2 ms |26.4 ms |40.71 |not exposed |
| Tenant branding |GET |50 |50 |fetch failed:50 |28.6 ms |28.7 ms |29.2 ms |29.2 ms |29.2 ms |27.3 ms |29.2 ms |34.97 |not exposed |
| Skill categories |GET |50 |50 |fetch failed:50 |22.0 ms |21.7 ms |23.1 ms |23.3 ms |23.6 ms |21.1 ms |23.6 ms |45.50 |not exposed |
| Skill questions |GET |50 |50 |fetch failed:50 |25.1 ms |25.1 ms |25.3 ms |25.5 ms |25.9 ms |24.5 ms |25.9 ms |39.88 |not exposed |

## Slowest Endpoints

| Scenario |Endpoint |p95 |Avg |Errors |Status/errors |
| --- |--- |--- |--- |--- |--- |
| Scenario A: Cold cache |Homepage |65.8 ms |65.8 ms |1 |fetch failed:1 |
| Scenario C: Concurrent 50 |Tenant branding |29.2 ms |28.6 ms |50 |fetch failed:50 |
| Scenario C: Concurrent 50 |Homepage |29.2 ms |28.1 ms |50 |fetch failed:50 |
| Scenario C: Concurrent 50 |Signup page |26.3 ms |24.6 ms |50 |fetch failed:50 |
| Scenario C: Concurrent 50 |Skill questions |25.5 ms |25.1 ms |50 |fetch failed:50 |
| Scenario C: Concurrent 50 |Login page |24.9 ms |23.4 ms |50 |fetch failed:50 |
| Scenario C: Concurrent 50 |Skill categories |23.3 ms |22.0 ms |50 |fetch failed:50 |
| Scenario C: Concurrent 25 |Tenant branding |14.1 ms |13.5 ms |25 |fetch failed:25 |
| Scenario C: Concurrent 25 |Skill categories |14.1 ms |13.6 ms |25 |fetch failed:25 |
| Scenario C: Concurrent 25 |Homepage |13.5 ms |12.9 ms |25 |fetch failed:25 |

## Fastest Endpoints

| Scenario |Endpoint |p50 |Avg |
| --- |--- |--- |--- |
| Scenario B: Warm cache |Tenant branding |0.9 ms |0.9 ms |
| Scenario B: Warm cache |Signup page |0.9 ms |1.0 ms |
| Scenario B: Warm cache |Skill questions |1.0 ms |1.1 ms |
| Scenario B2: Repeated requests |Skill questions |1.0 ms |1.2 ms |
| Scenario B: Warm cache |Homepage |1.1 ms |1.1 ms |
| Scenario B2: Repeated requests |Skill categories |1.1 ms |1.2 ms |
| Scenario B2: Repeated requests |Signup page |1.1 ms |1.5 ms |
| Scenario B2: Repeated requests |Tenant branding |1.2 ms |1.2 ms |
| Scenario B: Warm cache |Login page |1.2 ms |1.3 ms |
| Scenario B: Warm cache |Skill categories |1.2 ms |1.3 ms |

## Cache Visibility

No `x-cache` header data was observed. Latency still compares cold, warm, repeated, and concurrent request behavior.

## Cached vs Uncached Comparison

This report records the current run only. For an uncached comparison, run the app with `CACHE_ENABLED=false` and execute `npm run perf:test:uncached`; compare that report with a cached run from `npm run perf:test:cached`.

## Recommended Next Optimizations

- Add development-only `x-cache` and `x-response-time-ms` headers to the cached API route wrappers if you need exact hit-rate visibility.
- Move client-direct Supabase reads behind API routes for consistent tenant scoping, timing, and cache observability.
- Avoid benchmarking authenticated write endpoints outside local or staging seeded test data.
- Use the slowest p95 rows above to decide the next Supabase query/index review.
