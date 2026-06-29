"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { WorkerPortalPageLoader } from "./WorkerPortalPageLoader";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { WorkerAccountProvider } from "./WorkerAccountContext";
import { WorkerAccountHeader } from "./WorkerAccountHeader";
import { WorkerAccountTabNav } from "./WorkerAccountTabNav";
import type { WorkerAccountOverviewPayload, WorkerAccountTab } from "./worker-account-types";
import { WORKER_PORTAL_PAGE_PAD_CLASS } from "./worker-schedule-typography";

const EMPTY_PROFILE: WorkerAccountOverviewPayload["profile"] = {
  id: "",
  tenantId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  jobRole: "",
  statusLabel: "approved",
  displayName: "",
  fullAddress: "—",
  employeeId: "—",
  hireDateLabel: "—",
  employmentType: "Part Time",
  department: "—",
  supervisorName: null,
  hourlyRate: null,
  positions: [],
  yearsExperience: null,
  profileCompletionPercent: 0,
  profilePhotoUrl: null,
};

type WorkerAccountShellProps = {
  activeTab: WorkerAccountTab;
  children: ReactNode;
};

export function WorkerAccountShell({ activeTab, children }: WorkerAccountShellProps) {
  const { sessionReady, authHeaders, setProfilePhotoUrl } = useApplicantPortal();
  const [overview, setOverview] = useState<WorkerAccountOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        await loadOverview();
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load account.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [loadOverview, sessionReady]);

  if (!sessionReady || loading) {
    return <WorkerPortalPageLoader label="Loading account..." />;
  }

  const profile = overview?.profile ?? EMPTY_PROFILE;

  return (
    <div className="w-full min-w-0">
      <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} pb-4`}>
        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <WorkerAccountHeader profile={profile} onProfilePhotoUpdated={updateProfilePhoto} />
      </div>

      <div className="sticky top-16 z-20 border-b border-[#E5E7EB] bg-white">
        <WorkerAccountTabNav activeTab={activeTab} />
      </div>

      <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} pt-4`}>
        <WorkerAccountProvider value={{ overview, updateProfilePhoto, refreshOverview }}>
          {children}
        </WorkerAccountProvider>
      </div>
    </div>
  );
}
