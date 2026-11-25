# QA bug and performance fixes — 26 November 2026

Source: the connected BrassHR functional bug log, QA remarks, Test Coverage, and Performance tabs. Fixed/Verified entries were skipped. The starting log contained 110 Open and 2 In Progress bugs.

## Implemented or revalidated

40 entries are marked **Fixed**, meaning implementation/code checks are complete and deployed QA is still required:

BUG-001, BUG-002, BUG-006, BUG-012, BUG-018, BUG-022, BUG-044, BUG-062, BUG-072, BUG-074, BUG-183, BUG-201, BUG-206, BUG-208, BUG-212, BUG-215, BUG-217, BUG-219, BUG-221, BUG-232, BUG-237, BUG-240, BUG-242, BUG-244, BUG-246, BUG-252, BUG-253, BUG-254, BUG-255, BUG-258, BUG-259, BUG-261, BUG-265, BUG-266, BUG-267, BUG-268, BUG-272, BUG-274, BUG-275, BUG-277.

- Legacy profiles retain unknown birthdate/job-title values rather than requiring invented data. Required names validate on blur. Email/invitation forms disable invalid actions and show inline feedback.
- Header/sidebar roles use the same current-user tenant role. Existing invite identity guards were rechecked without sending invitations.
- Closed-job edits preserve status and original posted dates. Revision tokens survive local drafts; stale or racing edits return HTTP 409 with a reload path.
- Pay validation clears correctly, both negative range errors render, and zero/unusually high rates show a review warning. Job titles and client names have shared input/API limits. Historical long client names are contained in the list without deleting records.
- Closed-job candidate actions are blocked up front. Empty resumes are rejected before parsing. Parse fallbacks explicitly require review. Punctuation-only searches cannot turn into unfiltered results.
- New shift drafts clear stale employee selections and overnight shifts require confirmation. Workflow save errors clear when input changes, old timestamps use hours/days, and More exposes configured application statuses.
- Direct Compose/Workflows URLs resolve to their existing screens, and the workflow alias retains Workflow Library authorization.
- Productivity CSV includes unique employee IDs so legitimate same-name accounts remain distinguishable.

Existing fixes for BUG-018, BUG-044, BUG-072 and BUG-206 were rechecked rather than replaced. BUG-238 was closed as not a bug: page size 6 is a capacity; a page with five matching departments correctly says 1–5 of 5.

## Performance work

The Performance tab contains 128 measurements; red means more than seven seconds. Original measurements and conditional formatting are preserved. Developer evidence was added separately; none of the historical red measurements was recolored or reported as a successful retest.

- Redis failure cooldown now applies even when an adapter already exists, and an unavailable adapter does not permanently disable later recovery. Regression tests cover failure, cooldown and recovery.
- Independent staff-profile/resource authorization reads run concurrently. Tenant membership, fresh grants and disabled-account checks remain enforced; revocation/tenant-scoping regressions pass.
- Browser token lookup retains normal bearer authentication and coalesces its SDK request. A stalled SDK lookup now has a one-second wait budget before using the pre-existing server-verified cookie fallback. The underlying SDK call is shared rather than repeatedly queued.
- Mail template/draft/compose reads reuse that bounded helper. Template reads have an explicit recovery deadline; the recipient remains an existing tenant candidate/worker.
- New-job reference choices use a small tenant-scoped projection without complete list/count enrichment.
- Interactive resume AI requests have an eight-second budget and no provider retries. Extracted-field fallback is visibly labelled for review. Quick Match uses the existing Next `after()` scheduler after the applicant is saved.
- Location requests cancel superseded work, reject stale responses, stay closed after blur, and bound provider/client waiting to 4.5/6 seconds. Applicant reset cancels obsolete list requests and has an explicit recovery state.

Read-only diagnostics used the confirmed Supabase project `qowirmiicsrglehiaoil`. Common permission SQL averaged under a millisecond while matching REST endpoints had approximately 215–223 ms p95 origin time, supporting fewer serialized waits rather than speculative indexing. No database migration or live-data repair was applied.

## Validation and remaining work

- Full regression run: **3,472 passed, 22 skipped, zero failures**. Machine-readable local evidence is under `output/qa/bugs-performance-vitest.json`.
- Source TypeScript check passed with generated `.next` and report artifacts excluded. Production webpack compile is checked separately; this does not claim a database-backed prerender/integration run.
- Changed-file lint errors were corrected; pre-existing warnings remain. Static RLS audit assertions are unchanged, but migration contents are read once to avoid repeated filesystem timeouts.
- QA Result/date/remarks were preserved. Developer evidence was appended to 60 related Test Coverage notes; those test cases were not relabelled Pass.
- The Summary now calculates Open, In Progress and combined remaining counts from the log. After this batch: **60 Open + 11 In Progress = 71 remaining**. This report does not claim all remaining bugs are resolved.
- Live signed-in browser QA, successful action timings, real email/Dialpad integrations and new green performance measurements were not run, per the user's choice to continue with code and automated checks. A timeout/recovery test is not proof of a fast successful action.
- Historical posted dates already cleared (BUG-251), parser quality gaps, arbitrary mail recipients, worker pay-rate provenance and other open items remain unresolved; no missing historical or financial values were invented.

The source branch is `heneralpepito/bugs-and-performance-20261125`. Development receives a separate backport because staging contains 23 additional upstream commits; these staging-only feature changes are preserved independently. Merge/deployment references are recorded in the spreadsheet after publication.
