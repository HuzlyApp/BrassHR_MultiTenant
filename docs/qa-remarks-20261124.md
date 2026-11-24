# QA remarks review — 2026-11-24 UTC

Tracker: https://docs.google.com/spreadsheets/d/1nEj2t_e_IApcvw0q7_SKGUs2Xl_kNi8GveVrBU4_qq8/edit

Branch: `heneralpepito/qa-remarks-and-coverage-20261124`, based on staging `80ab1b50`.

## Outcome

Reviewed 204 bug records, 455 coverage records, and QA remarks. The initial implementation status was 169 Fixed, 32 Open, two In Progress, and one Closed. This batch records 18 additional implementation fixes, leaving 187 Fixed, seven In Progress, nine Open, and one Closed. Fixed means implemented with automated evidence; it does not mean QA has verified the deployed flow.

Updated Bug Log K:L for the affected bugs, appended evidence for two previously fixed bugs, and updated 24 coverage notes. Original QA status/date/remarks in M:O, cell formatting, and validation rules were preserved and checked after writing. Coverage results now total 193 Pass, 92 Fail, 69 Blocked, 95 Partial, and six existing N/A. Historical results were not bulk changed to Pass. Summary counts now use bounded formulas instead of stale hardcoded totals.

## Implementation fixes

| Bugs | Change |
| --- | --- |
| 050 | Total Applicants uses the same tenant/job-scoped grouped application list RPC; active-profile dashboard count is explicitly labeled. |
| 119, 123 | Profile Reactivate and custom status selection use the shared application status catalog and confirmation flow. Missing or ambiguous application context is explained. |
| 133, 141 | Worker and facility archive/restore, Archived views, facility rename/contact editing, and tenant-scoped mutations preserve history. Database triggers reject new assignments to archived records. |
| 134 | Per-application workflow reassignment identifies W2/1099 classification without changing the job's workflow globally. |
| 151, 196 | Reject reserved example domains before provisioning or delivery, show safe provider errors, default invitations to Recruiter, and exclude failed outbound messages from Sent. Real delivery remains untested. |
| 154 | Workflow override options use the default published workflow library and fail closed if it is absent. |
| 156 | Reviewed saved-profession routing from pulled staging and added workflow/experience-label regressions. |
| 166 | Job and public detail panels explicitly distinguish employer of record, job type, and payroll classification. |
| 169 | Regression coverage confirms separate pre-hire/post-hire counts rather than their combined total. |
| 176 | Role module toggles enable View only; Roles & Permissions navigation restored. |
| 178 | Completed tenant owners opening Your Trial are routed to Billing. |
| 181 | Previously published closed/paused/filled jobs show unavailable messaging and disable Apply. Draft and archived jobs remain excluded. |
| 188 | Application-ID links resolve to the authenticated candidate profile with application context. |
| 201 | Productivity rows display email to distinguish accounts with the same name. No accounts were merged. |
| 202 | Browser GET to the POST-only shifts endpoint returns JSON 405 with Allow and schedules guidance. Shift creation is a separate pending test. |

## Partial and outstanding work

| Status | Bugs | Remaining requirement |
| --- | --- | --- |
| In Progress | 023 | Simulated integration success removed; real OAuth/webhook configuration and persistence remain unimplemented. |
| In Progress | 063 | Client search/detail/contact/rename/archive implemented. Jobs and billing relationships require a model decision because clients and msp_clients are distinct. |
| In Progress | 086, 197 | Compact authenticated, tenant-scoped resume API avoids onboarding/document scans. Deployed timing and the full profile header still need measurement. |
| In Progress | 095 | Submitted screen honors canonical application-status routing. Duplicate ACLS requirement configuration still needs review. |
| In Progress | 132 | Removed legacy worker insertion fallback so conversion RPC failures fail closed. Complete activation-gate audit and historical active-worker review remain outstanding. |
| In Progress | 193 | Always-visible open/download fallback added. Native PDF rendering requires manual browser QA. |
| Open | 046 | Conflicting QA observations about Nursing/Technology require an authenticated configuration retest. |
| Open | 093, 098, 102, 192 | Publish loading, profile field mapping, closed-candidate approval, and Hiring navigation need authenticated reproduction and verification. Existing code does not establish a live pass. |
| Open | 103, 106, 108 | Production job search, employment description, and pay need production source/configuration and approved rates. |
| Open | 109 | WordPress changes require that site's source/access. |

## Verification

- Full Vitest run: **3,352 passed, zero failed, 22 skipped** across 3,374 tests. JSON/logs were generated locally under output/qa and are not committed.
- A subsequent menu-anchor lint correction passed its three targeted component tests and targeted ESLint check. The full suite preceded that small correction.
- TypeScript `tsc --noEmit`: passed after the final correction.
- Changed-file ESLint: zero errors, 57 warnings. Two ref-access errors were corrected by capturing the menu anchor in the click handler. No claim of a warning-free repository.
- Tenant-scoped API/component tests cover archive/restore, invite validation, safe email errors, custom statuses, workflow reassignment, application redirects, closed job availability, metrics, resume response minimization, and role toggles.
- Supabase project **qowirmiicsrglehiaoil** received migrations `20261124162820_add_management_archive_timestamps.sql` and `20261124163415_guard_archived_directory_assignments.sql`. Local environment and CLI references point to other projects, so no CLI database push was used.
- Live database assertions ran inside a transaction and rolled back: archived facility/client reject new shifts; archived worker rejects new assignments; restored records allow assignments; existing assignment history remains and status-only cancellation is permitted.
- Post-rollback tenant counts remain three facilities, eight workers, two shifts, and two assignments, with zero archived facility/worker records.
- Security/performance/health advisor counts did not increase after migrations. Existing findings remain, including a pre-existing RLS-disabled-public-table error; this is not a clean-security claim.
- An isolated deployed browser reached the signed-out landing page. Authenticated UI → API → database → response verification stopped at the missing QA session. No auth bypass was enabled and no live email/SMS was sent.

## Release condition

This batch is reviewable and automated tests pass, but the request's "everything all set" condition is not satisfied. Signed-in QA access, integration configuration, production source/pay data, and WordPress access are still needed. Do not represent this report as approval to declare all bugs verified or the entire coverage sheet passed.
