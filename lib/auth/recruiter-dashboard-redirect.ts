import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import {
  pickTenantVanityLabel,
  resolveRecruiterDashboardUrl,
  shouldUseTenantVanityHost,
} from "@/lib/tenant/tenant-vanity-url";

export async function fetchTenantVanityLabel(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("subdomain, slug")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw error;
  return data ? pickTenantVanityLabel(data) : null;
}

export async function fetchUserTenantVanityLabel(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  const tenantId = profile?.tenant_id != null ? String(profile.tenant_id) : null;
  if (!tenantId) return null;
  return fetchTenantVanityLabel(supabase, tenantId);
}

export function resolveRecruiterRedirectUrl(params: {
  path: string;
  tenantSubdomain: string | null;
  currentHostname?: string | null;
  protocol?: "http" | "https";
}): string {
  return resolveRecruiterDashboardUrl({
    path: params.path,
    tenantSubdomain: params.tenantSubdomain,
    currentHostname: params.currentHostname,
    protocol: params.protocol,
  });
}

export async function resolveAuthenticatedRecruiterRedirectUrl(
  supabase: SupabaseClient,
  user: User,
  params: {
    path: string;
    currentHostname?: string | null;
    protocol?: "http" | "https";
    tenantId?: string | null;
  }
): Promise<string> {
  if (!shouldUseTenantVanityHost(params.path) || isGodAdminUser(user)) {
    return params.path;
  }

  let tenantSubdomain: string | null = null;
  if (params.tenantId) {
    tenantSubdomain = await fetchTenantVanityLabel(supabase, params.tenantId);
  } else {
    tenantSubdomain = await fetchUserTenantVanityLabel(supabase, user.id);
  }

  return resolveRecruiterRedirectUrl({
    path: params.path,
    tenantSubdomain,
    currentHostname: params.currentHostname,
    protocol: params.protocol,
  });
}
