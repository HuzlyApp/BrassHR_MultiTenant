# Production → Staging Synchronization

One-way only:

```text
Supabase prod (BrassHR / avhdoifnsnoeavqxnwwm)
    ↓
Supabase staging (BrassHR_South / mgucromvpnxntwyssltd)
```

Never reverse-sync staging rows, Auth users, Storage objects, or schema dumps into production.

## What syncs automatically

| Area | Auto? | Mechanism |
|------|-------|-----------|
| DB structure (tables, indexes, functions, triggers, enums, …) | Yes | Committed `supabase/migrations` → staging on merge |
| RLS enablement + policies | Via migrations | `supabase:verify-rls` compares prod vs staging |
| Storage **bucket config** | Manual/create on staging; verified in CI | `supabase:verify-storage` — **objects never copied** |
| Auth **configuration** | Dashboard / config parity (manual) | Do not sync production users |
| Edge Function **source** | Same repo deploys | Separate secrets per environment |
| Allowlisted reference **rows** | Optional | `supabase:sync-reference-data` |
| Customer / applicant / worker / payments / Auth / documents | **Never** | Schema-only |

## Expected migration flow

```text
Approved migration
    ↓
Apply to staging (CI on merge)
    ↓
Run tests / Preview on South
    ↓
Apply to prod (manual gated workflow)
    ↓
Verify prod
    ↓
Confirm staging ↔ prod schema alignment (drift check)
```

If production has schema not in the repo:

1. Detect drift (`supabase:check-drift`)
2. Generate a forward migration (do not dump-restore destructively)
3. Review for DROP / type-change / RLS-disable
4. Commit → apply staging → validate → gated prod

## npm commands

```bash
npm run supabase:check-drift
npm run supabase:sync-schema              # dry-run plan
npm run supabase:sync-schema -- --apply   # push migrations to staging
npm run supabase:sync-reference-data      # dry-run allowlisted rows
npm run supabase:sync-reference-data -- --apply
npm run supabase:verify-rls
npm run supabase:verify-storage
npm run supabase:sanitized-refresh        # plan only; never auto-deploys data
```

All commands assert **source = production** and **destination = staging** and exit if the direction is reversed.

Dry-run is the default for apply-capable sync scripts.

## Allowlist (Category 2 reference data)

Defined in `scripts/supabase-sync/config.mjs` as `PROD_TO_STAGING_DATA_SYNC_ALLOWLIST`.

Only those tables may receive row upserts from prod. Truncate+replace is limited to `REPLACEABLE_REFERENCE_TABLES`.

Category 1 examples (`SCHEMA_ONLY_TABLES`) never sync rows: tenants, users, workers, agreements, OTP, etc.

## Storage

- Sync bucket names / public flag / policies via migrations or dashboard parity.
- Do **not** copy production objects (resumes, IDs, agreements, photos).
- Optional future object sync must use `STORAGE_OBJECT_SYNC_ALLOWLIST` path prefixes only — never whole buckets.

## Auth & Edge Functions

- Sync providers, templates, redirects, expiry settings as configuration — not users, hashes, sessions, MFA, or OAuth identities.
- Deploy the same function source; use staging secrets separately from production.

## Sanitized staging refresh

`npm run supabase:sanitized-refresh` documents the manual checklist. It **must never** run automatically on deploy. Prefer synthetic seeds (`scripts/bootstrap-multi-tenant-seed.mjs`) over cloning production PII.

## CI workflows

| Workflow | Role |
|----------|------|
| `supabase-migrate-development.yml` | Push migrations → staging on merge |
| `supabase-prod-to-staging-sync.yml` | Daily + post-merge drift / RLS reports |
| `supabase-reference-data-sync.yml` | Manual / weekly allowlisted reference data |
| `supabase-migrate-production.yml` | Manual gated prod migrate |
| `supabase-schema-drift.yml` | Legacy manual drift alias |

### Extra secrets (optional)

Existing: `SUPABASE_ACCESS_TOKEN`, `PRODUCTION_*`, `DEVELOPMENT_*`.

Aliases accepted: `STAGING_PROJECT_ID`, `STAGING_DB_PASSWORD`, `STAGING_SERVICE_ROLE_KEY`.

For reference-data / storage verify:

| Secret | Purpose |
|--------|---------|
| `PRODUCTION_SERVICE_ROLE_KEY` | Read allowlisted tables / list buckets from prod |
| `STAGING_SERVICE_ROLE_KEY` or `DEVELOPMENT_SERVICE_ROLE_KEY` | Write staging upserts / list staging buckets |
| `APPLY_REFERENCE_DATA_SYNC` | Set to `true` only if weekly schedule may apply (default dry-run) |

## Sync report fields

Each command writes under `reports/` (gitignored):

- Execution date, source/destination refs
- Migrations / tables / RLS / Storage compared
- Inserted / updated / skipped counts (reference data)
- Warnings, failed validations, manual actions required

## Safety checks (built-in)

- Source must be production ref; destination must be staging ref
- Refs must differ; never write sync into production
- Unlisted tables refused for data sync
- Destructive SQL in migrations blocks `sync-schema --apply` unless `--allow-destructive`
- No Auth user sync; no blind Storage object sync
