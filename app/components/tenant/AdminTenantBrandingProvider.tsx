"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import AdminBrandingLoader from "@/app/admin_recruiter/components/AdminBrandingLoader";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { BRANDING_UPDATED_EVENT } from "@/lib/tenant/branding-events";
import { supabaseBrowser } from "@/lib/supabase-browser";

type LoadState = "loading" | "ready" | "error";

async function fetchEffectiveBranding(): Promise<TenantBranding> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  const accessToken = session?.access_token ?? null;
  const res = await fetch("/api/admin/effective-branding", {
    cache: "no-store",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(`Branding request failed (${res.status})`);
  }
  const payload = (await res.json()) as {
    branding?: TenantBranding;
    debug?: Record<string, unknown>;
  };
  if (!payload.branding) {
    throw new Error("Branding payload missing");
  }
  if (process.env.NODE_ENV !== "production") {
    console.info("[AdminTenantBrandingProvider] effective branding", payload.debug ?? payload);
  }
  return payload.branding;
}

/**
 * Hydrates recruiter admin chrome with the scoped tenant branding (effective tenant —
 * recruiter home tenant or god-admin cookie). UI stays hidden until the API responds
 * so default Brass HR chrome never flashes.
 */
export function AdminTenantBrandingProvider({ children }: { children: ReactNode }) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadBranding = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoadState("loading");
    }
    setErrorMessage(null);
    try {
      const next = await fetchEffectiveBranding();
      setBranding(next);
      setLoadState("ready");
    } catch (e) {
      if (!options?.silent) {
        setBranding(null);
        setLoadState("error");
      }
      setErrorMessage(e instanceof Error ? e.message : "Could not load branding");
    }
  }, []);

  useEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  useEffect(() => {
    const handler = () => {
      void loadBranding({ silent: true });
    };
    window.addEventListener(BRANDING_UPDATED_EVENT, handler);
    return () => window.removeEventListener(BRANDING_UPDATED_EVENT, handler);
  }, [loadBranding]);

  if (loadState === "loading") {
    return <AdminBrandingLoader />;
  }

  if (loadState === "error" || !branding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F5F5] px-6">
        <div className="max-w-sm rounded-lg border border-[#E5E7EB] bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-[#0F172A]">Could not load your workspace</p>
          <p className="mt-2 text-sm text-[#64748B]">{errorMessage ?? "Please try again."}</p>
          <button
            type="button"
            onClick={() => void loadBranding()}
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
