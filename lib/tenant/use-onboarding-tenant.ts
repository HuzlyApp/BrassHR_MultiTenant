"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  persistOnboardingSlugCookie,
  resolveClientOnboardingTenantSlug,
} from "@/lib/tenant/client-onboarding-slug";
import { applicationPath, withTenant } from "@/lib/tenant/with-tenant";

/**
 * Tenant slug + navigation helpers for worker onboarding (`?tenant=slug`).
 */
export function useOnboardingTenant() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const slug = useMemo(() => {
    const fromQuery = searchParams.get("tenant")?.trim().toLowerCase();
    if (fromQuery && fromQuery.length >= 2) return fromQuery;
    if (typeof window !== "undefined") {
      return resolveClientOnboardingTenantSlug(window.location.search);
    }
    return null;
  }, [searchParams]);

  const withTenantPath = useCallback((path: string) => withTenant(path, slug), [slug]);

  const push = useCallback(
    (path: string) => {
      if (slug) persistOnboardingSlugCookie(slug);
      router.push(withTenant(path, slug));
    },
    [router, slug]
  );

  const replace = useCallback(
    (path: string) => {
      if (slug) persistOnboardingSlugCookie(slug);
      router.replace(withTenant(path, slug));
    },
    [router, slug]
  );

  const path = useCallback((p: string) => applicationPath(p, slug), [slug]);

  return { slug, withTenantPath, path, push, replace, router };
}
