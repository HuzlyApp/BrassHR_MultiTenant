# Production safety: code branch + database migrations

This document explains how BrassHR protects **production code** (`main`) and the **production Supabase database** from accidental or unreviewed changes.

Repo: [HuzlyApp/BrassHR_MultiTenant](https://github.com/HuzlyApp/BrassHR_MultiTenant/)

---

## Why this exists

We have two separate environments and two separate Supabase projects:

| Layer | Staging | Production |
|---|---|---|
| Git branch | `staging` (and feature branches) | `main` |
| Database | Staging Supabase project | Production Supabase project (`avhdoifnsnoeavqxnwwm`) |

**Problem before:** a developer could apply a migration directly on prod (CLI / dashboard / MCP) by mistake, even when code review was required for `main`.

**Goal:**  
1. No unreviewed code into prod branch  
2. No unnecessary / unapproved schema changes on prod database  
3. Clear audit trail + email when prod migrations run  

---

## Two security layers (both required)

```text
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — Prod branch code (already configured)            │
│  GitHub Ruleset on main: at least 1 approval before merge   │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2 — Prod database schema (added with this work)      │
│  GitHub Action + Environment approval + email notify        │
└─────────────────────────────────────────────────────────────┘
```

Important:

- Approving a PR into `main` protects **code only**
- It does **not** automatically change the prod database
- Prod DB changes require a **second** human approval via GitHub Actions Environment

---

## Layer 1 — Already done: prod branch ruleset

### What we already have

On GitHub for this repo, a **ruleset** is defined so that:

- Nobody can merge a PR into **`main`** (prod branch) without **at least one approval**
- Feature / staging work must go through PR review before it becomes production code

### What this protects

| Protected | Not protected by ruleset alone |
|---|---|
| Unreviewed code landing on `main` | Direct SQL on prod Supabase |
| Accidental force-merge without review* | CLI `db push` to prod by a person with DB access |
| Shipping migration **files** without review | Applying those SQL files to the live prod DB |

\*Exact bypass rules depend on your ruleset admin exceptions.

### Flow for prod code

```text
Developer branch
    → Open PR into main
    → Email sent to app@huzly.com and dan@zipstaff.com (PR Main Review Notify)
    → Reviewer opens PR link → clicks Approve on GitHub (ruleset)
    → Merge allowed into main
    → Production app code can deploy (e.g. Vercel from main)
```

Workflow: `.github/workflows/pr-main-review-notify.yml`  
Script: `scripts/pr-main-review-notify.mjs`

This is **already working** for branch protection (ruleset). The email notify runs after these files are on GitHub.

---

## Layer 2 — Added: prod database migration safety

### What we added in the repo

| File | Purpose |
|---|---|
| `.github/workflows/migrate-staging.yml` | Manual, controlled apply to **staging** DB |
| `.github/workflows/migrate-prod.yml` | Plan → human approve → apply to **prod** DB → email |
| `.github/workflows/pr-main-review-notify.yml` | Email reviewers when a PR is opened into `main` |
| `scripts/summarize-migrations.mjs` | Builds a human-readable summary of schema changes |
| `scripts/migration-notify.mjs` | Sends email via Resend after migrate success/failure |
| `scripts/pr-main-review-notify.mjs` | Sends PR review request email for `main` |
| `package.json` | Helper scripts `db:migrate:summary` / `db:migrate:notify` |

### What this protects

| Protected | How |
|---|---|
| Accidental prod migrate from a laptop “by forget” | Prod apply path is CI + Environment approval |
| Applying unreviewed SQL | Migration files should already be on `main` via Layer 1 |
| Applying to prod before staging | Prod workflow can require staging parity check |
| Silent prod schema changes | Email sent to org recipients with summary |
| No visibility of what changed | Summary lists tables / columns / policies / functions / etc. |

### GitHub secrets (configured in repo Actions secrets)

| Secret | Purpose |
|---|---|
| `SUPABASE_DB_URL_STAGING` | Staging database connection for migrate + parity check |
| `SUPABASE_DB_URL_PROD` | Production database connection (CI only) |
| `RESEND_API_KEY` | Send notification emails |
| `MIGRATION_NOTIFY_TO` | Who receives emails (comma-separated) |
| `MIGRATION_NOTIFY_FROM` | Optional verified From address |

**Configured notify recipients:**

- `app@huzly.com`
- `dan@zipstaff.com`

Set `MIGRATION_NOTIFY_TO` to:

```text
app@huzly.com,dan@zipstaff.com
```

Secrets stay in GitHub Settings — **never commit** them to the repo.

### Still required in GitHub Environments

1. Create Environment named `staging`
2. Create Environment named `production`
3. On `production`, enable **Required reviewers** (1–2 DB owners)

Without Required reviewers on `production`, the approve step is weaker.

---

## End-to-end secure flow

### A) Staging (safe place to test schema)

```text
1. Developer adds file under supabase/migrations/
2. PR reviewed / merged as needed
3. Actions → "Migrate Staging Supabase" → Run workflow
4. CI applies to staging DB
5. Email sent (if notify secrets set)
6. Team verifies app on staging
```

### B) Production code (`main`) — Layer 1

```text
1. PR into main is opened (includes migration SQL file if schema change)
2. Email sent to app@huzly.com and dan@zipstaff.com with PR link
3. Reviewer opens link → clicks Approve on GitHub (ruleset)
4. Merge into main
5. App deploy can follow (Vercel, etc.)
6. Prod DB is still UNCHANGED at this point
```

### C) Production database — Layer 2

```text
1. Confirm staging already has the migration and app is healthy
2. Actions → "Migrate Production Supabase" → Run workflow
3. Type confirmation: migrate-production
4. plan job prints migration summary (no DB write yet)
5. apply job pauses for Environment "production" approval
6. Designated person clicks "Approve deployments"
7. CI applies migrations to prod Supabase
8. AFTER apply, email sent to app@huzly.com and dan@zipstaff.com with:
   - environment = production
   - status = success/failed
   - who triggered
   - commit SHA + Actions run URL
   - migration file summary (tables/columns/policies/…)
```

---

## How this avoids unnecessary prod migrations

| Risk | Control |
|---|---|
| Random merge into prod branch | Ruleset: approval required for `main` |
| Merge SQL file but forget staging test | Prod workflow staging parity check |
| Someone runs migrate on prod by habit | Prod path is manual Action + typed confirm + Environment approve |
| Wrong reviewer / no accountability | Required reviewers + email audit |
| Nobody knows what changed | Summary script + email body |
| Secrets leaked in git | Secrets only in GitHub Actions secrets |

### Team rule (recommended)

1. Developers may migrate **staging** via Action (or staging-only access)
2. Developers must **not** use prod DB password / dashboard SQL for routine work
3. Prod DB changes only through **Migrate Production Supabase**
4. Break-glass prod SQL only by designated owners, then notify the same email list

---

## Day-to-day checklist

### Before touching prod DB

- [ ] Migration file reviewed and merged to `main` (ruleset approval done)
- [ ] Same migration applied and tested on staging
- [ ] App behavior verified on staging
- [ ] Prod migrate Action run by authorized person
- [ ] Environment approver reviewed summary and approved
- [ ] Org email received for success/failure

### After prod migrate

- [ ] Spot-check critical prod flows
- [ ] Keep Actions run link in release notes / Slack if needed

---

## Local helper commands

```bash
npm run db:migrate:summary
node scripts/summarize-migrations.mjs --json
node scripts/summarize-migrations.mjs --since 20261119000000
```

---

## Clear separation (read this twice)

| Action | Changes GitHub `main` code? | Changes prod Supabase schema? |
|---|---|---|
| PR approve + merge to `main` | Yes | **No** |
| Vercel/production app deploy | App code only | **No** (unless app itself mutates schema, which it should not) |
| Migrate Staging Action | No | Staging DB only |
| Migrate Production Action + Environment approve | No | **Yes (prod DB)** |

**Code ruleset ≠ database lock.**  
Use both layers together for production safety.
