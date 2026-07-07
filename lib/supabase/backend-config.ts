export type SupabaseBackendId = "primary" | "fallback";

export type SupabaseBackendConfig = {
  id: SupabaseBackendId;
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/** Next.js only inlines literal `process.env.NEXT_PUBLIC_*` access in the browser bundle. */
function readPublicSupabaseUrl(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    undefined
  );
}

function readPublicSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    undefined
  );
}

function readFallbackSupabaseUrl(): string | undefined {
  return process.env.FALLBACK_NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}

function readFallbackSupabaseAnonKey(): string | undefined {
  return process.env.FALLBACK_NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined;
}

export function getPrimaryBackendConfig(): SupabaseBackendConfig | null {
  const url = readPublicSupabaseUrl();
  const anonKey = readPublicSupabaseAnonKey();
  if (!url || !anonKey) return null;
  return {
    id: "primary",
    url,
    anonKey,
    serviceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getFallbackBackendConfig(): SupabaseBackendConfig | null {
  const url = readFallbackSupabaseUrl();
  const anonKey = readFallbackSupabaseAnonKey();
  if (!url || !anonKey) return null;
  return {
    id: "fallback",
    url,
    anonKey,
    serviceRoleKey: readEnv("FALLBACK_SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function listConfiguredBackends(): SupabaseBackendConfig[] {
  const backends: SupabaseBackendConfig[] = [];
  const primary = getPrimaryBackendConfig();
  const fallback = getFallbackBackendConfig();
  if (primary) backends.push(primary);
  if (fallback) backends.push(fallback);
  return backends;
}

export function getBackendConfigById(id: SupabaseBackendId): SupabaseBackendConfig | null {
  if (id === "primary") return getPrimaryBackendConfig();
  return getFallbackBackendConfig();
}
