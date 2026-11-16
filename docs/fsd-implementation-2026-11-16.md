# Data model expansion implementation review

Reviewed all three November 16 specifications against repository code and read-only Supabase MCP schema queries on development and production.

User decisions: extend the existing tenant role and module grant system; classify existing tenants before any edition backfill. The first review made no persistent database changes. The authorized follow-up applied the reviewed FSD prerequisites and feature migration to development only. Production remains unchanged.

## Implemented first increment

- GET `/api/v1/tenants/me/features`
- PATCH `/api/v1/tenants/me/edition`
- GET `/api/v1/admin/edition-features`
- PUT `/api/v1/tenants/me/feature-overrides/{feature_key}`
- Shared server feature guard, validation, tenant scoping, and fail-closed resolution.
- Migration for feature catalog, overrides, RLS, and security-invoker effective feature view.

The existing `tenant_categories.category` is the edition authority (`SMB` or `Staffing`), exposed as lowercase edition tokens. This deliberately avoids a second competing `tenants.edition` field. `tenant_categories.edition_set_at` records explicit classification. Existing rows remain unclassified; the feature endpoint returns 409 `EDITION_UNCLASSIFIED` until an authorized administrator classifies them. Subscription plan remains independent.

The existing company settings edit grant authorizes overrides. Edition changes additionally require the existing administrator role or god administrator. Existing module permissions remain authoritative; no atomic permissions or multiple-role assignments have been introduced.

Feature defaults are an initial conservative proposal: client management, bill rates, and multi-client assignments are Staffing only; internal scheduling, timesheets, and hiring pipeline are available in both; Hiring AI is off pending eligibility review. The FSD does not supply a complete default matrix. The companion SQL file and reference screenshots were not supplied. Validate these defaults before deployment.

This increment does not change existing navigation or retrofit feature guards into existing APIs. Those must be updated together after tenant classification to avoid disrupting current tenants. Signup category assignment also needs a policy for explicit classification versus automatic defaults before it populates the confirmation timestamp.

## Existing implementation and remaining gaps

| Area | Findings and next work |
| --- | --- |
| Editions | Feature catalog, overrides, and invoker view applied and tested in development. All three pre-existing development tenants remain unclassified. |
| Departments | Existing admin CRUD extended with v1 list/create/update/soft-delete, codes, tenant-safe parent hierarchy, pagination and active filtering. |
| RBAC | Existing grant system retained. `/api/v1/me/permissions` projects grants into feature-aware atomic keys. Role-template and role-assignment v1 contracts remain. |
| Scheduling | V1 schedules, holidays, who-is-off, shift create/update and atomic assignment APIs implemented and tested in development. Reuses existing staffing shifts, employee grid and effective leave blocks. See `fsd-scheduling-api-2026-11-16.md`. |
| Timesheets | Clock events, clock-ins, weekly list/detail and submit/approve/reject implemented and tested in development using existing attendance/daily entries. See `fsd-clock-timesheet-api-2026-11-17.md`. |
| Worker requests | V1 list/create/approve/reject implemented and tested in development. Approved time off atomically creates linked effective leave. See `fsd-worker-requests-api-2026-11-17.md`. |
| Workers | Existing profiles, documents, onboarding, and assignments. Work history and assignment field expansion need reconciliation. |
| Hiring | Existing requisitions and applicant APIs, including some v1 APIs. Audit filters, summary cards, edition-sensitive fields and client requirements. |
| Candidate portal | Existing applicant portal routes. Job alerts and full candidate v1 contracts remain. |
| Support | Existing tickets and messages. Department linkage and v1 contracts remain. |
| Industry/professions | Existing production catalogs; do not recreate them from the incomplete dump assumptions in the FSD. |

## Environment findings

`supabase/config.toml` identifies BrassHR_South as development and BrassHR as production. Development lacks many later tables/columns used by current code, including departments, tenant roles, and category infrastructure. Production contains departments, tenant roles/grants, industry/profession catalogs, employee scheduling/timesheet entries, and time off. Reconcile development migration history before testing new migrations there; do not blindly push the full migration directory.

