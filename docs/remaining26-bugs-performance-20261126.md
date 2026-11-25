# Remaining 26 bugs and red performance follow-up — 2026-11-26

## Completed implementation or validation

- **BUG-129**: Added scheduled hours to the displayed schedule range/filters using the existing overnight interval calculation. Dashboard now shows an exact tenant-scoped shift count for its labelled date from employee_schedule_shifts, the same source as Schedule. Tests cover filtered totals and count unavailable state; Supabase read confirmed the count query.
- **BUG-155**: Supabase MCP repaired only Zippy Corp Recruiter grants: Jobs/Hiring View+Edit; Templates/Automation View. Four guarded rows updated after rollback trial and independently read back. Delete, Company settings, other roles and tenants unchanged. Server module-access checks passed. Sign-in QA pending.
- **BUG-160**: Validated restored-draft save end to end in component tests: success toast, one POST, draft cleared, Jobs navigation; server failure shows feedback and retains the draft. Existing success-feedback implementation confirmed. QA sign-off columns unchanged.
- **BUG-243**: Restored the direct checklist page: removed forced Profile redirect and unconditional hidden-content wrapper. Component regression proves the checklist loads directly and manual-completion permissions remain enforced.
- **BUG-245**: Validated both Invited and Last login display explicit EDT/EST through the same DateTimeCell; meets the QA expectation allowing an explicit timezone label. Component regression covers both columns. App remains Eastern; no account timestamps or passwords changed.

## Performance and parser changes

- Supabase transport preserves caller cancellation and Request methods. Only GET/HEAD transient failures are retried; cancellations and uncertain writes are never replayed. The existing per-attempt timeout is retained.
- Redis set/delete/pattern invalidation use the existing 3-second deadline and failure circuit. Successful source data remains available through the existing memory fallback. Redis invalidation remains best-effort during an outage; persisted cache entries can survive until TTL.
- Candidate creation queues applicant portal delivery through Next after() after durable application/resume writes. The API explicitly returns queued, not sent. Delivery failures remain logged and nonfatal, as before.
- Place search clears loading on its own six-second deadline even if the transport ignores abort, and ignores late results.
- Job-options/reference reads have recovery deadlines. Incomplete option payloads show a recoverable error instead of crashing the wizard; Setup renders while those reads are pending.
- Resume normalization retains valid experience/education entries beside malformed entries, fills omitted optional attributes with null, and preserves explicitly headed summary/skills when AI omits them. The parse cache version changed. This does not certify every model extraction or infer a candidate's title from the target job.

## Supabase data correction

Project `qowirmiicsrglehiaoil`, tenant `zippycorp`, built-in Recruiter role only. A guarded four-row update, first tried in a rolled-back transaction and then independently read back, enabled View+Edit for Jobs/Hiring and View for Templates/Automation. Delete and Company Settings permissions, other roles and other tenants were not changed. No schema migration or broad default-role policy change was needed. The guard required each row's previously observed update timestamp, so later edits were not overwritten.

The two BUG-108 production titles were absent from tenant-scoped Zipstaff/Zippy Corp requisitions and import items on this project. No pay values were changed. The two BUG-132 candidate prefixes resolve to historical employment rows in New/Onboarding with no source application; no workflow assignment was invented and no employment history deleted.

## Verification

- Full automated run before final follow-ups: 3,512 passed, 22 skipped, zero failures (`output/qa/remaining26-final.json`, local artifact).
- Focused changed-area follow-up: 150 passed, zero failures (`output/qa/remaining26-followup.json`). Restored-draft and incomplete-options component checks also passed.
- Source TypeScript check passed using the existing QA config excluding generated `.next` route files. Generated-route validation is not claimed.
- Changed-file ESLint: zero errors, seven existing warnings.
- Production webpack compile-only verification; no database prerender.
- Sheet readback: five rows Fixed; 21 Open/In Progress remain (10 Open, 11 In Progress). Updated developer evidence in 26 bug rows, 23 related coverage rows, and 48 red performance rows. QA status/date/remarks and coverage results were preserved. All measured seconds, run/date, and colors are retained. No live signed-in timing improvement is claimed.
- Unrelated candidate-resume edits in the shared workspace are excluded from this commit. Release integration uses isolated worktrees and preserves newer remote commits.

## Still unresolved

