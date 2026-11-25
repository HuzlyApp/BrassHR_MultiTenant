# Remaining bugs — 2026-11-26

Implementation release from `heneralpepito/remaining-bugs-20261126`.

45 previously Open/In Progress rows are addressed or revalidated. Nine revalidations cover existing fixes (BUG-053, BUG-065, BUG-066, BUG-115, BUG-117, BUG-119, BUG-126, BUG-127, BUG-172); no replacement implementation was added for those behaviors. 26 bugs remain: 17 Open and 9 In Progress. Spreadsheet implementation statuses/notes were updated; QA status, dates, remarks and coverage results were preserved.

## Changes and evidence

- **BUG-050**: Jobs dashboard now uses the same tenant-scoped grouped Applicants RPC count, including closed applications, and labels/links it as Total Applicants. Count regression tests pass.
- **BUG-053**: Revalidated the existing loading skeleton: applicant metric cards hide zero counts until data arrives and show explicit failure feedback.
- **BUG-064**: Workers now exposes CSV export without row selection and an Add worker from applicants link through the existing W2/1099 onboarding gate; direct ungated provisioning remains prohibited.
- **BUG-065**: Revalidated client-name resolution from the tenant-matched client organization, MSP client, or stored snapshot rather than the worker's address.
- **BUG-066**: Revalidated worker profile/list parity for assignment dates, pay/bill rates and workplace through the shared employment projection.
- **BUG-115**: Revalidated published workflow Duplicate and Unpublish actions and unpublished/busy restrictions.
- **BUG-117**: Revalidated the configured custom-status button selects and submits its named status rather than the first alternate.
- **BUG-119**: Revalidated Reactivate opens the status dialog and saves the selected active/custom status after confirmation.
- **BUG-120**: After deletion, list/card refresh states now replace stale counts until authoritative data arrives, avoiding transient Showing 1–0 output.
- **BUG-122**: Status mutations now immediately update the shared candidate header via the existing pipeline event and refresh saved data without duplicate journey refresh calls.
- **BUG-126**: Revalidated scheduled Vacation/PTO inclusion in Who is off with tenant scoping and candidate identity.
- **BUG-127**: Revalidated schedule-to-candidate identity resolution and worker scheduled-shift history; no employment/candidate ID mismatch.
- **BUG-157**: Confirmed qowirmiicsrglehiaoil had no active platform service-area policies. Applied the new idempotent migration restoring the repository's CA/IL/CT/NYC policy seed (337 NYC ZIPs). Rollback trial and post-apply readback passed; remote restricted-state engine tests pass.
- **BUG-159**: After a successful new-job save/publish, clears persisted ID, job/UI/workflow/terms/questions and resets the URL step to Setup before leaving, preventing cached wizard reuse.
- **BUG-171**: Same status-event/header synchronization fix as BUG-122; immediate header feedback is regression-tested while the background request remains pending.
- **BUG-172**: Revalidated application-specific submitted/created date mapping rather than worker creation time. Read-only check of the reported application confirms Nov 23 Eastern creation/submission; applied-at mapping tests pass.
- **BUG-177**: Preview replaces placeholder samples with readable sample values and real tenant name. Reset to default restores global content into the draft with confirmation; Save is still required. Layout effect prevents a late template initialization from overwriting early edits.
- **BUG-180**: All status-to-Open transitions validate required publish fields server-side and verify the assigned published workflow before writing; incomplete profession regression rejects without mutation.
- **BUG-209**: Organization step explicitly explains that prefilled details must be reviewed and Save & Continue selected to confirm and mark Done.
- **BUG-211**: Publishing from list/status actions performs a status-only transition and preserves the assigned workflow instead of re-running automatic mapping.
- **BUG-213**: Description review decodes entities even when plain text has no HTML tags; raw leading &nbsp; is removed.
- **BUG-216**: Description-step job preview now includes configured screening questions and required labels, matching the review content.
- **BUG-218**: Existing-job edit reloads the saved server revision and no longer restores/persists unsaved browser drafts.
- **BUG-222**: Activity UI collapses repeated Viewed profile reads within the same minute; badge counts the visible entries. Stored audit logs and meaningful actions remain intact.
- **BUG-223**: Message tooltip says Loading candidate application during loading rather than incorrectly claiming the candidate lacks an application.
- **BUG-225**: Revalidated client detail queries linked facilities by both tenant and client ID. Read-only check confirms two linked facilities for the reported QA client; endpoint regression returns its linked facilities.
- **BUG-226**: New clients start with pending verification/onboarding and null completed_at instead of claiming completed onboarding.
- **BUG-227**: An empty archived directory says No archived workers yet; metric cards remain visible.
- **BUG-228**: Worker role falls back to candidate/job/snapshot values; zero pay remains visible and billing rate is no longer substituted for pay. Missing role/pay explicitly says Not set.
- **BUG-229**: Facility modal owns the single success toast; removed the duplicate parent toast.
- **BUG-230**: Address suggestions are restricted to the selected state, accepting either full state names or codes.
- **BUG-231**: Address suggestions close immediately on blur and cannot reopen from a late response; stale requests abort. Manually selected city remains accepted without requiring an address suggestion.
- **BUG-233**: Worker profile displays an immediate accessible loading skeleton with a named busy status; pending-read regression passes.
- **BUG-235**: Unavailable analytics tabs explicitly explain Coming soon and awaiting department data.
- **BUG-236**: Authenticated platform denial displays Access denied and a dashboard return link, including the proxy's forbidden login redirect; session is preserved.
- **BUG-239**: Workflow mutations await both flow and library query refreshes. Integration regression confirms deleting a flow updates the folder list and published count.
- **BUG-241**: Draft workflow badge says Unpublished rather than the action word Unpublish.
- **BUG-249**: Candidate creation notifies the parent immediately after save, refreshing list/metrics and resetting pagination without waiting for success-dialog dismissal.
- **BUG-256**: Deadline input preserves invalid typed dates for correction; inline and step/publish validation explain past or out-of-range deadlines instead of silently dropping them.
- **BUG-257**: Onsite/hybrid wizard progression requires a city/state worksite, blocking city-only free text until corrected.
- **BUG-260**: Revalidated autocomplete does not open or change a saved value on initial load; selection now invalidates outstanding results and stops the searching state.
- **BUG-263**: Pagination end remains capped by total and returned row count; an out-of-range page now requests the actual last page before showing a range.
- **BUG-264**: Clear all resets toolbar/search/extended filters and always starts a fresh request, even when values were already clear after an error; stale reads abort and list requests have recovery deadlines.
- **BUG-269**: Candidate workflow selector explicitly labels the assignment as belonging to this application and explains that job-level changes do not silently migrate existing applicants.
- **BUG-271**: Assigned-to-client card explicitly explains that it includes workers still onboarding, so its count is not presented as a subset of Active.

