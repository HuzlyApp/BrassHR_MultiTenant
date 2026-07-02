"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { applyBrandingHead } from "@/lib/tenant/apply-branding-head";
import {
  getActiveBranding,
  subscribeActiveBranding,
} from "@/lib/tenant/branding-head-registry";

function syncActiveBrandingHead() {
  const branding = getActiveBranding();
  if (branding) applyBrandingHead(branding);
}

/** Single document head sync — follows the innermost active tenant branding provider. */
export default function TenantBrandingHead() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    syncActiveBrandingHead();
    const unsubscribe = subscribeActiveBranding(syncActiveBrandingHead);
    return unsubscribe;
  }, []);

  useLayoutEffect(() => {
    syncActiveBrandingHead();
    const timer = window.setTimeout(syncActiveBrandingHead, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
