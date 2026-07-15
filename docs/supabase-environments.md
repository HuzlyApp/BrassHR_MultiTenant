# Supabase Environments — BrassHR MultiTenant

## Current-state assignment

| Role | Project name | Project ref | Region | URL |
|------|--------------|-------------|--------|-----|
| **Development / Staging** | BrassHR_South | `mgucromvpnxntwyssltd` | ap-south-1 | `https://mgucromvpnxntwyssltd.supabase.co` |
| **Production** | BrassHR | `avhdoifnsnoeavqxnwwm` | us-east-1 | `https://avhdoifnsnoeavqxnwwm.supabase.co` |

### Why this split

Inspection (2026-07-14):

- **Production (`avhdo…`)**: ~5 tenants, ~45 workers, ~6 users — live recruiting data.
- **Development (`mguc…`)**: ~3 tenants, **0 workers**, 0 users — safe for localhost / Preview.

> **Action required:** Local `.env` was previously pointed at **production**. Point localhost at **development** only (see matrix below). Do not commit `.env`.

Legacy CLI link `hfjfxbhawzzylftvfdod` appears in `supabase/.temp/` / Claude MCP — treat as obsolete; do not use.

---

## Environment-variable matrix

| Variable | Localhost / Preview | Vercel Production | Client-visible? |
|----------|---------------------|-------------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Dev project URL (`mguc…`) | Prod project URL (`avhdo…`) | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dev anon / publishable | Prod anon / publishable | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev service role | Prod service role | **Never** |
| `SUPABASE_ACCESS_TOKEN` | Personal PAT (optional, Management API) | CI secret only | **Never** |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Optional aliases of the above | Same | Server aliases OK |

Vercel recommendation:

- **Preview** + **Development**: development project keys
- **Production**: production project keys only

---

## Automated schema flow (option A)

```text
PR opens ──► sanity CI (filenames / no secrets)
     │
     ▼
merge to main (migration paths) ──► GitHub Action pushes migrations
                                       to BrassHR_South (development)
     │
     ▼
Preview / localhost use South keys
     │
     ▼
Manual "production" workflow (typed confirm) ──► BrassHR (production)
```

### GitHub Actions secrets (Repo → Settings → Secrets)

| Secret | Value |
|--------|--------|
| `SUPABASE_ACCESS_TOKEN` | Personal access token from https://supabase.com/dashboard/account/tokens |
| `DEVELOPMENT_PROJECT_ID` | `mgucromvpnxntwyssltd` |
| `DEVELOPMENT_DB_PASSWORD` | Database password for BrassHR_South |
| `PRODUCTION_PROJECT_ID` | `avhdoifnsnoeavqxnwwm` |
| `PRODUCTION_DB_PASSWORD` | Database password for BrassHR |

Workflows:

- `.github/workflows/supabase-ci-validate.yml` — PR checks
- `.github/workflows/supabase-migrate-development.yml` — auto-push to South on `main` (and `develop`/`staging`) when migrations change
- `.github/workflows/supabase-migrate-production.yml` — **manual only**, requires typing `avhdoifnsnoeavqxnwwm`

### Vercel Preview → always South

In Vercel → Project → Settings → Environment Variables, set for **Preview** (and optionally **Development**):

| Name | Value source |
|------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://mgucromvpnxntwyssltd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | South anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | South service_role key |

Set the **Production** environment to BrassHR (`avhdo…`) keys only.

Redeploy previews after changing env vars.

---

## Schema drift monitoring (prod vs South)

Automation checks **structure only** (no copying of production rows/PII).

Full prod→staging policy (allowlists, RLS/Storage verify, reference-data sync): see [prod-to-staging-sync.md](./prod-to-staging-sync.md).

| Piece | Role |
|-------|------|
| `npm run supabase:check-drift` | Dump + compare `public` schema of BrassHR vs South |
| `.github/workflows/supabase-prod-to-staging-sync.yml` | Daily + post-merge; uploads reports; fails on drift |
| `npm run supabase:sync-reference-data` | Optional allowlisted reference rows only |
| Optional catch-up | Manual workflow input runs `db push` to South **after** migrations exist in the repo |

**Not automated (intentionally):** cloning production **data** into staging/development.

When drift is reported:

1. Inspect Actions artifacts `schema-prod-public.sql` vs `schema-dev-public.sql`
2. Add a migration under `supabase/migrations/` that brings South in line
3. Merge to `main` (auto-push to South) **or** re-run drift workflow with `apply_migrations_to_dev=true`

---

## Commands — link & migrate

### Development (safe to apply)

```bash
npx supabase login
npx supabase link --project-ref mgucromvpnxntwyssltd
npx supabase migration list
npx supabase db push
```

Or apply a single reviewed SQL file via MCP `apply_migration` with `project_id=mgucromvpnxntwyssltd`.

### Production (requires human confirmation)

```bash
# 1. Show target and wait for typed confirmation
node scripts/supabase-prod-migrate.mjs --plan

# 2. Only after typing the production ref:
node scripts/supabase-prod-migrate.mjs --apply --confirm-ref avhdoifnsnoeavqxnwwm
```

**Never** run `supabase db reset` against a remote project.
**Never** apply `supabase/seed.sql` or bootstrap seed scripts to production.

---

## MCP safety

Cursor `.cursor/mcp.json` historically pointed agents at production (`avhdo…`). Prefer:

```json
"url": "https://mcp.supabase.com/mcp?project_ref=mgucromvpnxntwyssltd"
```

for day-to-day agent work. Use production MCP only for read-only verification after explicit approval.

---

## Auth / Storage / Dashboard checklist (not in SQL migrations)

Configure separately per project in the Supabase Dashboard:

### Auth
- [ ] Site URL (dev: `http://localhost:3000`; prod: live domain)
- [ ] Redirect URLs (include all Preview hostnames if used)
- [ ] Email templates
- [ ] SMTP / custom SMTP
- [ ] OAuth providers (Google, etc.)
- [ ] JWT expiry / MFA settings

### Storage
- [ ] Buckets exist (worker uploads, logos, chat, support, staff photos, templates)
- [ ] Bucket public/private flags
- [ ] Storage RLS policies verified on both projects

### Edge Functions / Webhooks
- [ ] `resend-inbound` secrets (`SUPABASE_SERVICE_ROLE_KEY`, Resend secrets)
- [ ] Webhook signing secrets differ per environment
- [ ] Function URLs updated in third-party dashboards

### Misc
- [ ] Database webhooks
- [ ] Cron / scheduled jobs
- [ ] Custom domains

---

## Rollback

1. **App config:** restore previous URL/anon/service keys in Vercel (or `.env`) for the affected environment.
2. **Schema:** do **not** run reverse DROP unless a dedicated down migration exists. Prefer a new forward migration that restores the prior shape.
3. **Failed prod migrate:** leave production unchanged; fix migration on development first; re-run the confirmation script only after review.

---

## Verification checklist

- [ ] `node scripts/assert-supabase-env.mjs` passes on localhost (dev ref only)
- [ ] Production Vercel env shows `avhdo…` host only
- [ ] Creating a draft job on localhost does **not** appear in production `job_requisitions`
- [ ] Browser Network / bundle audit: no `service_role` JWT string
- [ ] RLS: tenant A staff cannot read tenant B rows
- [ ] Migration list reviewed for both projects after push
