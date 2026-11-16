# Scheduling holidays and leave APIs

Implemented and applied to development project `mgucromvpnxntwyssltd` only. Production was not queried or changed during this increment. Existing development tenants remain unclassified; the v1 APIs return `EDITION_UNCLASSIFIED` until an administrator confirms their edition.

## Endpoints

| Endpoint | Contract |
| --- | --- |
| GET `/api/v1/schedules` | Required `date_from`, `date_to`; optional `facility_id`, `department_id`, `view=calendar\|list`, `page`, `limit`. |
| GET `/api/v1/schedules/who-is-off` | Required date range; optional facility, department, `off_type`, pagination. |
| GET `/api/v1/tenant-holidays` | Optional date range and pagination. |
| POST `/api/v1/tenant-holidays` | `{ name, holiday_date, is_paid }`. |
| POST `/api/v1/shifts` | FSD shift fields, including explicit `is_internal`, date range, optional facility/department/client/category/rate and people needed. |
| PATCH `/api/v1/shifts/{id}` | Partial shift fields; rejects tenant reassignment and empty patches. |
| POST `/api/v1/shifts/{id}/assignments` | Distinct `worker_ids`, optional assignment dates, `pay_rate`, `bill_rate`. Entire batch succeeds or fails together. |

All routes use existing Scheduling module grants. GET requires View; mutations require Edit. Tenant selection comes from the validated server session. All scoped table queries and relevant embedded lookups include tenant filters. Inserts use the resolved tenant. UUIDs, actual ISO calendar dates, nonnegative rates, date ordering and body fields are validated. Date-range reads are bounded to 366 days; list pagination defaults to 25 and caps at 100.

## Reused data and response shape

`GET /schedules` returns `shifts` from the existing staffing shift table, `employee_shifts` from the existing employee grid, `holidays`, and `time_off`. Each collection has its own total (`total`, `employee_shifts_total`, `holidays_total`, `time_off_total`). `page` and `limit` apply independently to each collection. Both view values return the same data contract for client rendering. Employee grid blocks include `is_internal=true`; their dates represent their existing grid work dates. Staffing shift spans and leave use inclusive date overlap.

The employee grid and legacy Who-is-off screen now share tenant-scoped query builders with v1. Shift creation extends the existing `createTenantShift` service, preserving legacy callers while v1 uses explicit internal/client semantics. The existing calendar's job-category lookup also gained its missing tenant filter.

Leave comes from existing effective `worker_time_off` blocks. Its worker IDs refer to `public.worker`; employee grid IDs refer to `public.workers`, as in the existing application. No artificial mapping between those identities was introduced. The November 17 worker-request increment now populates this source atomically on time-off approval, with a unique `source_request_id`. Pending and rejected requests are not included. See `fsd-worker-requests-api-2026-11-17.md`.

Who-is-off returns paginated `records` plus a separately paginated `holidays` collection and `holidays_total`. Holidays apply tenant-wide, including when a facility filter is used. They are not expanded into invented named employee absences. Existing leave types are Vacation, Sick Leave, Personal Leave, Training and Regular Off; `off_type=Holiday` selects only holidays.

## Edition and assignment rules

Internal shifts require `internal_scheduling` and do not accept a client. Client shifts require `manage_clients`; Staffing edition requires `client_id` for noninternal shifts. Disabling client management hides client IDs and excludes client shifts. Disabling internal scheduling excludes employee grid blocks and internal shifts. Bill-rate writes are forbidden when `bill_rates` is disabled, and responses omit that field.

Bulk assignment uses a service-only, security-invoker RPC. It locks the shift and affected workers, validates tenant ownership and date bounds, and inserts the batch atomically. Duplicate assignments return 409. When `multi_client_assignments` is disabled, overlapping assignments to different clients are rejected. New assignments use `public.worker.id`; the database guard retains support for legacy assignments that stored a worker's auth user ID.

The migration relaxes client/facility NOT NULL requirements for internal shifts, adds shift department/internal fields, assignment history/rate fields, and holidays. Tenant-validation triggers reject foreign clients, facilities, departments, categories, workers and shifts. Changing a shift's client/facility or shrinking its dates in conflict with assignments is rejected. Existing legacy shift rows are not rewritten. Direct Data API mutations of shifts, assignments and holidays are blocked so server feature/module checks remain authoritative.

## Verification

The migration was rehearsed with rollback, then applied once through Supabase MCP. Actual catalog checks confirmed the new schema persisted. `supabase/tests/fsd_scheduling_holidays.sql` passed again against the persisted development schema with real membership helpers. It covers atomic failure, duplicate and date rejection, cross-tenant references, overlapping multi-client restrictions, holiday/leave isolation and private RPC/direct-write boundaries. Fixture tenants and auth users were rolled back; follow-up checks found zero remaining test records. All three original development tenants remain unclassified.

Focused tests cover validation, routes, feature gating, tenant-scoped query construction, response fields and existing permission mappings. Lint and TypeScript are also checked. The advisor results contain no new findings for the added table/functions; existing unrelated advisory counts are unchanged.

Local environment variables point to production. They were left unchanged and were not used for HTTP requests. No HTTP/browser end-to-end test was performed; database tests explicitly target development through MCP. The broader migration audit from the preceding increment remains a historical snapshot, not a full-parity claim.
