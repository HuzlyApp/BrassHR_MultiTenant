"use client";

import type { QueryClient } from "@tanstack/react-query";
import {
  effectiveBrandingQueryKey,
  patchEffectiveBrandingCache,
} from "@/lib/admin/hooks/use-effective-branding";
import { prefetchSidebarIconMarkups } from "@/lib/sidebar/sidebar-icon-markup";
import { notifyBrandingUpdated } from "@/lib/tenant/branding-events";
import { writeCachedTenantBranding } from "@/lib/tenant/client-branding-cache";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";

/**
 * Push saved branding into admin chrome (sidebar/header CSS + icons) without a full reload.
 * Re-asserts the known-good payload after refetch so a stale Redis hit cannot wipe it.
 */
export async function refreshAdminBrandingChrome(
  queryClient: QueryClient,
  branding?: TenantBranding | null
): Promise<void> {
  if (branding) {
    patchEffectiveBrandingCache(queryClient, branding);
    writeCachedTenantBranding(branding);
    if (branding.primaryHex) {
      await prefetchSidebarIconMarkups(branding.primaryHex).catch(() => undefined);
    }
  }

  notifyBrandingUpdated();

  const key = effectiveBrandingQueryKey(
    typeof window !== "undefined" ? window.location.hostname : null
  );
  await queryClient.invalidateQueries({ queryKey: key });
  await queryClient.refetchQueries({ queryKey: key }).catch(() => undefined);

  if (branding) {
    patchEffectiveBrandingCache(queryClient, branding);
    writeCachedTenantBranding(branding);
  }
}
