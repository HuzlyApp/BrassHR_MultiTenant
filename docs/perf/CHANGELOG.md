# Performance changelog

Numbers are from `perf/results/baseline.json` unless a later phase replaces them.

## Phase 0 baseline (2026-10-01)

k6 recruiter session against local `next dev` (not Vercel), one iteration per VU. List APIs used the dev staff bypass and the large tenant. No production cookie was available.

`/api/workers` handler `timingMs`, page 1:

| VUs | p50 | p95 | p99 |
| --- | ---: | ---: | ---: |
| 1 | 2,187 ms | 2,187 ms | 2,187 ms |
| 10 | 3,075 ms | 3,615 ms | 3,774 ms |
| 50 | 17,177 ms | 67,373 ms | 67,710 ms |

Page 1 response body is about 26 KB. At 10 VUs, `/api/workers/metrics` timed out at 120 s (uncached fallback stampede). At 50 VUs the same route was a cache hit, p50 48 ms. During the 50 VU run Postgres had 4 active and 7 idle-in-transaction sessions, under `max_connections` 60. CPU was not available.

`/api/admin/jobs?fields=picker` returned 400 in this run because that route does not use `DEV_BENCHMARK_TENANT_ID`.

## Phase 1 client

Debounce (300 ms) and aborting a stale list request were already on `staging`. This phase stops a repeat fetch when the list key is unchanged, pauses header polling while the tab is hidden, and restores the list page from sessionStorage for the same user and tenant before revalidating. These do not change the k6 API timings above.
