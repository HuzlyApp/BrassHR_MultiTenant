---
name: RBAC-security-admin-recruiter
overview: Fully enforce RBAC for Worker vs Recruiter/Support/Admin across all API routes and admin_recruiter UI, eliminate service-role security holes, validate inputs, lock down sensitive documents (SSN/DL/resumes), and add durable audit logging via a new `activity_log` table with server-side inserts.
todos:
  - id: rbac-helpers
    content: Add shared Supabase session + role guard helpers (`requireUser`, `requireRole`, `requireSelf`) using SSR Supabase client.
    status: completed
  - id: gate-admin-apis
    content: Require auth + role on admin/service-role APIs (`/api/admin/*`, `/api/workers`, etc.) and add UUID + Zod validation.
    status: completed
  - id: gate-onboarding-apis
    content: Require auth + self-only authorization on onboarding APIs; validate payloads and cap sizes.
    status: completed
  - id: sensitive-docs
    content: Restrict sensitive document URLs/signed URL issuance by role; add logging for access/issuance.
    status: completed
  - id: activity-log
    content: Add `activity_log` migration + server helper and emit audit logs for every privileged/sensitive action.
    status: completed
  - id: verify
    content: Run a security verification checklist (unauth/forbidden/self-only checks) and ensure failures are fail-closed.
    status: completed
isProject: false
---

## Scope
- **RBAC source of truth**: Supabase Auth `user.app_metadata.role` (per your selection).
- **Audit logging**: add a new DB table via migration and write to it on every privileged/sensitive action.

## Current risk summary (what we must fix)
- Multiple `app/api/*` endpoints use `SUPABASE_SERVICE_ROLE_KEY` (RLS bypass) **without authenticating or authorizing the caller**, including `app/api/workers/route.ts` and `app/api/admin/worker-profile/route.ts` (PII + signed URLs).
- Onboarding endpoints accept `applicantId` and read/write worker data **without verifying** it matches the authenticated user.
- No repo-managed RLS policies; most protection currently depends on server routes, but server routes are not gated.

## RBAC model (JWT claims)
- Roles (string): `worker`, `recruiter`, `support`, `admin`, `super_admin`.
- Enforcement strategy:
  - **Admin/recruiter UI pages**: require authenticated session + role in {recruiter,support,admin,super_admin}.
  - **Worker onboarding APIs**: require authenticated session and **`user.id === applicantId`**.
  - **Admin APIs** (service-role reads/writes): require authenticated session + role in {support,admin,super_admin} (optionally allow recruiter for non-sensitive views).
  - **Sensitive document access**: further restrict endpoints that mint signed URLs or return SSN/DL paths.

## Implementation steps
- **Add shared auth helpers**
  - Create `lib/auth/require-user.ts` and `lib/auth/require-role.ts`.
  - Use `lib/supabase/server.ts` SSR client to call `auth.getUser()` and read `user.app_metadata.role`.
  - Provide helpers:
    - `requireUser()` → returns user or throws 401
    - `requireRole(allowedRoles)` → throws 403
    - `requireSelf(applicantId)` → enforces `user.id === applicantId`

- **Lock down API routes (priority order)**
  - **Admin data exfiltration blockers**
    - Update `app/api/admin/worker-profile/route.ts` to require role (support/admin/super_admin) and validate `workerId` as UUID.
    - Update `app/api/admin/worker-checklist/route.ts` similarly.
    - Update `app/api/workers/route.ts` to require recruiter/support/admin roles for list views; optionally allow workers to only read themselves (if needed).
  - **Onboarding mutation endpoints**
    - Update `app/api/onboarding/save-worker/route.ts`, `app/api/onboarding/worker-documents/route.ts`, `app/api/onboarding/worker-requirements/route.ts`, `app/api/onboarding/skill-assessments-progress/route.ts`:
      - Require auth, enforce `requireSelf(applicantId)`.
      - Validate inputs with Zod (UUID, email/phone, URL/path formats, max lengths).
  - **External-integrations abuse prevention**
    - Gate `app/api/upload-resume/route.ts`, `app/api/parse-resume/route.ts`, `app/api/process-resume/route.ts`, `app/api/verify-id/route.ts`, DocuSign/SignEasy/Zoho routes:
      - Require auth.
      - For worker-facing: self-only.
      - For admin-facing: role-only.
      - Add size limits and basic rate/abuse guardrails (payload caps, allowed origins if applicable).
  - **Remove insecure “anon fallback” behaviors**
    - In routes that currently “try service role then anon”, make behavior explicit: if service role is required for the route’s purpose, fail closed.

- **Admin recruiter UI route gating**
  - Add a server-side gate in `app/admin_recruiter/layout.tsx` (or a `loading.tsx` + server component wrapper) that:
    - Uses SSR Supabase client to read session.
    - Redirects/returns 401-ish UI when not authorized.
  - Ensure client-only pages don’t leak data by calling privileged APIs without auth; once APIs are gated, the UI will naturally fail closed.

- **Sensitive data handling**
  - In `app/api/admin/worker-profile/route.ts`:
    - Do not return raw SSN/DL URLs unless role is admin/super_admin.
    - For signed URLs (resume, docs): mint only for authorized roles and log issuance.
    - Normalize storage object keys (already present) but validate bucket/path and prevent path traversal-like keys.

- **Add `activity_log` migration + logging helper**
  - Add new migration file under `supabase/migrations/` creating `public.activity_log`:
    - Columns: `id uuid default gen_random_uuid()`, `created_at timestamptz default now()`, `actor_user_id uuid`, `actor_role text`, `action text`, `entity_type text`, `entity_id uuid`, `metadata jsonb`.
    - Indexes: `(entity_type, entity_id, created_at desc)`, `(actor_user_id, created_at desc)`.
  - Add `lib/activity-log.ts` server helper:
    - `logActivity({ actor, action, entity, metadata })` using service role.
  - Insert logs in every privileged server route:
    - Worker profile updates
    - Document uploads/updates
    - Signed URL issuance
    - Status transitions (new/pending/approved/disapproved)
    - Role changes (e.g. onboarding complete)

## Verification
- Add minimal request-time tests via manual curl checklist (documented):
  - Unauthed calls to admin routes return 401.
  - Wrong-role calls return 403.
  - Worker cannot access another `applicantId`.
  - Recruiter can list new applicants but cannot fetch SSN/DL URLs.
  - Audit log rows are created for each action.

## Files likely to change
- API routes:
  - `app/api/workers/route.ts`
  - `app/api/admin/worker-profile/route.ts`
  - `app/api/admin/worker-checklist/route.ts`
  - `app/api/onboarding/save-worker/route.ts`
  - `app/api/onboarding/worker-documents/route.ts`
  - `app/api/onboarding/worker-requirements/route.ts`
  - `app/api/upload-resume/route.ts`
  - Integration routes (DocuSign/SignEasy/Zoho/xAI): `app/api/**/route.ts`
- New libs:
  - `lib/auth/require-user.ts`
  - `lib/auth/require-role.ts`
  - `lib/activity-log.ts`
- UI gate:
  - `app/admin_recruiter/layout.tsx`
- DB migration:
  - `supabase/migrations/*_create_activity_log.sql`
