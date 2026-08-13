"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import {
  applyBrandingHead,
  documentHeadMatchesBranding,
} from "@/lib/tenant/apply-branding-head";
import {
  getActiveBranding,
  subscribeActiveBranding,
} from "@/lib/tenant/branding-head-registry";

function syncActiveBrandingHead() {
  const branding = getActiveBranding();
  if (branding) applyBrandingHead(branding);
}

/**
 * Single document head sync — follows the innermost active tenant branding provider.
 * Also re-applies after Next.js metadata resets the title/favicon to root defaults.
 */
export default function TenantBrandingHead() {
  const pathname = usePathname();
  const applyingRef = useRef(false);

  useLayoutEffect(() => {
    const runSync = () => {
      if (applyingRef.current) return;
      const branding = getActiveBranding();
      if (!branding) return;
      if (documentHeadMatchesBranding(branding)) return;
      applyingRef.current = true;
      try {
        applyBrandingHead(branding);
      } finally {
        // Allow Next's own head mutations to settle before we accept another sync.
        window.setTimeout(() => {
          applyingRef.current = false;
        }, 0);
      }
    };

    runSync();
    const unsubscribe = subscribeActiveBranding(runSync);

    const observer = new MutationObserver(() => {
      runSync();
    });
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ["href"],
    });

    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    syncActiveBrandingHead();
    const timer = window.setTimeout(syncActiveBrandingHead, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
