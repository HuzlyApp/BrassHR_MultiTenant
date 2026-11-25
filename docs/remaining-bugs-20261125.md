# Remaining bug review — 2026-11-25

Tracker: https://docs.google.com/spreadsheets/d/1nEj2t_e_IApcvw0q7_SKGUs2Xl_kNi8GveVrBU4_qq8/edit

Branch: `heneralpepito/remaining-16-bugs-20261125`, pulled from staging `8aecd813` before editing. Unrelated workflow documentation, handoff files, and local test/build outputs were excluded from the commit.

## Tracker outcome

Reviewed all 16 outstanding rows and their QA remarks. Six implementation fixes are included: BUG-093, 098, 102, 132, 193, and 197. Five earlier issues are reconciled against existing QA remarks: BUG-046, 095, 103, 106, and 192. Five remain unresolved: BUG-023, 063, 086, 108, and 109.

Bug Log K:L and 14 linked coverage notes were updated. QA status/date/remarks in M:O and historical coverage results were preserved. No automated result was substituted for a signed-in QA pass.

## Implementation

- BUG-093: every successful job save/publish gets a notification, including saves without reassignment/reanalysis. The request has a 20-second deadline. A timeout tells the user to inspect Jobs before retrying because the server may already have saved the request.
- BUG-098: the shared candidate header falls back to the applied job requisition identifier when an external ID is absent. Regression coverage protects dedicated allied-health/address/summary field mapping. A read-only audit of 45 Zippy candidates found zero allied-health values copied from summary/address. The obsolete practice-setting location row is already absent from current UI; no clinical/profession values were guessed.
- BUG-102: closed, rejected, disapproved, archived, and withdrawn candidates see a clean closed-application panel, a return link, and no approval actions.
- BUG-193: PDF resumes render into a paginated canvas through the installed PDF.js library and its official Webpack entry, removing dependence on the browser's native PDF plugin. Download/open fallback remains. DOCX keeps the existing HTML preview.
- BUG-197: the Resume header uses a compact authenticated, tenant-scoped projection with applied-job context instead of loading full onboarding and document scans. The Resume body uses the existing compact metadata view. Unavailable header progress is no longer displayed as a fabricated 0%.
- BUG-086 partial improvement: Launch Pad progress/interests requests have a 15-second bound and retain existing retry/error handling. Overall page latency remains unverified without signed-in timing.

## Worker activation — BUG-132

Applied only to Supabase project **qowirmiicsrglehiaoil**:

- `20261124194432_guard_employment_worker_activation.sql`
- `20261124195113_reconcile_worker_activation_on_workflow_changes.sql`
- `20261124201120_require_assigned_workflow_for_worker_provisioning.sql`

Incomplete conversions remain `new`, which the existing UI labels **Onboarding**. Active requires a hired application in the same tenant/candidate, an assigned matching W2/1099 workflow, both lifecycle phases, and completion of every required assigned step. Updates cannot directly bypass the gate. Completion activates an Onboarding record; reopening required steps or changing the assigned workflow reconciles Active back to Onboarding. Manual Inactive/Terminated states are preserved. Functions use security invoker, fixed search paths, and restricted execution grants; no RLS bypass was introduced.

New employment records without an assigned matching W2/1099 workflow are rejected, including inserts that request a non-Active status. The assigned instance must belong to the same application. The conversion service returns an actionable 409 ONBOARDING_REQUIRED response for this case rather than attempting an alternate insertion path.

Live assertions inside a rolled-back transaction passed: missing-workflow insertion is rejected; assigned but incomplete insertion stays Onboarding; direct activation is rejected; wrong-tenant and wrong-classification checks fail; completed W2 and matching 1099 qualify; reopened Post-Hire requirement removes Active; re-completion restores it; manual Inactive remains Inactive.

After that verification, eight unsupported Active Zippy employment records were corrected to Onboarding, with one `worker.onboarding.activation_reconciled` audit entry each. Employment records and their history were retained. The other tenant's 11 Active records were not changed by the historical repair; future writes use the new guard.

Security/performance advisor counts remained 175/6, with no new findings. Existing findings remain, including an RLS-disabled-public-table issue; [Supabase's remediation guidance](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public) applies separately.

## Verification

- Production Webpack compilation completed, including the PDF worker bundle. The initial bare worker URL packaging error was corrected by using PDF.js's official Webpack entry.
- Full Vitest run: 3,385 passed, one policy-audit timeout, 22 skipped (3,408 total). A later isolated policy-audit/Launch Pad run passed all 19 tests. The audit assertion was not weakened or removed.
- Final focused profile/header/PDF/closed-approval checks: 19 passed across five files. The subsequent PDF worker-import adjustment passed its three PDF tests.
- Changed-file lint initially passed with zero errors and two warnings; final checks are recorded locally under output/qa.
- The source TypeScript check passed using the repository's normal exclusions plus generated/output directories excluded in a temporary configuration. The default check after production compilation exposes existing generated route-export/type errors in untouched templates, Launch Pad domain, scheduling, applicant-about-me, workflow, and worker-signin routes. The root tsconfig and those routes were not changed or their checks disabled. Production compile mode passed; this is not a claim that the default full type check is clean.
- Live database assertions described above were rolled back before the separately scoped, audited correction.
- Real inbox delivery, production pay rates, full authenticated page timings, and a complete signed-in applicant walkthrough were not verified.
- During final pull, staging advanced to 9b871b12. Its newer UI/OAuth/directory changes were preserved. The overlapping application fixes match this branch; 56 checks passed across 12 files on merged staging after replacing an obsolete heading locator with the accessible signup-interests group. Selection/save/navigation assertions remain intact.

## Remaining five

| Bug | Remaining dependency |
| --- | --- |
| BUG-023 | A selected provider, approved integration configuration, and real OAuth/webhook persistence. Unsupported providers continue to report unavailable. |
| BUG-063 | Approved client detail/jobs/billing design and a relationship between clients and MSP clients. Existing client CRUD/search/contact improvements remain available. |
| BUG-086 | Authenticated timing and network reproduction across the affected pages. Bounded requests and compact Resume loading are implemented, but no overall performance pass is claimed. |
| BUG-108 | Approved rates for the two production jobs. Wages were not guessed or rewritten. |
| BUG-109 | WordPress source/access and approved contact details for zipstaff.com. A read-only review still shows placeholder contact/address and the Talent Aquisition typo. This site is outside the checkout. |
