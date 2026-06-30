"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { WorkerAccountShellLayout } from "./WorkerAccountShellLayout";
import type { WorkerAccountOverviewPayload, WorkerAccountTab } from "./worker-account-types";
import { workerAccountTabHref } from "./worker-account-types";

type WorkerAccountShellProps = {
  activeTab: WorkerAccountTab;
  children: ReactNode;
};

export function WorkerAccountShell({ activeTab, children }: WorkerAccountShellProps) {
  const { sessionReady, authHeaders, setProfilePhotoUrl } = useApplicantPortal();
  const [overview, setOverview] = useState<WorkerAccountOverviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return null;

    const res = await fetch("/api/applicant-portal/account-overview", {
      headers,
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as WorkerAccountOverviewPayload & {
      error?: string;
    };
    if (!res.ok) throw new Error(payload.error || "Could not load account.");

    setOverview(payload);
    if (payload.profile?.profilePhotoUrl) {
      setProfilePhotoUrl(payload.profile.profilePhotoUrl);
    }
    return payload;
  }, [authHeaders, setProfilePhotoUrl]);

  const refreshOverview = useCallback(async () => {
    try {
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load account.");
    }
  }, [loadOverview]);

  const updateProfilePhoto = useCallback(
    (url: string | null) => {
      setProfilePhotoUrl(url);
      setOverview((current) =>
        current ? { ...current, profile: { ...current.profile, profilePhotoUrl: url } } : current
      );
      void refreshOverview();
    },
    [refreshOverview, setProfilePhotoUrl]
  );

  useEffect(() => {
    if (!sessionReady) return;

    let alive = true;
    setError(null);

    void (async () => {
      try {
        await loadOverview();
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load account.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [loadOverview, sessionReady]);

  return (
    <WorkerAccountShellLayout
      activeTab={activeTab}
      overview={overview}
      error={error}
      readOnly={false}
      tabHref={workerAccountTabHref}
      updateProfilePhoto={updateProfilePhoto}
      refreshOverview={refreshOverview}
      loading={!overview && !error && sessionReady}
    >
      {children}
    </WorkerAccountShellLayout>
  );
}
