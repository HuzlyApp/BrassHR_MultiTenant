"use client";

import { useQuery } from "@tanstack/react-query";
import { staffFetchInit } from "@/lib/staff-auth-headers";

type EffectiveBrandingResponse = {
  viewer?: { tenantId?: string | null; scoped?: boolean };
  branding?: { id?: string | null };
  error?: string;
};

const EFFECTIVE_TENANT_QUERY_KEY = ["effective-admin-tenant"] as const;

async function fetchEffectiveTenantId(): Promise<string | null> {
  const res = await fetch("/api/admin/effective-branding", {
    ...(await staffFetchInit()),
    cache: "no-store",
  });
  const data = (await res.json()) as EffectiveBrandingResponse;
  if (!res.ok) throw new Error(data.error || "Failed to resolve tenant");
  return data.viewer?.tenantId ?? data.branding?.id ?? null;
}

export function useEffectiveAdminTenantId() {
  const query = useQuery({
    queryKey: EFFECTIVE_TENANT_QUERY_KEY,
    queryFn: fetchEffectiveTenantId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  return {
    tenantId: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
