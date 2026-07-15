# Enable automated schema sync to development

Follow these once. After that, merging migration files to `main` updates BrassHR_South automatically. Production stays manual.

## 1. GitHub secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → New repository secret:

| Secret | Value |
|--------|--------|
| `SUPABASE_ACCESS_TOKEN` | Create at https://supabase.com/dashboard/account/tokens |
| `DEVELOPMENT_PROJECT_ID` | `mgucromvpnxntwyssltd` |
| `DEVELOPMENT_DB_PASSWORD` | South project DB password (Settings → Database) |
| `PRODUCTION_PROJECT_ID` | `avhdoifnsnoeavqxnwwm` |
| `PRODUCTION_DB_PASSWORD` | BrassHR DB password |

## 2. Vercel Preview = South

Vercel → Project → **Settings** → **Environment Variables**:

For **Preview** (and Development if listed):

- `NEXT_PUBLIC_SUPABASE_URL` = `https://mgucromvpnxntwyssltd.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = South key
- `SUPABASE_SERVICE_ROLE_KEY` = South service_role

For **Production** only: BrassHR (`avhdo…`) keys.

## 3. Localhost = South

Update `.env` / `.env.local` the same way as Preview, then:

```bash
npm run supabase:assert-env
```

## 4. How day-to-day works

1. Add SQL under `supabase/migrations/`
2. Open PR → sanity workflow runs
3. Merge to `main` → **Supabase migrations → development** pushes to South
4. Preview deployments already use South via Vercel Preview env
5. When ready for live schema: Actions → **Supabase migrations → production** → type `avhdoifnsnoeavqxnwwm`

## First-time migration history note

If the first `db push` to South fails because remote history was applied with different version names (MCP vs file timestamps), repair once with CLI repair / aligned migration list, then re-run the development workflow. Do not use `db reset` on remote.
