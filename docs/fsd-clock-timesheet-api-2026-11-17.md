# Clock events and timesheet workflow

Implemented and applied to development project `mgucromvpnxntwyssltd` only on November 17, 2026, Manila time. Production was neither queried nor changed. Local production environment settings were left unchanged and were not used for live HTTP requests.

## Endpoints

| Endpoint | Behavior |
| --- | --- |
| POST `/api/v1/clock-events` | `clock_in`, `clock_out`, `break_start`, `break_end`; optional `worker_id` for a hired employee, `facility_id`, staffing `shift_id`, and location. Workers default to their own hired employee. Staff clocking for another worker must choose an employee and hold Scheduling Edit. |
| GET `/api/v1/clock-ins` | Staff day view with optional date, facility, department, employee and status filters; pagination and summary cards. |
| GET `/api/v1/timesheets` | Required `period_start`, `period_end`; optional employee, facility, department and workflow status; paginated weekly rows, daily entries, and a summary over all matching entries. |
| GET `/api/v1/timesheets/{id}` | Whole weekly sheet and daily entries. |
| POST `/api/v1/timesheets/{id}/submit` | Submits a completed draft or rejected sheet. Empty body is accepted. |
| POST `/api/v1/timesheets/{id}/approve` | Staff approval with optional `{ notes }`. |
| POST `/api/v1/timesheets/{id}/reject` | Staff rejection; nonblank `{ notes }` is required. |

All v1 routes require the effective `timesheets` feature independently of the scheduling feature flags. Workers can read/submit only sheets linked to their own hired employee records. Clocking additionally requires an active employee. Historical sheet access does not disappear merely because an employment row is inactive. Staff access uses the existing Scheduling View/Edit grants. Reviews require another authorized reviewer; a staff member cannot approve or reject their own sheet.

Body and filter validation rejects invalid UUIDs, impossible calendar dates, reversed ranges, unknown fields, and tenant/reviewer/time injection. Reads default to 25 records and cap at 100. Period-range queries are limited to 366 days. Every scoped query and relevant embedded lookup includes a tenant filter. Tenant and actor IDs come from the server session. Hired employee IDs (`public.workers.id`) are used as API `worker_id`; attendance continues to use the linked `public.worker` candidate internally. Clock-in rows also expose `candidate_id` for traceability.

## Existing code and data retained

Attendance sessions remain in `applicant_attendance_logs`, and daily amounts remain in `employee_timesheet_entries`; no parallel clock or daily-entry store was introduced. The new `timesheets` table is the weekly workflow/rollup. Existing daily entries are attached to draft weekly sheets without changing their recorded minutes. The existing synchronization helper now calls the shared database calculation. Existing employee timesheet screens continue reading their original daily table, and clock-in rows/cards reuse `buildClockInRows` and `clockInMetrics`.

As confirmed by the user, weeks are Monday through Sunday, work dates use America/New_York, and daily minutes retain the existing split: up to 480 regular minutes and the remainder overtime, with a 1440-minute daily cap. Unpaid break time is deducted. Overnight sessions remain attributed to their clock-in work date, matching the existing attendance model; this increment does not split them at midnight. Draft totals refresh on attendance events or synchronization; the Clock-ins view computes active elapsed time for display.

The existing daily table supports one entry per employee/work date. A new clock session at a different facility on the same day returns 409 rather than misattributing combined hours. Existing manual daily entries are marked separately and cannot be overwritten by attendance synchronization. They must be reconciled before clocking for that same employee/date. This preserves data and does not introduce multi-facility daily accounting.

The legacy applicant attendance route now resolves a tenant before finding the authenticated worker and filters all attendance reads/updates by tenant. Disabled accounts and suspended memberships are denied. The legacy admin Clock-ins reads/claim updates use the validated effective tenant, including view-as selection, and reject an absent tenant instead of reading across tenants. Its worker/profile lookup chunks also gained tenant filters. Legacy attendance continues to use its existing availability checks; new v1 edition gates are not silently retrofitted to block unclassified tenants from their old attendance interface.

## Atomic clock and review behavior

Clock transitions use a service-only, security-invoker function. Worker-level transaction locks serialize events, and event timestamps are assigned by the database after acquiring the lock. Client location timestamps never control worked time. Clock-in/out require finite coordinates, granted location permission, a location timestamp and request network information. Break actions do not require location. A staffing shift must be assigned to the worker in the same tenant and cover the work date. Scope checks reject foreign employees/facilities/departments/shifts. Clock-out closes an active break and stores its interval.

Attendance triggers update the daily row and weekly totals in the same transaction, including for the existing portal. A failure at any step rolls back the clock transition. Concurrent duplicate or invalid transitions return 409. Clock responses exclude raw IP and coordinates. Direct client mutations of attendance, daily entries and weekly sheets are revoked; writes go through scoped server handlers.

Workflow is `draft → submitted → approved` or `submitted → rejected → submitted`. Open sessions and incomplete clocked entries block submission. Submitted and approved periods reject changes to attendance or daily amounts; rejection reopens correction. Approval is final in this increment; there is no reopen-approved endpoint. Same-state retries are idempotent and do not rewrite review/audit data. Rejection notes are required. The database rechecks live account/membership and stored Scheduling Edit for reviewers. Transitions and v1 clock actions record tenant-tagged events in the existing `activity_log`, preserving review history across resubmissions.

List totals are calculated from the selected date/facility/department entries. `period_regular_minutes` and `period_overtime_minutes` retain the whole-week stored snapshot for comparison. The summary RPC aggregates all matching rows, not just the current page. Clock-ins includes historical hired employees, current overnight open sessions, and existing scheduled-block/session metrics; status filters affect records while summary cards retain the selected facility/department scope.

## Development validation

Migration: `20261116163842_clock_events_timesheet_workflow.sql` (UTC CLI timestamp). It was rehearsed with rollback, applied once, and verified against the actual catalog. Migration history was aligned with the local filename only after verifying persistence.

`supabase/tests/clock_events_timesheets.sql` passed against the persisted development schema. Checks cover location/ownership, foreign references, duplicate actions, break closure, daily regular/overtime calculation, automatic weekly linkage, forced daily-write rollback, open-session submission rejection, submitted/approved locks, reviewer grant revocation, self-review, rejection/resubmission, approval audit/idempotency, manual-entry protection, summaries, and denied direct Data API writes/RPC access.

The final related regression suite contains 74 passing tests, with lint and TypeScript checks. Fixture tenants and auth users were rolled back and follow-up checks found none remaining. The three original development tenants remain unclassified; new edition-gated APIs require explicit classification. Advisor counts are unchanged and there are no new findings for the added table/functions. No running HTTP server or browser end-to-end test was used.
