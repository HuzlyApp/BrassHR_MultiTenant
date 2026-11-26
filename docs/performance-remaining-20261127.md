# Performance follow-up - 27 November 2026

Source: BrassHR Performance tab, QA rounds 3 and 4: 415 measurements, including 127 historical red measurements. These are measurements rather than 127 distinct unresolved bugs. Historical measurements remain intact. This batch addresses database round trips in four shared paths; it does not certify every red row as fixed.

## Implemented

- Applicant lists: worker fallback counts, latest status notes, recruiter details and requirement summaries now load concurrently after the page is hydrated. Existing chunk sizes, ordering, latest-note selection, error propagation and tenant filters remain.
- Status catalogs: existing catalogs are returned directly without a preliminary count/seed request. Empty tenants still initialize; inactive-only catalogs do not recreate deleted statuses. The route reads groups concurrently and reloads them if first-time initialization created new groups.
- Schedule week: worker and shift queries start together. Date, facility and tenant filters and dependent enrichment remain unchanged.
- Workflow create/copy/save/publish: step IDs are assigned before the bulk insert, including parent links. Removed the sequential parent UPDATE for each linked step. A graph with N linked steps now needs two step-write requests (delete plus insert), instead of two plus N. The existing delete/insert operation is still not transactional across requests.

## Verification

- Deterministic regressions check overlapping reads, one-read existing status catalogs, tenant filters, bootstrap groups, newest notes, counts, branching parent links, empty workflows and failed writes.
- Supabase MCP project qowirmiicsrglehiaoil: inspected step constraints and confirmed no non-internal step triggers. A tenant-scoped rollback-only test inserted three synthetic steps with two parent links successfully; no test rows were retained. No schema migration or lasting customer-data changes.
- Full regression run: 3,594 passed, one PDF extraction test failed with STACK_TRACE_ERROR, 23 skipped. The PDF test passed on isolated rerun (both PDF checks passed); the workflow batch tests passed there too. This is not reported as an initially green full-suite run.
- Final focused changed-area run: 98 passed, zero failures or skips.
- TypeScript passed. Scoped ESLint had no errors; pre-existing unused-variable warnings remain in the status service.
- Full Next.js 16.4.6 production build passed, including TypeScript, all 394 prerendered pages and build traces. Final changed-file ESLint passed without errors or warnings; the unchanged sections of the status service retain six existing unused-variable warnings.

## Tracker and limits

Updated F/H only for Performance rows 50, 61, 74, 82, 118, 137, 157, 250, 251, 256, 270, 272, 404 and 416. Attribution is Optimized by Carl - retest pending. Original seconds, dates, QA remarks and conditional formatting were preserved and read back. Related IDs include BUG-086, BUG-264, BUG-279, BUG-313 and BUG-340; associated functional defects are not automatically closed.

Other red measurements remain open for investigation or signed-in same-action retiming, including resume parsing, job-save/location failures, onboarding step transitions, profile reads, authentication and provider-dependent actions. The user selected code and automated QA; no authenticated live performance timings were captured. Earlier successful green retests were not overwritten. The upstream Firma builder fix was preserved.

Branch: heneralpepito/performance-remaining-20261127. Author and committer: HENERALPEPITO <clelipan@up.edu.ph>.
