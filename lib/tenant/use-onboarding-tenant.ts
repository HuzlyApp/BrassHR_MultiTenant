"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  persistOnboardingSlugCookie,
} from "@/lib/tenant/client-onboarding-slug";
import { resolveTenantSlugForClient } from "@/lib/tenant/resolve-tenant-context";
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
    const fromSearch =
      typeof window !== "undefined"
        ? window.location.search
        : searchParams.toString()
          ? `?${searchParams.toString()}`
          : "";
    return resolveTenantSlugForClient(fromSearch, {
      path: typeof window !== "undefined" ? window.location.pathname : "/application",
    }).slug;
  }, [searchParams]);

  const withTenantPath = useCallback((path: string) => withTenant(path, slug), [slug]);

  const push = useCallback(
    (path: string) => {
      const resolved = resolveTenantSlugForClient(
        typeof window !== "undefined" ? window.location.search : "",
        { path: typeof window !== "undefined" ? window.location.pathname : "/application" }
      ).slug;
      if (!resolved) {
        router.push(path);
        return;
      }
      persistOnboardingSlugCookie(resolved);
      router.push(withTenant(path, resolved));
    },
    [router, slug]
  );

  const replace = useCallback(
    (path: string) => {
      const resolved = resolveTenantSlugForClient(
        typeof window !== "undefined" ? window.location.search : "",
        { path: typeof window !== "undefined" ? window.location.pathname : "/application" }
      ).slug;
      if (!resolved) {
        router.replace(path);
        return;
      }
      persistOnboardingSlugCookie(resolved);
      router.replace(withTenant(path, resolved));
    },
    [router, slug]
  );

  const path = useCallback((p: string) => applicationPath(p, slug), [slug]);

  return { slug, withTenantPath, path, push, replace, router };
}
