"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { persistOnboardingSlugCookie } from "@/lib/tenant/client-onboarding-slug";
import { resolveTenantSlugForClient } from "@/lib/tenant/resolve-tenant-context";

/**
 * Keeps `?tenant=` on application URLs when the slug is known from hostname/cookie
 * but missing from the query string (avoids extra round-trip vs middleware-only).
 */
export default function TenantQuerySync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qp = searchParams.get("tenant")?.trim().toLowerCase();
    if (qp && qp.length >= 2) {
      persistOnboardingSlugCookie(qp);
      return;
    }

    const resolved = resolveTenantSlugForClient(searchParams.toString(), { path: pathname });
    if (!resolved.slug) return;

    if (resolved.subdomainLabel && qp && qp !== resolved.slug) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tenant", resolved.slug);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("tenant", resolved.slug);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router, searchParams]);

  return null;
}