Production has seven category records, all Staffing. The earlier category migration defaulted existing and new tenants to Staffing, so these are not reliable evidence of classification. Zipstaff has a client record; other tenants had no clients or shifts at inspection. This is supporting evidence only, not authorization to assign editions. No tenant backfill was performed.

## Validation

TypeScript passed. Focused unit tests cover feature resolution, classification, authorization, tenant scope and route permission mapping. SQL was executed in a separate validation schema in a development transaction, with fixture tenant/category tables and stub identity helpers, then rolled back. Assertions covered unclassified tenants, defaults, override precedence, cross-tenant visibility through the invoker view, and denied authenticated override writes. A follow-up catalog query confirmed the validation schema was removed. This validates the new SQL and policies in isolation, not an end-to-end deployment against the application's real membership helpers or full migration history.

## Development follow-up

Development now has the reviewed prerequisites: active membership/account columns, staff invitations and role catalogs, tenant role grants, categories, departments, employee schedule shifts and employee timesheet entries. The older platform-wide membership primary key was changed to `(user_id, tenant_id)`. Worker-reference tenant IDs were derived from their own worker records. Existing identity and role values were preserved.

The feature migration and department hierarchy were executed through `20261116145501_reconcile_fsd_dependencies.sql`. It groups the reviewed source changes and skips creation of tables already present. Internal seed-function grants were tightened by `20261116150317_fsd_internal_function_boundaries.sql`. Supabase's generated history timestamps were aligned with the local source filenames only after verification. Source migrations actually covered by the bundle were recorded in history; unrelated missing migrations were not marked applied.

The migration tool returned cancellation payloads with `isError=false` for several early requests. Those requests executed nothing. Actual schema checks, rather than that flag alone, were used to confirm the final applied changes. Remaining work was consolidated, redundant drops of nonexistent policies/triggers were removed, and the resulting migration was submitted once.

New API contracts:

- GET `/api/v1/me/permissions`: edition, tenant, current role and atomic permission keys derived from current stored module grants. Client-management, timesheet and hiring keys respect effective features. Worker sessions receive no invented staff permissions. Always-granted Help access does not imply ticket-management authority.
- GET `/api/v1/departments`: active departments by default, `include_inactive=true`, pagination and totals.
- POST `/api/v1/departments`: name, optional code/description/parent.
- PATCH `/api/v1/departments/{id}`: partial updates, including activation and parent changes.
- DELETE `/api/v1/departments/{id}`: soft deletion, preserving references.

Department APIs reuse the existing catalog and authorization. Company-settings grants remain authoritative; writes additionally retain the existing administrator restriction. Tenant IDs are server-resolved. Parent lookup, listing, updates, and related job-label updates include tenant filters. Inserts carry the authorized tenant. Database constraints reject cross-tenant parents; a tenant advisory lock and trigger reject cycles. Global permission/feature catalogs are deliberately not tenant-filtered.

The repeatable integration script `supabase/tests/edition_features_departments.sql` passed against the applied development schema using the real membership functions. It verifies unclassified tenants, defaults and overrides, foreign-tenant feature/override/department isolation, denied direct override writes, cross-tenant parent rejection, hierarchy cycles, suspended memberships, and private internal seed functions. Every test fixture was rolled back; follow-up queries confirmed zero leftover test tenants or auth users. All three original development tenants remain unclassified.

Final local checks: 34 focused tests passed; lint and TypeScript were checked. No running HTTP server or browser end-to-end test was used.

Broader historical migration parity is still outstanding. The audit at `docs/development-migration-audit-2026-11-16.json` records 351 local files and 144 remote history entries: 116 name/version matches, 17 matching names with different timestamps, and 218 local migration names absent from remote history. Absent history alone does not establish that every corresponding schema object is absent. Duplicate local timestamps and remote-only baseline/history entries are also recorded. Do not blanket-repair or push these without reviewing their actual schema effects.

Security advisors still report pre-existing issues elsewhere, including mutable function search paths and publicly callable legacy definer functions. Newly introduced internal seed functions were removed from API-client access. Relevant Supabase guidance: [function execution grants](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). These remaining findings are not a clean security audit or full development/production parity claim.
