# BrassHR MultiTenant — Agent Guide

## What this product is
Multi-tenant healthcare HR, recruiting, and workforce management platform. Handles job distribution, applicant intake, compliance onboarding, attendance tracking, and multi-tenant admin operations.

## Stack
- Framework: Next.js 16 (App Router), React 19, TypeScript
- Styling: Tailwind CSS v4, Radix UI, Lucide React, Framer Motion
- Backend / DB: Supabase (PostgreSQL, Auth, RLS, migrations in `supabase/migrations`)
- Cache: Redis / Upstash (`lib/cache.ts`, `lib/cache-keys.ts`)
- Testing: Vitest (`vitest.config.mts`), Testing Library
- Third-Party: Resend (email), Twilio (SMS), Mapbox (geo), Firma (e-signatures)

## Repo map
- `app/` — App Router layouts, pages, and route handlers (`app/api/`)
- `lib/` — Domain logic, auth session helpers, DB clients, and utilities
- `supabase/` — Migrations (`supabase/migrations/`), seed files, and DB configs
- `public/` — Static assets, icons, and branding media
- `scripts/` — Performance benchmarks, security audits, and setup utilities
- `docs/` — Architecture documentation and domain guides

## App route areas
- God Admin (`app/godadmin/`) — Super-admin platform controls, tenant catalogs, view-as-tenant
- Tenant Admin / Recruiter (`app/admin_recruiter/`, `app/braas-hr/`) — Tenant dashboard, job requisitions, candidate pipeline, shifts, attendance, messaging
- Applicant Portal (`app/application/`, `app/apply/`) — Multi-step job applicant flow, document uploads, skill quizzes, e-signing
- Worker Onboarding (`app/worker-onboarding/`, `app/worker-signin/`) — Post-hire worker intake, portal login, credentials review
- Public Job Board (`app/jobs/`) — Public job listings (`app/jobs/[token]`), applicant routing
- Tenant Signup (`app/tenant-onboarding/`) — New company registration, branding customizer, setup wizard
- E-Signing (`app/signing/`, `app/firma-signing-assets/`) — Embedded document signing workflows

## Where logic lives
- Tenant management: `lib/tenant/` (resolution, vanity hostnames, branding cache)
- Auth & permissions: `lib/auth/` (roles, session cookies, staff scoping, OTP)
- Database clients: `lib/supabase/` (`server.ts` SSR client, `service-role.ts` elevated client)
- Onboarding & pipelines: `lib/onboarding/`, `lib/candidates/`, `lib/workers/`
- Jobs & applications: `lib/jobs/`, `lib/admin/` (application sorting, routing)
- Time & attendance: `lib/attendance/`, `lib/shifts/` (scheduling, geolocation)
- Communication: `lib/messaging/`, `lib/email/`, `lib/email-templates/`
- E-signatures: `lib/e-signature/`, `lib/firma/`
- Caching layer: `lib/cache.ts`, `lib/cache-keys.ts`, `lib/redis-timeout.ts`

## Multi-tenant rules
- Tenant resolution: Derived via subdomain, query param `?tenant=`, or cookie `onboarding_tenant_slug` (`lib/tenant/resolve-tenant-context.ts`, `lib/tenant/tenant-host-resolution.ts`).
- Route link preservation: Use `withTenant(path, tenant)` (`lib/tenant/with-tenant.ts`) to maintain tenant context across applicant routes.
- Server scoping: Authenticate and resolve tenant scope via `requireStaffApiSession()` (`lib/auth/api-session.ts`) and `resolveEffectiveAdminTenantId()` (`lib/email-templates/resolve-effective-tenant.ts`).
- Data isolation: Always scope queries by `tenant_id` (`.eq('tenant_id', tenantId)`). Never trust raw client-provided tenant IDs without server validation.

## Data & backend
- Supabase SSR Client: `createClient()` in `lib/supabase/server.ts` (scoped to user session cookies).
- Service Role Client: `createServiceRoleClient()` in `lib/supabase/service-role.ts` (server-only bypass for elevated tasks).
- Migrations: Timestamped SQL files in `supabase/migrations/`.
- Caching: Upstash Redis accessed via `lib/cache.ts`. Use `buildCacheKey()` and invalidate on state mutations.
- Route handler pattern (`app/api/**/route.ts`):
  1. Validate auth: `const auth = await requireStaffApiSession();`
  2. Scope tenant: `const tenantId = await resolveEffectiveAdminTenantId(sb, auth);`
  3. Validate input with Zod (`lib/validation/`)
  4. Query Supabase with `.eq('tenant_id', tenantId)`
  5. Return `NextResponse.json(...)`

## Commands
- `npm run dev` — Start Next.js development server (`next dev --webpack`)
- `npm test` — Run Vitest suite (`vitest run --config vitest.config.mts`)
- `npm run test:watch` — Run Vitest in interactive watch mode
- `npm run test:rls` — Run database RLS security test suite
- `npm run lint` — Run ESLint check

## Agent working rules
- Prefer smallest change; match existing patterns
- New chat task = touch only relevant feature folders
- Always respect tenant isolation / RLS assumptions
- Never commit secrets (.env, keys)
- Prefer editing existing modules over creating parallel systems
- For UI: match existing components in app/components and feature folders

## Do not
- Do not query Supabase tables without `tenant_id` filters in tenant-scoped flows.
- Do not import `createServiceRoleClient` or `@/lib/supabase/service-role` into client components (`"use client"`).
- Do not create duplicate helper utilities when one already exists in `lib/`.
- Do not hardcode API keys, secrets, or default tenant UUIDs.
- Do not modify past migration files in `supabase/migrations/`; always create new migrations.
- Do not add new CSS frameworks or state libraries; stick to Tailwind CSS and existing React Query / context patterns.
