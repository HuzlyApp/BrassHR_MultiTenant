# RLS Security Assessment

Generated: 2026-08-13

Catalog inspected via Supabase MCP against the connected development project. Destructive adversarial queries were **not** run against that hosted database. Live JWT attacks run only when `BRASSHR_RLS_TEST=1` points at **local Supabase** (`supabase start`) or a dedicated test project with `BRASSHR_RLS_ALLOW_REMOTE=1`.

```
RLS SECURITY ASSESSMENT

Tables inventoried (public, RLS tracked): 120+
Recruiting tables in the access matrix: 25
RPCs / SECURITY DEFINER helpers reviewed: 16
Storage buckets with policies: 4 (recruiter-template-documents, staff-profile-photos, worker_required_files, worker-resumes)
Edge Functions: 0 listed
Roles modeled: anon, unauthenticated-membership, admin, recruiter (client), worker

Critical (catalog-proven, patched in 20260813230000): 2
High (catalog-proven, partially patched or remaining): 6
Medium: 5
Low: 2
```

How to run:

```text
npm run test:rls
```

Live JWT suite (local only):

```text
$env:BRASSHR_RLS_TEST="1"
npm test -- lib/security/rls/adversarial.test.ts
```

SQL impersonation (local, rolls back):

```text
supabase db query --local -f supabase/tests/rls_adversarial.sql
```

---

## Ownership chains

```text
TABLE / RESOURCE                         RLS   TENANT SOURCE                         CLASS
------------------------------------------------------------------------------------------------
tenants                                  ON    tenants.id                            public-reference
users                                    ON    users.tenant_id + current_tenant_id() tenant-private
user_roles                               ON    user_roles.tenant_id                  deny-by-default (0 policies)
worker                                   ON    worker.tenant_id                      tenant-private
workers                                  ON    workers.tenant_id                     tenant-private
job_requisitions                         ON    job_requisitions.tenant_id            public-job + tenant-private
job_applications                         ON    job_applications.tenant_id            tenant-private
worker_notes                             ON    tenant_id + application_id            application-private
application_status_history               ON    tenant_id + application_id            application-private
application_statuses                     ON    tenant_id                             tenant-config
job_screening_questions                  ON    tenant_id + job_id                    public-job
application_screening_answers            ON    tenant_id + application_id            application-private
job_application_analysis_versions        ON    tenant_id + application_id            application-private
job_application_decisions                ON    tenant_id + application_id            application-private
job_application_verified_information     ON    tenant_id + application_id            application-private
job_application_ai_screening_answers     ON    tenant_id + application_id            application-private
interview_schedules                      ON    tenant_id + application_id            application-private
interview_attendees                      ON    tenant_id + interview_id              application-private
worker_resumes                           ON    tenant_id + worker_id                 sensitive
applicant_appointments                   ON    tenant_id                             deny-by-default (0 policies)
activity_logs                            ON    tenant_id                             deny-by-default (0 policies)
documents                                ON    tenant_id                             deny-by-default (0 policies)
default_workflow_migration_report        OFF   n/a                                   FLAG: RLS disabled
```

Helper functions (JWT identity, not client `tenant_id` claims):

- `user_is_tenant_staff(tenant_id)` — `user_roles` or `users.tenant_id` with role `admin`/`client` (recruiter).
- `user_is_tenant_admin(tenant_id)` — admin/owner or `god_admin`.
- `current_tenant_id()` — `users.tenant_id` for `auth.uid()` **LIMIT 1**. Unsafe for multi-membership.
- `worker_belongs_to_auth` / `worker_owns_record` — `worker.user_id = auth.uid()` with **no tenant predicate**.

Authorization does **not** read `raw_user_meta_data` / user-editable JWT metadata. `god_admin` is a `public.users` column.

---

## FINDING RLS-001

Severity: **Critical** (patched)

Resource: `change_job_application_status` (SECURITY DEFINER)

Attack: Anonymous or any PostgREST caller executes the RPC with known `tenant_b_id`, `application_b_id`, and `status_id`. The function trusted caller-supplied `p_tenant_id` and `p_changed_by_user_id`. Live grants included `anon`.

Expected: authorization denial.

Actual (pre-fix): function body had no `auth.uid()` check; `anon=X` on the function ACL.

Root cause: SECURITY DEFINER bypasses RLS. Original migration granted `service_role` only; live grants had drifted to include `anon`. Admin APIs already authorize via `requireStaffApiSession` then call this RPC with the service role.