## Verification

- Full Vitest run: 3,493 passed, 22 skipped, zero failures (`output/qa/remaining71-final.json`, local artifact).
- Focused follow-ups cover edited components, workflow folder invalidation, client/facility scoping, worker assignment presentation and publish validation.
- Source TypeScript check uses the existing QA config excluding generated `.next` route-export files; generated-route validation is not claimed.
- Changed-file ESLint errors were corrected and the relevant follow-up passed; existing warnings are retained.
- Production webpack compile passed (compile-only, without database prerender). Six focused follow-up checks passed after the final description-text correction.
- `git diff --check`.

## Supabase

Confirmed project: `qowirmiicsrglehiaoil`. Read-only investigation found no active platform service-area policies. Applied `restore_missing_platform_service_area_policies` from the new CLI-created migration `20261125180531_restore_missing_platform_service_area_policies.sql`. The migration repeats the existing Phase 1 seed for CA, IL, CT and NYC without editing prior migrations or changing tenant-specific policies. A rollback trial and post-apply readback confirmed four active policies and 337 NYC ZIP entries. Both policy tables retain RLS and FORCE RLS. Security advisors were checked before and after; no schema/security policy changes were made. No existing job, worker, tenant or account rows were repaired or deleted.

## Still unresolved

- **BUG-049**: Paste Resume Text parsing mangles applicant data
- **BUG-063**: No client detail page, edit, delete, or list search/filters
- **BUG-086**: Intermittent page load failures and >30s loads
- **BUG-089**: Mail compose has no free-text recipient and candidate list stuck loading
- **BUG-096**: Resume parser returns empty name/email/phone and Upload enables with empty required fields
- **BUG-108**: Some public job pay rates look wrong
- **BUG-109**: zipstaff.com WordPress page issues (email link, placeholder address, phone mismatch, typo, # links, copyright)
- **BUG-129**: No schedule summary/shift counts to reconcile with the dashboard
- **BUG-132**: Active workers exist without any onboarding workflow (violates W2/1099-only rule)
- **BUG-148**: Responsive design: 18 pages not usable at phone width (5 also fail at tablet)
- **BUG-155**: Recruiter role is view-only on Jobs and Hiring and has no Templates/Automation access, so a Recruiter can't post jobs as the handoff expects
- **BUG-160**: Save draft failed silently once: stayed on Review, no error, no job created
- **BUG-210**: Location autocomplete takes 5-8s and 'Searching locations...' stays after a location is set
- **BUG-214**: Job location is not normalized: 'Los Angeles' is saved while other jobs show 'Los Angeles, CA'; the new-job filter lists both variants
- **BUG-220**: Add Applicant upload stays on 'Adding candidate...' for more than 15 seconds
- **BUG-224**: After closing an application, the Pre-hire Intake step button text changes to 'Follow Up needed test'
- **BUG-243**: /admin_recruiter/new/checklist/<profile id> redirects to the candidate profile instead of opening the checklist
- **BUG-245**: Pending invite 'Invited' time is 3 hours ahead of Pacific Time
- **BUG-247**: Add Applicant reports 'already has an application' after a long save that actually succeeded
- **BUG-248**: Resume parse can take 11-75 seconds and Add Applicant save 25-26 seconds
- **BUG-250**: Edit Job Continue to Review takes 16.1s; workflow override dropdown select takes about 11s
- **BUG-251**: Closed job shows 'Date posted: Not posted'
- **BUG-262**: Job location autocomplete stays on 'Searching locations…' for more than 30 seconds
- **BUG-270**: Offer and Send Offer are disabled with 'Offer actions coming soon'
- **BUG-273**: Post a Shift dialog takes more than 15 seconds to open
- **BUG-276**: Create Job wizard does not open: 'Create a job' link does nothing, and /jobs/new stays a blank grey page for more than 30s

Live signed-in UI QA and new performance measurements were not run, per the user's instruction to continue with code and automated checks. Red performance measurements are retained. External WordPress changes and authoritative public pay-rate corrections require their source systems/data. Historical worker/workflow and posted-date records, role-permission intent, unavailable feature gaps and remaining latency/AI quality cases are not claimed fixed.
