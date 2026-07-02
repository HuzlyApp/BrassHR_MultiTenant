"use client";

import { useEffect, type ReactNode } from "react";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import { prefetchSidebarIconMarkups } from "@/lib/sidebar/sidebar-icon-markup";
import { useEffectiveBranding } from "@/lib/admin/hooks/use-effective-branding";

/**
 * Hydrates recruiter admin chrome with the scoped tenant branding (effective tenant —
 * recruiter home tenant or god-admin cookie). UI stays hidden until the API responds
 * so default Brass HR chrome never flashes.
 */
export function AdminTenantBrandingProvider({ children }: { children: ReactNode }) {
  const { branding, isLoading, isError, error, refetch } = useEffectiveBranding();

  useEffect(() => {
    if (branding?.primaryHex) {
      void prefetchSidebarIconMarkups(branding.primaryHex);
    }
  }, [branding?.primaryHex]);

  if (isLoading) {
    return <div className="min-h-screen bg-[#F4F4F4]" aria-hidden="true" />;
  }

  if (isError || !branding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F5F5] px-6">
        <div className="max-w-sm rounded-lg border border-[#E5E7EB] bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-[#0F172A]">Could not load your workspace</p>
          <p className="mt-2 text-sm text-[#64748B]">
            {error instanceof Error ? error.message : "Please try again."}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-[#012352] px-5 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return <TenantBrandingProvider branding={branding}>{children}</TenantBrandingProvider>;
}