- **BUG-049** (Open): Original title/name-hint and candidate-location regressions remain covered by parser tests. QA's newer synthetic name includes digits and still requires manual correction under the existing person-name policy. Kept Open; no false parse-quality validation.
- **BUG-063** (In Progress): Inspected client/facility/job schema: job requisitions have an MSP-client FK and free-text facility, but no FK to this Clients model. Existing detail/edit/archive/search remains; jobs/billing relationship cannot be safely inferred.
- **BUG-086** (In Progress): Bounded Redis set/delete/pattern invalidation with the existing 3s timeout and circuit fallback. Supabase transport now honors caller aborts, does not retry cancellation, and retries only GET/HEAD (never ambiguous writes). Failure-injection tests pass. Actual signed-in page timings remain pending.
- **BUG-089** (In Progress): Candidate-picker recovery checks remain valid; arbitrary external recipients are still unsupported by the worker-bound email/draft API. Not marked fixed and no email sent.
- **BUG-096** (In Progress): Fixed section loss: validate experience/education entries individually, supply null for omitted optional fields, retain valid rows beside malformed rows, and preserve explicit summary/skills when AI omits them. Parse-cache version bumped. Parser regressions pass; actual supplied-resume/provider quality still needs QA.
- **BUG-108** (Open): Owner considers this a data-entry issue. Supabase MCP checked qowirmiicsrglehiaoil, tenant-scoped Zipstaff and Zippy Corp job_requisitions plus job_import_items: neither reported production title was found. No wage values guessed or changed; production source-record validation remains unresolved.
- **BUG-109** (Open): WordPress source/configuration is outside this checkout; no connected WordPress editing tool is available. External-site corrections remain unresolved.
- **BUG-132** (Open): Supabase MCP checked both reported candidate prefixes: their historical employment-worker rows are now New/Onboarding, not Active, but still lack source applications. Did not invent workflow assignments or delete employment history. Legacy assignment repair remains open.
- **BUG-148** (Open): The remaining QA failure is the clipped phone-width sidebar at 400% zoom. No signed-in browser layout revalidation was performed; not marked fixed based on unit checks.
- **BUG-210** (In Progress): Hardened the job-place search's 6s deadline to directly clear loading and invalidate late responses even when transport ignores abort. Selection/clear/blur and stalled transport checks pass. Successful autocomplete latency still requires a live retest.
- **BUG-214** (Open): Existing parser normalizes known city/state strings and onsite validation requires a state. Bare remote-city strings and historical records still need authoritative state data; no city-to-state guesses or historical bulk rewrite.
- **BUG-220** (In Progress): Removed applicant portal email delivery from the saved-candidate response path using Next after(). Result explicitly reports queued rather than sent. Test proves candidate/resume save returns before delivery and email retains tenant/worker scope. End-to-end save-time retest pending.
- **BUG-224** (Open): Reviewed Intake status actions: button labels are configured stage actions and are separate from step-completion labels. Cannot establish the reported post-close label transition from code-only checks; kept Open and did not overwrite tenant status configuration.
- **BUG-247** (In Progress): Shared Supabase transport no longer automatically replays uncertain POST/PATCH/PUT/DELETE operations; caller cancellation is retained. Existing missing-resume retry repair checks pass. Full successful-save/client-retry idempotency scenario still requires QA; not marked fixed.
- **BUG-248** (In Progress): Portal email delivery now runs after the durable save response. Redis writes/invalidation have bounded fallback; resume sections survive incomplete model output. Existing interactive AI request budget remains. Original 11–100s measurements retained; parse/save timings not remeasured.
- **BUG-250** (In Progress): Shared cache writes/invalidation are bounded; job-options/reference requests have 15s recovery deadlines. Wizard controls render while metadata is pending. No successful Continue/override response timing claimed; retest pending.
- **BUG-251** (Open): Previously published-then-closed regression was already nonreproducing in QA. The original historical record still lacks an authoritative posted timestamp; did not replace it with a created/updated date.
- **BUG-262** (In Progress): Fixed unbounded searching state when transport ignores cancellation: 6s timer directly clears spinner/error state and invalidates late data. Failure-injection regression passes. Successful search speed and original red 30s action need live retiming.
- **BUG-270** (Open): Offer/Send Offer remain a labelled unimplemented feature; existing applicant offer acceptance does not supply a recruiter offer-creation/send API. No fake offer or untracked outbound message added.
- **BUG-273** (Open): Existing automated form tests confirm Post a Shift opens synchronously without waiting for a data request and validation remains intact. Actual hydrated-browser 15s delay was not reproduced or retimed; kept Open.
- **BUG-276** (In Progress): Job wizard now rejects incomplete option payloads with visible recovery feedback instead of crashing. Reference/options reads have 15s deadlines. New component checks verify Setup renders during pending reads. Overall signed-in wizard-load timing remains pending.

User requested code and automated checks. Signed-in UI QA and new performance measurements were not performed. Historical data gaps, external WordPress changes, arbitrary-recipient mail and recruiter offer creation remain unresolved; the 48 red measurements still require a successful same-action retest.
