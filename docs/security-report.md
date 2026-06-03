# Security Audit Report

Generated: 2026-06-03

## Executive summary

This audit reviewed Next.js route handlers, Supabase client usage, RLS metadata, storage/file upload paths, webhooks, secrets handling, rate limiting, middleware/headers, and dependency advisories.

Several production-blocking issues were found. Safe fixes were applied for rate limiting, webhook verification fail-closed behavior, legacy public paid API proxies, upload validation, security headers, secret scanning, and dependency upgrades. Remaining high-risk items are mostly architectural: public applicant onboarding endpoints still rely on user-supplied `applicantId` plus service-role writes, several sensitive document URLs are public, and Supabase RLS/function grants need a deliberate migration.

## Critical findings

### Local environment contains live-looking secrets

Status: not changed in code. Rotation recommended.

The local `.env` file is ignored by `.gitignore`, but it contains live-looking production credentials for Supabase service role, Zoho, XAI/Grok, Vercel, Resend, and Twilio. Values are intentionally not reproduced here.

Risk: any copy, terminal transcript, shared workspace, crash dump, or accidental upload of this file compromises production systems.

Recommended action: rotate all sensitive credentials currently present in local `.env`, especially `SUPABASE_SERVICE_ROLE_KEY`, Twilio auth token, Zoho secrets/refresh token, Vercel token, Resend key, and XAI/Grok key. Keep only local/dev credentials in developer `.env` files.

### Public applicant onboarding APIs use service role with user-supplied identifiers

Status: partially mitigated with rate limits and validation. Full auth/ownership redesign still required.

Affected examples include onboarding save/progress/upload/status routes that accept `applicantId` or similar IDs and then use `SUPABASE_SERVICE_ROLE_KEY`. Several routes validate format or resolve worker context, but the fundamental proof of ownership is not consistently server-side because applicant identity is often client-provided.

Risk: IDOR and cross-applicant data modification if an attacker learns or guesses another applicant UUID. Service role bypasses RLS, so database policies do not protect these paths.

Recommended action: require Supabase authenticated applicant sessions or signed continuation tokens for every applicant-scoped read/write; derive `applicantId` from the verified session/token, not request JSON.

### Tenant setup and management endpoints can still perform service-role writes without strong ownership proof

Status: unresolved, except OTP setup route was locked down.

Additional subagent review found unauthenticated or weakly-bound tenant setup paths such as tenant logo upload and tenant onboarding config save. These routes use service-role writes against tenant records and should not trust a raw `tenantId` from form data or JSON.

Risk: tenant branding/config takeover if an attacker obtains or guesses a tenant UUID during onboarding.

Recommended action: bind tenant setup routes to an authenticated signup/admin session or a short-lived tenant setup token; verify the session owns the `tenantId` before storage or config writes.

## High findings

### Webhooks could fail open when secrets were missing

Status: fixed.

`app/api/twilio/inbound/route.ts` previously accepted inbound webhooks if `TWILIO_AUTH_TOKEN` was missing. `supabase/functions/zoho-webhook/index.ts` previously accepted webhook payloads if neither shared-secret nor HMAC secret was configured.

Fix applied: both now fail closed by default. Unsigned webhooks require explicit non-production override flags.

### Legacy public signing and AI proxy routes lacked protection

Status: fixed for obvious legacy proxies; `verify-id` remains applicant-facing but constrained.

Applied fixes:

- `app/api/signeasy/route.ts`, `app/api/send-document/route.ts`, and `app/api/link/route.ts` now require staff auth and rate limits.
- `app/api/verify-id/route.ts` now rate-limits requests and only accepts HTTPS URLs hosted under the configured Supabase project host.

### Supabase OTP template setup route was publicly callable

Status: fixed.

`app/api/auth/setup-otp-template/route.ts` could previously call the Supabase Management API using `SUPABASE_ACCESS_TOKEN` without authentication. It is now disabled in production and requires god-admin authorization in non-production.

Recommended action: keep `SUPABASE_ACCESS_TOKEN` out of deployed app runtimes unless an operational route genuinely needs it.

### Staff worker-by-ID APIs need consistent tenant scope checks

Status: unresolved.

Subagent review found routes that load worker profile/checklist/recruiter bundles with service role after basic app authentication. Some use `canAccessWorkerRecord`, but that helper allows any staff role and does not by itself enforce `worker.tenant_id === staff.tenant_id`.

Risk: a recruiter/support user from one tenant may access another tenant's worker PII if they know a worker UUID.

Recommended action: update shared worker access helpers to require `resolveStaffTenantScope`; allow cross-tenant access only for god-admin with explicit view-as/all-tenants behavior and audit logging.

### Zoho status/document routes remain weakly protected

Status: unresolved.

Read-only subagents flagged `zoho-sign/status`, `zoho-sign/document`, and `zoho-sign/create-embedded-sign` as remaining sensitive routes. These can expose or mutate signing state and may proxy documents through server-side Zoho credentials.