Regression test: `rls_application_status_rpc_anon_denied` in `lib/security/rls/adversarial.test.ts`; static grant check in `policy-audit.test.ts`.

Fix: `supabase/migrations/20260813230000_rls_adversarial_hardening.sql`

- Deny `anon`.
- Require `user_is_tenant_staff` unless `auth.role() = service_role`.
- Ignore client `p_changed_by_user_id` for JWT callers; use `auth.uid()`.
- REVOKE EXECUTE from `anon` and `authenticated`; GRANT `service_role` only.

Why it blocks the attack: PostgREST anon/authenticated cannot execute the function. Even if grants drift, the body rejects `anon` and non-staff JWTs.

Retest: apply migration, then `BRASSHR_RLS_TEST=1` live suite.

---

## FINDING RLS-002

Severity: **Critical** (patched)

Resource: `worker_notes`, screening answers, interviews, analysis, decisions, verified info, AI screening answers, match requirements

Attack: Tenant A staff INSERT with `tenant_id = Tenant A` and `application_id = Tenant B application`. RLS `WITH CHECK` only called `user_is_tenant_staff(tenant_id)`. Foreign keys do not require matching tenants. Service-role APIs that load by `application_id` would then mix Tenant A rows onto Tenant B applications.

Expected: rejected.

Actual (pre-fix): no tenant-consistency trigger on these child tables.

Root cause: operation-specific RLS checked staff of the *declared* tenant, not ownership of the parent row.

Regression test: `rejects insert attaching Tenant A tenant_id to Tenant B application_id`.

Fix: `enforce_application_child_tenant` / `enforce_interview_child_tenant` / `enforce_job_child_tenant` plus tighter `WITH CHECK` on staff policies.

Why it blocks the attack: INSERT/UPDATE fail if parent `job_applications.tenant_id` (or worker/job/interview) does not match. Triggers also apply to service-role writes.

Retest: live INSERT spoof + SQL test.

---

## FINDING RLS-003

Severity: **High** (open)

Resource: `job_applications` policy `job_applications_self`

Attack: Worker JWT `select * from job_applications where id = own_application`. Row-level policy allows it. Columns include `ai_analysis`, scores, `recruiter_decision`, `recruiter_decision_note`, assignment.

Expected: workers cannot read internal analysis/decisions.

Actual: RLS is row-level only; applicants can read every column of their rows.

Root cause: no column privileges / applicant view.

Regression test: live worker SELECT of `ai_analysis` (will fail until a view or column GRANT split exists). Not patched here because staff JWT and applicant share the `authenticated` role; column REVOKE would break staff clients that are not service-role.

Recommended fix: applicant-safe view `WITH (security_invoker = true)` and stop granting SELECT on internal columns to applicant queries; keep admin APIs on service role (already the case for match-analysis).

---

## FINDING RLS-004

Severity: **High** (open, API hardened for résumés)

Resource: `worker_notes_worker_read`; résumé resolvers

Attack: Same worker, applications A1 and A2. Query notes by `worker_id` only. Worker policy `worker_owns_record(worker_id)` returns both applications' recruiter notes. Résumé PATCH used `job_application_id OR worker_id` + `limit(1)`, so correcting A1 could overwrite A2's file.

Expected: A1 load returns A1 only.

Actual: notes RLS is worker-scoped; résumé fallback leaked A2 into A1.

Fix applied for résumés: `pickResumeForApplication` — application-scoped only (`load-workspace.ts`, `resume-text/route.ts`).

Notes: product comment says workers may read recruiter notes in the portal. Application isolation for staff UI already passes `applicationId` into `loadWorkerNotesForWorkerId`. Remaining gap is direct PostgREST `worker_id` queries.

---

## FINDING RLS-005

Severity: **High** (open)

Resource: `current_tenant_id()`, `worker` policy `worker_own_session`, `worker_belongs_to_auth`

Attack: Same `auth.uid()` with worker rows in Tenant A and Tenant B. `user_id = auth.uid()` returns both. `current_tenant_id()` is a single `users.tenant_id`.

Expected: every operation still requires an explicit tenant membership/context.

Actual: several ALL policies key only off `current_tenant_id()` or `user_id`.

Not patched wholesale: changing `current_tenant_id()` would alter clients/facility/messages/shifts. Track as a follow-up to drive those tables onto `user_is_tenant_staff` / `user_roles`.

---

## FINDING RLS-006

Severity: **High** (documented, service-role IDOR)

