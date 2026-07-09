"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { applicantPortalApiPath } from "@/lib/applicant-portal/client-tenant";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { ApplicantSession } from "@/app/application/components/applicant-portal/types";

export function useApplicantPortalAuthHeaders() {
  return useCallback(async () => {
    try {
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      let token = sessionData.session?.access_token ?? null;
      const expiresAtMs = (sessionData.session?.expires_at ?? 0) * 1000;

      // Refresh near-expiry sessions before issuing API calls that require bearer auth.
      if (!token || (expiresAtMs > 0 && expiresAtMs - Date.now() < 60_000)) {
        const { data: refreshedData } = await supabaseBrowser.auth.refreshSession();
        token = refreshedData.session?.access_token ?? token;
      }

      return token ? { Authorization: `Bearer ${token}` } : null;
    } catch {
      return null;
    }
  }, []);
}

export function useApplicantPortalSession() {
  const router = useRouter();
  const authHeaders = useApplicantPortalAuthHeaders();
  const [session, setSession] = useState<ApplicantSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const headers = await authHeaders();
        if (!headers) {
          router.replace("/");
          return;
        }
        const res = await fetch(applicantPortalApiPath("/api/applicant-portal/session"), {
          headers,
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => ({}))) as ApplicantSession & { error?: string };
        if (!res.ok) throw new Error(payload.error || "Could not load session.");
        if (!alive) return;
        setSession(payload);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load session.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authHeaders, router]);

  return { session, loading, error, authHeaders };
}
