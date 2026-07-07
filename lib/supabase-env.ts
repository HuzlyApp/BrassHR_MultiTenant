import {
  getResolvedBackendConfig,
  resolveActiveSupabaseBackend,
} from "@/lib/supabase/backend-selection";
import type { SupabaseBackendId } from "@/lib/supabase/backend-config";

export async function ensureSupabaseBackendResolved(): Promise<SupabaseBackendId | null> {
  const config = await resolveActiveSupabaseBackend();
  return config?.id ?? null;
}

export function getSupabaseUrl(backendId?: SupabaseBackendId): string | undefined {
  return getResolvedBackendConfig(backendId)?.url;
}

export function getSupabaseAnonKey(backendId?: SupabaseBackendId): string | undefined {
  return getResolvedBackendConfig(backendId)?.anonKey;
}

export function getSupabaseServiceRoleKey(backendId?: SupabaseBackendId): string | undefined {
  return getResolvedBackendConfig(backendId)?.serviceRoleKey;
}
