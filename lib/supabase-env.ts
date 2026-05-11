/**
 * Resolve Supabase URL/anon key from env. Supports Next (`NEXT_PUBLIC_*`) and Expo
 * (`EXPO_PUBLIC_*`) naming so one .env.local can serve both apps.
 */
export function getSupabaseUrl(): string | undefined {
  const v =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim()
  return v || undefined
}

export function getSupabaseAnonKey(): string | undefined {
  const v =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim()
  return v || undefined
}
