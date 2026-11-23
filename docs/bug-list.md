# Recruiter bug list

Tracked product bugs. Move items to **Fixed** when shipped.

## Open

The shared tracker is the source of truth for remaining reports. As of 2026-11-24, 20 rows remain Open after the seventh implementation/reconciliation batch.

## Implemented — pending deployed QA (2026-11-23)

Source: [functional testing bug log](https://docs.google.com/spreadsheets/d/1nEj2t_e_IApcvw0q7_SKGUs2Xl_kNi8GveVrBU4_qq8/edit?gid=1932141000#gid=1932141000).
The following 13 fixes are implemented locally. The shared sheet now records them as Fixed with a note that deployment and deployed QA are pending.

| Bug | Change | Verification |
| --- | --- | --- |
| BUG-005 | Account & Security uses one authenticator setup panel; deactivation remains available. Corrected 2FA grammar in the reusable preferences panel. | Security component tests verify one setup control and retained deactivation. |
| BUG-008 | Department deletion asks for confirmation before sending DELETE. | Component tests cover cancel and confirm. |
| BUG-009 | Enabled quiet hours reject identical start/end times before saving. Overnight windows remain valid. | Component tests cover equal boundaries and overnight persistence. |
| BUG-010 | Invalid branding hex values show an error and fail form validation; the swatch retains the last valid color. | Branding component test covers invalid hex and Cancel. |
| BUG-011 | Company website displays invalid URL feedback on blur. | Company profile component test covers invalid and corrected input. |
| BUG-012 | Change Email starts blank and displays validation errors inline. | Account component test verifies invalid input sends no request. |
| BUG-014 | Corrected branding subtitle and removed duplicate “color” from picker button labels. | Copy and accessible-label inspection; affected tests pass. |
| BUG-016 | Branding Cancel restores the last saved values and clears pending logo/background uploads and removal flags. | Branding component tests cover presets, invalid input, and pending logo upload. |
| BUG-018 | Login headline has a visible 120-character counter/limit and cannot be saved empty. | Branding component test checks maximum length and empty-submit rejection. |
| BUG-145 | Shared photo validation enforces the displayed 2 MB limit before preview/request and on the server; HTTP 413 has a clear message. | Shared-validator and upload component tests cover the size boundary and request prevention. |
| BUG-146 | New profile photo filenames use URL-safe ASCII characters, preventing fragment delimiters in storage keys. | Filename regression test covers spaces, #, &, and Unicode. Existing stored objects are unchanged. |
| BUG-147 | Profile photo picker and shared validator accept only JPG/PNG, matching the hint. | Shared-validator and component tests reject WEBP; SVG and untyped files are also rejected. |
| BUG-150 | Plural professions URL redirects to the existing singular settings route. | Settings redirect regression test. |

Validation: 44 tests passed across 9 affected test files. TypeScript passed (`tsc --noEmit --incremental false`). Lint passed on changed source and test files with 0 errors and 8 existing warnings. `git diff --check` passed. Deployed authenticated browser flows and actual storage uploads still need QA after deployment.

## Implemented — second batch, pending deployed QA (2026-11-23)

Another 12 remaining reports are implemented locally, excluding the original fixed IDs and the first batch above. The shared sheet records them as Fixed with deployment and deployed QA pending; duplicate BUG-081 is also marked Fixed.

| Bug | Change | Verification |
| --- | --- | --- |
| BUG-021 | Disable user row action triggers when no permitted actions exist, with explanatory tooltip text. | Component test verifies disabled trigger and no empty menu. |
| BUG-022 | Invite User shows app-styled validation for missing names and malformed email, including `a@b`, before making a request. | Component tests cover empty, malformed, and missing-domain email addresses. |
| BUG-027 | Report Center subtitle now refers to BrassHR data. | Inspected copy and existing Report Center component test passes. Duplicate BUG-081 is not counted separately. |
| BUG-032 | Empty or whitespace-only custom role names display an inline error. | Role editor component test verifies that no save request is sent. |
| BUG-033 | Role names display and enforce the existing server limit of 80 characters. | Component test verifies the maximum and guards an overlong value. |
| BUG-042 | Custom position creation and profession rename show an 80-character limit and current count. | Create and rename component tests. |
| BUG-044 | Passing score preserves the entered draft, flags invalid values, and prevents invalid saves. Blur clamps to 0–100 and removes leading zeros with visible feedback. | Component tests cover -5, 150, 05, and Cancel restoration. |
| BUG-057 | Job detail uses the existing pay formatter, producing “per hour” instead of “per hourly.” | Helper tests cover periods, ranges, and suggested pay. |
| BUG-058 | Draft jobs show “Not posted”; creation date is no longer presented as publication date. | Helper tests cover drafts, unpublished jobs, and actual publication dates. |
| BUG-073 | Worker Pay Rate sorting compares numeric amounts; missing values stay last. Rate filters use the same parser, preserving range endpoints. | Tests cover ascending/descending, ranges, commas, zero, and missing values. |
| BUG-087 | Dashboard Manage Clients links to the Clients list. | Inspected the corrected destination. |
| BUG-099 | Resume import advertises single-file uploads and rejects multi-file drops/selections without parsing just the first file. | Component tests cover multi-file rejection and single-file parse. Existing candidate imports remain available. |

Validation: 31 unique tests passed across 9 affected test files. TypeScript passed. Added/updated regression tests pass ESLint. Source lint reports 3 existing errors and 9 existing warnings; comparison against HEAD reproduces the same errors (job tags memoization, worker API `any`, and worker metrics `Date.now()` during render). `git diff --check` passed. Deployment, authenticated browser QA, and live API/storage validation have not been performed.

BUG-034 was inspected and skipped: this checkout already slices the roles list by page size and has page controls.

## Implemented — third batch, pending deployed QA (2026-11-23)

| Bug | Change |
| --- | --- |
| BUG-062 | Client names display and enforce a 120-character limit in the form and API. |
| BUG-072 | Client creation uses a named dialog with inline validation and persistent request errors. |
| BUG-075 | Shift details support confirmed deletion through a tenant-scoped API. |
| BUG-076 | Empty shift creation displays application validation before sending a request. |
| BUG-078 | List view shows one Work Shift legend label. |
| BUG-125 | Creating a past shift requires confirmation in the UI and API. |
| BUG-129 | The schedule displays shift and employee totals for the loaded range. |
| BUG-138 | Staff-created client organizations no longer reuse the staff member's unique client login link. The nullable login migration was applied to development project qowirmiicsrglehiaoil. |
| BUG-139 | Facility creation requires a tenant-validated client selection, and client links filter the facility list. |
| BUG-140 | Facility ZIP accepts only five digits or ZIP+4 in both UI and server validation. |
| BUG-142 | Facility assignment management supports confirmed unassignment while retaining cancellation history. |
| BUG-143 | Facility create/assignment dialogs display nested service-area API errors as readable messages. |
| BUG-144 | Facility assignment requires a converted worker record, checked centrally on the server. |

Validation: 31 tests passed across 7 files. TypeScript passed. Scheduling lint reports one pre-existing immutability error, reproduced against HEAD; the earlier client/facility lint checks introduced no errors. The shared sheet contains 50 Fixed, 99 Open, and 1 Not a bug / Closed. These statuses include the original user-confirmed fixes and duplicate BUG-081. Application deployment and authenticated deployed QA remain pending.

## Implemented — fourth batch, pending deployed QA (2026-11-23)

| Bug | Change |
| --- | --- |
| BUG-002 | Personal profile uses inline required-field errors consistently, including names, birthdate, and job title. |
| BUG-003 | Unsaved profile edits trigger a warning before sidebar/link navigation and browser unload; Cancel and successful save clear the warning. |
| BUG-013, BUG-088 | The shared header shows a profile skeleton while account details load, without a placeholder avatar, name, or role. |
| BUG-015 | Hiring journey help identifies stored custom colors and explains how to restore branding defaults. |
| BUG-017 | Hiring journey reset and save use current editor branding colors; editing one theme field retains unrelated saved colors. |
| BUG-019 | Logo uploads reject unsupported types and files over 2 MB with visible feedback; broken thumbnails show a fallback. |
| BUG-020 | Branding save leaves a visible success confirmation in addition to the toast. |
| BUG-024 | Integration labels say “Connected today” when no connection date is supplied. |
| BUG-025 | Billing links to the existing support page instead of displaying an invalid placeholder telephone number, and uses “sign up.” |
| BUG-028, BUG-052 | Applicant subtitle describes hiring progress; metrics distinguish loading, loaded counts, and failure instead of persisting on Loading. BUG-052 is the duplicate report. |
| BUG-053 | Applicant metric loading uses skeletons without misleading zero counts. |
| BUG-067 | Worker assessment scores label score and answered count separately instead of inventing a maximum; Files uses a readable empty activity message. |
| BUG-074 | Overnight creation shows a next-day notice; saved shift ranges explicitly label the end time as next day. |

Validation: 24 tests passed across 9 files. Source and test lint has 0 errors and 41 existing warnings; scheduling retains the previously documented HEAD immutability error. TypeScript passed. Read-only Supabase MCP inspection confirmed the metrics API columns and status foreign key exist on qowirmiicsrglehiaoil, and a tenant-scoped application query succeeds. No database writes were made in this batch. Shared tracker has 65 Fixed, 84 Open, and 1 Not a bug / Closed, with deployment and deployed QA pending.

## Implemented — fifth batch, pending deployed QA (2026-11-24)

| Bug | Change |
| --- | --- |
| BUG-029, BUG-030, BUG-114 | Workflow list reads no longer provision default flows, so deleted flows stay deleted, new folders remain empty, and reading folders does not change their counts. Explicit default provisioning remains available. |
| BUG-038 | Empty template names show inline feedback before a request; creating a valid draft navigates to its saved template. |
| BUG-040 | Email templates support placeholder insertion at the focused field's cursor and a sandboxed preview with sample values. |
| BUG-041 | Unsaved legal policy edits require confirmation before switching policies, creating another policy, or navigating away; browser unload is guarded. |
| BUG-048 | Upload displays the exact blocking validation message and links it to the disabled button. Email validation also participates in enabling upload. |
| BUG-079 | Average engaged hours divides by all staff accounts in scope, including staff without activity. |
| BUG-080 | Headcount is labeled Total staff accounts and explicitly distinguished from the Workers directory. |
| BUG-082 | Productivity analytics shows dashboard skeletons while loading and uses the existing app date-range selector. |
| BUG-083 | Report Center shows live reports by default; planned reports are opt-in and category counts reflect availability. |
| BUG-111 | Builder's last-updated caption displays the saved publish state. |
| BUG-112 | Library payloads dropped into editable text are rejected rather than appended to titles; ordinary text drops and canvas insertion remain available. |
| BUG-121 | Step completion says Saving, email submission alone says Sending, and generic candidate-step copy mentions the portal once. |

Validation: 53 targeted tests passed across 13 files. Additional scheduling regression checks passed after retaining both imports from a checkout merge conflict. TypeScript passed after repairing a login typography re-export that lacked a local binding. Source lint has four pre-existing workflow-builder ref-access errors reproduced against HEAD; new and updated tests pass. No database writes were made. Tracker records 79 Fixed, 70 Open, and 1 Not a bug / Closed, with deployment and deployed QA pending.

## Implemented — sixth batch, pending deployed QA (2026-11-24)

| Bug | Change / verification |
| --- | --- |
| BUG-026 | Subscription tab switches to a distinct view with the stored plan, explicit unconfigured billing-cycle/seat fields, and a working support link. Only plan data exists in the tenant schema. |
| BUG-031 | Custom workflow folders support rename and confirmed deletion. Default folders are protected; nonempty folders cannot be deleted. Mutations require admin authorization and tenant scope. |
| BUG-036 | Industry descriptions and icons persist on create/edit and reload. New nullable metadata columns were applied to development project qowirmiicsrglehiaoil in migration 20261123194049. Existing RLS is unchanged. |
| BUG-037 | Empty secondary industries can be deleted with confirmation. Primary industries and industries with professions are protected; AI industry bindings are refreshed through the existing service. |
| BUG-065 | Worker Client uses organization/MSP/snapshot client names, with tenant ownership checked for linked organizations. Facility names and addresses are no longer client fallbacks. Cancelled assignments are excluded. |
| BUG-069 | Stored new status displays as Onboarding. The Onboarding Workers card and status filter use the same definition instead of counting recently created Active workers. |
| BUG-071 | Worker table and metric cards show loading skeletons instead of empty rows and zero counts. |
| BUG-039 | Existing archived-template Delete action verified with a regression test; no new feature code was needed. |
| BUG-045 | Existing assessment applicant preview opens and closes correctly in regression coverage; no new preview implementation was needed. |
| BUG-068 | Existing Workers All Filters action opens its advanced Filters dialog in regression coverage. |

Validation: 40 tests passed across 12 files; TypeScript passed. New backend and test files pass lint. Touched legacy worker files retain five pre-existing explicit-any errors and source lint reports 12 existing warnings. Supabase metadata checks confirm the new length constraints and enabled RLS; post-migration security advisors introduce no findings. Shared tracker records 89 Fixed, 60 Open, and 1 Not a bug / Closed. Spreadsheet verification uses API values and formatting metadata; deployed authenticated QA remains pending.

## Fixed

### Cannot change candidate status from AI Analysis Overview (2026-09-01)

Recruiters could not change a candidate’s application status on the AI Analysis Overview screen. The header showed a non-functional “Attempted Contacted” control, so status had to be updated from the candidate profile instead. Status can now be changed on Overview for the current job application (including candidates with multiple jobs).

## Implemented or verified — seventh batch, pending deployed QA (2026-11-24)

Forty reports were implemented or verified against current code in this continuation. The shared tracker now has 129 Fixed, 20 Open, and one Not a bug / Closed. These changes are on `heneralpepito/remaining-bugs-20261124` and are not yet committed or deployed.

| Bug | Change / evidence |
| --- | --- |
| BUG-059 | Distinct Payroll Employment Type label for W2/1099; existing submit-driven required feedback retained. |
| BUG-060 | Wizard step URLs, deep links after draft hydration, and Back/Forward restoration while retaining tenant parameters. |
| BUG-090 | Pay-range ordering enforced on compensation navigation, save, and API schema including drafts. |
| BUG-091 | Successful status mutation immediately updates the job detail badge before background reload. |
| BUG-092 | Public list/detail projections include stored weekly hours; both public detail surfaces display them. Existing Review expected-hours display retained. |
| BUG-118 | Pipeline tally uses current status keys, Closed groups, and the live Closed Application/Application Closed labels instead of stale legacy values. |
| BUG-120 | Bulk deletion resets pagination and refreshes list/count buckets and metrics. |
| BUG-149 | Careers tenant route redirects to the existing public tenant jobs board and rejects malformed slugs. |
| BUG-056 | Existing hyphenated-title search verified for QA, QA-TEST, and QA-TEST-Job in text/dashboard tag search. |
| BUG-034 | Existing role pagination verified with seven roles and a six-row page size. |
| BUG-064 | Existing selected-worker CSV/XLS export verified. Direct Add Worker intentionally remains unavailable under the onboarding-only product rule. |
| BUG-043 | Existing database audit trigger verified by creating/renaming a tenant status inside a rolled-back transaction and asserting original v1 and renamed v2 snapshots. No test records persisted; missing historical snapshots cannot be recreated. |

Validation: 79 job/public-board tests across eight files, one roles pagination test, and four worker-directory tests passed (84 tests across ten files). TypeScript passed after the job/wizard changes. Changed backend/public-detail lint has no errors; existing JobDetailsClient memoization error and legacy component warnings remain. Spreadsheet statuses and open-count formula verified via API; native browser rendering is unavailable in this session.

Additional completed reports in this batch:

| Bug | Change / evidence |
| --- | --- |
| BUG-097 | Candidate field saves dispatch the existing profile refresh event; list phone numbers use the shared formatter. |
| BUG-100 | Permission-aware note editing/deletion, with tenant/worker/note-scoped API handlers and visible failures. |
| BUG-101 | Existing More Action submenu and Delete callback verified. |
| BUG-117 | Custom action status dialog preselects the matching Follow Up status rather than the first alternate. |
| BUG-122 | Invalidated pending detail requests cannot overwrite fresh header status; request ownership checked before caching. |
| BUG-085 | Dashboard Approve PTO opens a real paginated review screen backed by existing time-off request APIs. |
| BUG-126 | Who Is Off merges scheduled leave with approved requests, excludes ordinary shifts, and deduplicates effective leave. |
| BUG-127 | Schedule worker links use candidate profile IDs; worker profiles show scoped scheduled-shift history and total shifts. |
| BUG-066 | Worker profile assignment dates, pay, billing and location reuse the filtered employment directory API. |
| BUG-077 | Day/week/month/Today calendar navigation plus worker, client, position, location and status filters. |
| BUG-128 | Unassigned shifts can be created, assigned and unassigned; open shifts have a grid row/filter and dashboard deep link. Migration 20261123213112 applied only to dev qowirmiicsrglehiaoil; RLS and related-record tenant guards retained. Rolled-back live create/assign/unassign and cross-tenant rejection assertions passed. Advisors unchanged. |
| BUG-104 | Search explains all-keyword matching/removal; reset shows loading instead of stale zero counts; aborted responses cannot clear newer loading/results. |
| BUG-105 | Canonical workplace options only; legacy combined postings still match Remote/Hybrid filters. |
| BUG-107 | Remote jobs skip on-site confirmation across public, candidate and worker apply surfaces while retaining service-area validation. |
| BUG-094 | Detail-menu Delete (including archived jobs) uses existing typed confirmation and tenant-scoped deletion, then refreshes caches/navigation. |
| BUG-135 | Preview chooses a published tenant job and loads its real questions without creating an applicant. Required answers validated; missing context/failed saves cannot complete the live step. |
| BUG-137 | Authorization e-sign routes to a signing form; typed acknowledgment requires consent and legal-name signature. Legacy checkbox-only acknowledgment evidence is incomplete. Firma template behavior retained. |
| BUG-113 | Existing resume evidence reconciliation verified to produce 1/4 completed on reassigned workflow. Reported candidate absent from confirmed dev tenant; deployed reproduction pending. |
| BUG-115 | Duplicate creates a uniquely named unpublished configuration copy; Unpublish uses existing scoped update. Neither copies candidate progress/mappings. |
| BUG-136 | Existing admin workflow step inspection/completion and document Preview/Download verified; legacy checklist URL still routes to profile. |

Verification includes targeted UI/API/domain regressions, TypeScript, changed-source lint and rolled-back Supabase integrity checks. Changes remain uncommitted on `heneralpepito/remaining-bugs-20261124` and app deployment/deployed authenticated QA are pending. No live applicant was created, no PTO request approved, and no schedule test records persisted. Existing lint warnings and prior database advisor findings remain outside these fixes.

| Additional report | Change / evidence |
| --- | --- |
| BUG-004 | Archived the two reported junk departments in dev, preserving each linked job. Profile dropdown excludes inactive departments; validation rejects compensation-label names. |
| BUG-054 | Facility GET permits scoped reads for imported applicants without a linked login; writes retain linking/approval requirements. Access decisions are awaited and worker reads scoped before retrieval. The old practice-setting field is already absent from current UI. |
| BUG-049 | Pasted titles do not supply surnames; filename fallback matches the resume's actual first name and removes resume/CV suffixes. Filename banners/polluted AI names reconcile against text. Manual titles are retained and candidate location is shown separately from assignment worksite. |
| BUG-096 | Shared ATS parser requests/preserves summary, skills, experience and education through normalization, storage and review UI. Empty AI identity falls back to contact text; missing required identity still disables Upload. Cache version and filename-key isolation updated. |
| BUG-055 | Call-log reads have a deadline and Retry, with tenant/candidate scope. Existing Applications rendering and scoped service verified. No dev applications with missing worker IDs behind linked profiles were found. |
| BUG-070 | Shared workflow/profile reads time out with retryable feedback; profile failures cannot leave an unhandled promise. Stalled-workflow regression verifies subsequent successful retry. |
| BUG-089 | Mail picker avoids a browser-session lock wait and a default-array reload loop; bounded cookie-auth reads and Retry candidates recover failures. No email sent. |
| BUG-035 | Three serial role writes replaced by server-only atomic RPC in migration 20261123232126, applied to dev. Live rolled-back assertions verify grants/label rollback on insert failure and restricted execute privileges. Admin protection/access refresh retained; end-to-end deployed latency remains to be measured. |

Final batch validation before commit: 274 tests passed across all 47 changed regression files; TypeScript passed; git diff whitespace checks passed. Additional unchanged service/routing tests were run during implementation. Changed-source lint has no new errors; existing warnings remain. Both dev migrations retain existing RLS, and security/performance/health advisory summaries are unchanged. Tracker formatting/validation and the 20-open count are verified through native Sheet API metadata; authenticated deployed visual QA remains pending.
