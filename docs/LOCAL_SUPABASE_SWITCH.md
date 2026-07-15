# Localhost must use DEVELOPMENT Supabase

Your `.env` currently still points at **production** (`avhdoifnsnoeavqxnwwm`).

## Required manual update (do this now)

1. Open Supabase Dashboard → **BrassHR_South** → Settings → API  
   https://supabase.com/dashboard/project/mgucromvpnxntwyssltd/settings/api

2. Copy into `.env` / `.env.local` (do not commit):

```env
NEXT_PUBLIC_SUPABASE_URL=https://mgucromvpnxntwyssltd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<development anon key>
SUPABASE_SERVICE_ROLE_KEY=<development service_role key>
```

3. Keep production keys **only** in Vercel Production env vars for project `avhdoifnsnoeavqxnwwm`.

4. Verify:

```bash
npm run supabase:assert-env
```

This must print the development ref and exit 0.

See `docs/supabase-environments.md` for the full matrix.
