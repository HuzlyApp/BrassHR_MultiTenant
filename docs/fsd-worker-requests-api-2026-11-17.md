# Worker requests and approval workflow

Implemented and applied to development project `mgucromvpnxntwyssltd` only on November 17, 2026, Manila time. Production was not queried or changed. Local environment settings still target production and were not used for live API requests.

## API contracts

| Endpoint | Behavior |
| --- | --- |
| GET `/api/v1/worker-requests` | Paginated requests, with optional `type`, `status`, `facility_id`, `department_id`, `date_from`, `date_to`. Date filters use inclusive overlap. |
| POST `/api/v1/worker-requests` | Creates a pending request with type, date range, reason, optional notes/facility/department/related shift. Staff must provide `worker_id`; workers default to their own linked profile and may only select profiles belonging to their authenticated identity in the resolved tenant. |
| POST `/api/v1/worker-requests/{id}/approve` | Approves a pending request; optional `{ notes }`. |
| POST `/api/v1/worker-requests/{id}/reject` | Rejects a pending request; optional `{ notes }`. |

Types are `time_off`, `schedule_change`, `time_adjustment`, and `other`. Time-off requests optionally accept an existing leave subtype (`off_type`); the default is Personal Leave. Dates must be actual ISO calendar dates and ordered. Default page size is 25, maximum 100. Request details, creator, tenant and review audit fields cannot be mass-assigned. Original request notes and reviewer notes are stored separately.

Workers can list and create only their own requests. Their tenant selection uses the existing portal slug/cookie/host reader and tenant resolver, then verifies a worker profile linked to the authenticated user within that tenant. Raw tenant UUID query parameters do not select scope. Disabled accounts and suspended memberships are denied. Workers linking a shift must already have an active assignment to it; they cannot override their profile department.

Staff access reuses Scheduling View/Edit grants and the existing scheduling context. GET needs View; creating or reviewing requests needs Edit. All scoped queries include tenant predicates. Parent references are also checked by database triggers. Request creation never creates effective leave.

## Review rules

The user confirmed that another reviewer is required for a staff member's own worker request. Both approval and rejection enforce this rule using the worker's linked auth user, not an untrusted submitted role or reviewer ID. Staff may review requests they created on behalf of other workers.

Review uses a service-only security-invoker RPC that locks the request and rechecks the actor's live account, membership and stored Scheduling Edit grant. The first decision moves a pending request to approved or rejected and records reviewer, timestamp and notes. Repeating the same decision returns the original review without changing its audit data. Trying the opposite decision after review returns 409. Foreign-tenant request IDs return 404; unauthorized or self-review returns 403.

Approving `time_off` creates a `worker_time_off` row in the same transaction, linked by `source_request_id`. The link is unique, tenant-validated and checked against the approved request's worker, dates, facility and leave type. Leave insertion failure rolls back the review. Pending/rejected requests and approved non-time-off requests do not create leave. Approval of schedule-change/time-adjustment requests records the review; applying actual shift or timesheet changes is a separate action, consistent with the FSD's status-update contract.

## Schedule integration

Schedules, v1 Who-is-off, and the existing recruiter Who-is-off screen reuse `tenantTimeOffQuery`. Its response now includes `source_request_id`, making approved request blocks traceable without combining separate leave stores or double-counting the same request. Existing manually recorded leave remains unchanged. Department filtering follows the existing shared query's current worker department; request lists use their stored department snapshot.

There is no cancellation/reopening endpoint in this FSD increment. Linked leave cannot be reassigned or edited to disagree with its source request. New request reads/writes and all review calls go through server handlers; direct authenticated Data API access to requests and leave mutations is denied.

## Applied schema and validation

The migration is `20261116162147_worker_requests_approval_workflow.sql`; its CLI timestamp is UTC. It adds the request table, immutable scope/transition checks, the service-only review RPC, and the effective leave source link. Migration history is aligned with the local filename after confirming the schema persisted. No past migration was edited.

The migration and regression script were first rehearsed in a rolled-back development transaction, then the migration was applied once and tests rerun on the persisted schema. `supabase/tests/worker_requests_workflow.sql` verifies tenant references, reviewer permissions, revoked grants/suspended memberships, self-review rejection, idempotency, terminal-state conflicts, linked leave integrity, pending/rejected invisibility and forced leave-insertion failure rollback. Existing scheduling SQL regressions also pass.

58 focused unit/route tests pass, including worker ownership, mass-assignment rejection, invalid filters, optional review bodies and reviewer injection. Lint and TypeScript are checked. Fixture tenants and auth users were rolled back; none remain. All three original development tenants remain unclassified, so edition-gated APIs still require explicit classification. Advisor counts are unchanged and there are no findings for the new request table/functions. No HTTP/browser end-to-end test was performed.