Recommended action: require staff or applicant-bound signed-token authorization tied to the exact `request_id`/worker/applicant before returning status, creating signing sessions, or proxying documents.

### Missing broad API rate limiting

Status: partially fixed.

Added `lib/security/rate-limit.ts`, which uses Redis when configured and falls back to in-memory counters. Limits were added to auth OTP, email availability checks, worker search, upload routes, AI routes, address validation, Twilio inbound, and legacy signing routes.

Remaining action: add route-level limits to every write endpoint, especially tenant signup/onboarding, applicant progress, email sending, and document sync routes.

### Supabase security advisor warnings

Status: documented. No automatic DDL applied.

Supabase reports:

- `public.spatial_ref_sys` has RLS disabled.
- Many tables have RLS enabled but no policies, which currently deny direct client access. This is safe as a deny-by-default posture but indicates the app relies on service-role APIs for those tables.
- Several `SECURITY DEFINER` functions are executable by `anon` and/or `authenticated`, including `current_tenant_id`, `is_god_admin_user`, `seed_default_tenant_onboarding`, `user_is_tenant_staff`, and `worker_belongs_to_auth`.
- Leaked password protection is disabled in Supabase Auth.

Recommended action: move PostGIS extension objects out of exposed `public` schema where possible, enable RLS on `spatial_ref_sys` only with a deliberate policy, revoke unnecessary `EXECUTE` grants on security definer functions, and enable leaked password protection.

### Sensitive uploads can still be public

Status: partially mitigated with upload validation and rate limits.

`upload-required-file` returns a public URL for required worker documents. Identity, license, CPR, TB, and similar documents should be treated as private.

Recommended action: store sensitive applicant documents only in private buckets, return short-lived signed URLs after authorization checks, and remove `getPublicUrl` for sensitive files.

## Medium findings

### Email availability endpoints reveal account state

Status: rate-limited, not fully changed.

Signup/onboarding email checks still return availability or duplicate/resume states for product UX. Rate limits reduce abuse, but the response semantics can still support enumeration.

Recommended action: consider generic responses and move detailed availability handling behind verified signup/session flow.

### CSP is present but permissive

Status: partially fixed.

Security headers were added in `next.config.ts`, including CSP, frame controls, referrer policy, and content type sniffing protection. The CSP currently allows inline scripts/styles and eval because a strict policy could break the current Next/app setup.

Recommended action: move toward nonce-based CSP and remove `unsafe-inline`/`unsafe-eval` after testing.

### Dependency audit still reports Next/PostCSS advisory

Status: partially fixed.

`npm audit fix` plus explicit upgrades reduced the audit from 18 advisories to 2 moderate advisories. The remaining advisory is Next's nested `postcss`; npm suggests a breaking downgrade path, so no forced downgrade was applied.

Recommended action: monitor and upgrade to a Next release whose dependency tree resolves the nested PostCSS advisory.

## Fixes applied

- Added Redis-backed/in-memory rate limiter: `lib/security/rate-limit.ts`.
- Added rate limiter tests: `lib/security/rate-limit.test.ts`.
- Added rate limits to auth, email-check, search, upload, AI, address, webhook, and signing routes.
- Added file size/type validation for resume and required-file uploads.
- Made Twilio and Zoho webhook verification fail closed unless a local-only unsigned override is explicitly set.
- Disabled the Supabase OTP template setup route in production and made it god-admin-only outside production.
- Protected legacy SignEasy proxy routes with staff auth.
- Restricted `verify-id` image URLs to the configured Supabase host.
- Added security headers in `next.config.ts`.
- Added `.env.example` with public vs server-only variable guidance.
- Added redacting secret scanner: `scripts/security-scan.mjs`.
- Added npm scripts: `security:secrets`, `security:audit`, `security:check`.
- Upgraded dependencies where npm allowed safe/latest updates.

## Automated checks

Commands run:

```bash
npm run security:secrets
npm audit --audit-level=moderate
npm test -- lib/security/rate-limit.test.ts lib/cache.test.ts
npx tsc --noEmit
```

Results:

- Secret scan: passed; no high-confidence hardcoded secrets in scanned source files.
- Tests: passed.
- TypeScript: passed.
- Linter diagnostics on changed files: no errors.
- Dependency audit: still reports 2 moderate advisories for Next's nested PostCSS dependency.

## Recommended production checklist

- Rotate all live-looking local `.env` secrets.
- Replace applicant `applicantId` trust with verified sessions or signed continuation tokens.
- Move sensitive uploads to private buckets and serve only signed URLs after authorization.
- Add RLS migrations to revoke anonymous/public access from security definer functions that do not need RPC exposure.
- Enable Supabase leaked password protection.
- Add API authorization tests for admin-only routes, tenant isolation, applicant IDOR attempts, and rate limiting.
- Add CI jobs for `npm run security:secrets`, `npm audit`, TypeScript, and targeted auth tests.