Resource: Onboarding and worker APIs using `SUPABASE_SERVICE_ROLE_KEY`

Attack: Tenant A or anonymous caller sends Tenant B / other applicant UUIDs to a service-role route. RLS does not apply.

Expected: backend rejects before query.

Actual: June 2026 audit still applies. `lib/security/rls/service-role-boundary.test.ts` asserts admin job-application and appointment routes call `requireStaffApiSession`. Onboarding routes that accept `applicantId` remain a known class.

---

## FINDING RLS-007

Severity: **High** (open)

Resource: `job_requisitions_public_read`

Attack: Anon `SELECT * FROM job_requisitions WHERE status IN ('published','Published','Open')` without a public token.

Expected: public board fields only, token or slug scoped.

Actual: a broad status-only policy exists alongside token-based policies.

Do not change without product confirmation (public job board).

---

## FINDING RLS-008

Severity: **Medium** (patched)

Resource: `public.users` policy `users_update_own`

Attack: Recruiter JWT `UPDATE users SET god_admin = true, role = 'admin', tenant_id = tenant_b`.

Expected: rejected.

Actual (pre-fix): WITH CHECK was only `id = auth.uid()`.

Fix: trigger `protect_users_security_columns` — non-service-role cannot change `role`, `god_admin`, or `tenant_id`.

Regression test: `user cannot become god_admin or change tenant_id via users update`.

---

## FINDING RLS-009

Severity: **Medium** (patched)

Resource: `applicant_messages_insert_staff`

Attack: Live policy used tautology `w.tenant_id = w.tenant_id` (migration file already had the correct `w.tenant_id = tenant_id`).

Fix: recreate policy matching the migration (`w.tenant_id = applicant_messages.tenant_id`).

---

## FINDING RLS-010

Severity: **Medium** (open)

Resource: tables with RLS ON and **0 policies** (`user_roles`, `applicant_appointments`, `activity_logs`, `documents`, …)

Effect: PostgREST deny-by-default (good). All access is service-role. Every API must authorize. Calendar invitation routes already use `requireStaffApiSession`.

---

## FINDING RLS-011

Severity: **Medium** (open)

Resource: `tenants_public_select_active`

Attack: Anon lists every active tenant (names, slugs, branding columns exposed by GRANT).

May be required for host/slug resolution. Treat as tenant enumeration.

---

## FINDING RLS-012

Severity: **Low**

Resource: `signup_us_states` / `signup_us_cities` / `skill_questions` `USING (true)`

These are public reference data, not candidate PII.

---

## FINDING RLS-013

Severity: **Low / ops**

Resource: `public.default_workflow_migration_report` RLS disabled; materialized view `cached_timezone_names` has no RLS.

---

## Storage

Private buckets use path-prefix checks (`auth.uid()`, tenant UUID + `user_is_tenant_staff`, or `portal/{worker_id}`). `worker-resumes` is owner-only; staff downloads must go through an authorized signed-URL API (do not generate signed URLs from a client-supplied foreign path).

No Edge Functions were listed on the connected project.

---

## Access matrix (intended)

```text
RESOURCE              ROLE       OWN TENANT    OTHER TENANT
----------------------------------------------------------------
Jobs                  Admin      ALLOW         DENY
Jobs                  Recruiter  ALLOW         DENY
Workers               Admin      ALLOW         DENY
Workers               Recruiter  ALLOW         DENY
Applications          Recruiter  ALLOW         DENY
Notes                 Recruiter  ALLOW         DENY
Status History        Recruiter  READ          DENY
Candidate Statuses    Admin      WRITE         DENY
Candidate Statuses    Recruiter  READ          WRITE DENY
Screening Answers     Recruiter  ALLOW         DENY
Interviews            Recruiter  ALLOW         DENY
Analysis              Recruiter  ALLOW         DENY
Analysis              Worker     DENY*         DENY
Documents             Recruiter  ALLOW*        DENY
```

`DENY*` for worker analysis is the intended product rule; RLS-003 is the remaining gap.

---

## What this PR did not do

- Did not run INSERT/UPDATE/DELETE attacks against the hosted development project.
- Did not rewrite `current_tenant_id()` or all `tenant_isolation` ALL policies.
- Did not hide AI columns from applicant SELECT (needs an applicant view).
- Did not lock down public job listing policy without a product decision.
- Did not add RLS policies to deny-by-default tables (that would widen access).

Apply `20260813230000_rls_adversarial_hardening.sql` on local and any authorized non-production database, then run the live suite.
