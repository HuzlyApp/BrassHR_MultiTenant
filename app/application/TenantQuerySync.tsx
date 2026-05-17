"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  persistOnboardingSlugCookie,
  resolveClientOnboardingTenantSlug,
} from "@/lib/tenant/client-onboarding-slug";

/**
 * Keeps `?tenant=` on application URLs when the slug is known from cookie/subdomain
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

    const slug = resolveClientOnboardingTenantSlug(searchParams.toString());
    if (!slug) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("tenant", slug);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router, searchParams]);

  return null;
}
