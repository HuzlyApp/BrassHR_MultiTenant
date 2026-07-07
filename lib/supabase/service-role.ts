import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ensureSupabaseBackendResolved,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/supabase-env";
import {
  getResolvedBackendConfig,
  markPrimaryBackendFailure,
} from "@/lib/supabase/backend-selection";
import { createResilientFetch } from "@/lib/supabase/resilient-fetch";

function buildServiceRoleClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: createResilientFetch({
        onPrimaryFailure: () => markPrimaryBackendFailure(),
        resolveUrl: () => getSupabaseUrl(),
        resolveAnonKey: () => getSupabaseServiceRoleKey(),
      }),
    },
  });
}

/** Server-only Supabase client with service role. Never import in client components. */
export function createServiceRoleClient(): SupabaseClient | null {
  const config = getResolvedBackendConfig();
  if (!config?.url || !config.serviceRoleKey) return null;
  return buildServiceRoleClient(config.url, config.serviceRoleKey);
}

/** Prefer this in route handlers so fallback health is resolved before queries run. */
export async function createServiceRoleClientResolved(): Promise<SupabaseClient | null> {
  await ensureSupabaseBackendResolved();
  const config = getResolvedBackendConfig();
  if (!config?.url || !config.serviceRoleKey) return null;
  return buildServiceRoleClient(config.url, config.serviceRoleKey);
}
