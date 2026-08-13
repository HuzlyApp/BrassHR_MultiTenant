import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export function getServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
}

export function isLocalSupabaseUrl(url = getSupabaseUrl()): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return LOCAL_HOSTS.has(host) || host.endsWith(".supabase.internal");
  } catch {
    return false;
  }
}

/**
 * Live adversarial tests mutate the database. They run only when explicitly enabled
 * against local/test Supabase — never against a hosted project unless the operator
 * sets BRASSHR_RLS_ALLOW_REMOTE=1 (dedicated test project only).
 */
export function isRlsLiveEnabled(): boolean {
  if (process.env.BRASSHR_RLS_TEST !== "1") return false;
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  const service = getServiceRoleKey();
  if (!url || !anon || !service) return false;
  if (isLocalSupabaseUrl(url)) return true;
  return process.env.BRASSHR_RLS_ALLOW_REMOTE === "1";
}

export function describeRlsSkipReason(): string {
  if (process.env.BRASSHR_RLS_TEST !== "1") {
    return "Set BRASSHR_RLS_TEST=1 and point at local Supabase (or a dedicated test project with BRASSHR_RLS_ALLOW_REMOTE=1).";
  }
  if (!getSupabaseUrl() || !getSupabaseAnonKey() || !getServiceRoleKey()) {
    return "Missing NEXT_PUBLIC_SUPABASE_URL / anon key / SUPABASE_SERVICE_ROLE_KEY.";
  }
  if (!isLocalSupabaseUrl() && process.env.BRASSHR_RLS_ALLOW_REMOTE !== "1") {
    return "Refusing hosted Supabase. Use local (`supabase start`) or set BRASSHR_RLS_ALLOW_REMOTE=1 for a dedicated test project.";
  }
  return "RLS live tests disabled.";
}
