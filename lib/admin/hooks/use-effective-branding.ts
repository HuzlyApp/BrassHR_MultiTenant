"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { BRANDING_UPDATED_EVENT } from "@/lib/tenant/branding-events";
import { staffFetchInit } from "@/lib/staff-auth-headers";

export type EffectiveBrandingViewer = {
  godAdmin?: boolean;
  scoped?: boolean;
  tenantId?: string | null;
  tenantName?: string | null;
};

export type EffectiveBrandingPayload = {
  branding: TenantBranding;
  viewer: EffectiveBrandingViewer;
  debug?: Record<string, unknown>;
};

export function effectiveBrandingQueryKey(hostname?: string | null) {
  const host =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "server");
  return ["admin-effective-branding", host] as const;
}

export const EFFECTIVE_BRANDING_QUERY_KEY = effectiveBrandingQueryKey();

/** Apply fresh branding to the admin chrome cache without waiting for a refetch. */
export function patchEffectiveBrandingCache(
  queryClient: QueryClient,
  branding: TenantBranding
): void {
  queryClient.setQueryData<EffectiveBrandingPayload>(
    effectiveBrandingQueryKey(typeof window !== "undefined" ? window.location.hostname : null),
    (prev) => (prev ? { ...prev, branding } : prev)
  );
}

async function fetchEffectiveBranding(): Promise<EffectiveBrandingPayload> {
  const res = await fetch("/api/admin/effective-branding", {
    ...(await staffFetchInit()),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Branding request failed (${res.status})`);
  }
  const payload = (await res.json()) as EffectiveBrandingPayload & { error?: string };
  if (!payload.branding) {
    throw new Error(payload.error || "Branding payload missing");
  }
  return payload;
}

export function useEffectiveBranding() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: effectiveBrandingQueryKey(
      typeof window !== "undefined" ? window.location.hostname : null
    ),
    queryFn: fetchEffectiveBranding,
    staleTime: 60_000,
  });

  useEffect(() => {
    const handler = () => {
      void queryClient.invalidateQueries({
        queryKey: effectiveBrandingQueryKey(
          typeof window !== "undefined" ? window.location.hostname : null
        ),
      });
    };
    window.addEventListener(BRANDING_UPDATED_EVENT, handler);
    return () => window.removeEventListener(BRANDING_UPDATED_EVENT, handler);
  }, [queryClient]);

  return {
    branding: query.data?.branding ?? null,
    viewer: query.data?.viewer ?? null,
    debug: query.data?.debug,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
