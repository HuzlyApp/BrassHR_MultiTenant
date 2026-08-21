/**
 * Resolve Supabase URL/anon key from env. Supports Next (`NEXT_PUBLIC_*`) and Expo
 * (`EXPO_PUBLIC_*`) naming so one .env.local can serve both apps.
 *
 * Bracket access is required on the server: Next webpack-inlines
 * `process.env.NEXT_PUBLIC_*` at compile time, so a later `.env` reload can
 * leave the URL pointing at one project while `SUPABASE_SERVICE_ROLE_KEY`
 * (not inlined) points at another — which surfaces as "Invalid API key".
 * Keep the dotted `NEXT_PUBLIC_*` reads as a fallback so the browser bundle
 * still receives the compile-time public values.
 */
function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function getSupabaseUrl(): string | undefined {
  return (
    readEnv("SUPABASE_URL") ||
    readEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    readEnv("EXPO_PUBLIC_SUPABASE_URL") ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
    undefined
  );
}

export function getSupabaseAnonKey(): string | undefined {
  return (
    readEnv("SUPABASE_ANON_KEY") ||
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY") ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    undefined
  );
}
