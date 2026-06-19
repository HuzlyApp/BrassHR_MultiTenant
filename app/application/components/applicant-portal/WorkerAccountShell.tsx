"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { WorkerAccountProvider } from "./WorkerAccountContext";
import { WorkerAccountHeader } from "./WorkerAccountHeader";
import { WorkerAccountTabNav } from "./WorkerAccountTabNav";
import type { WorkerAccountOverviewPayload, WorkerAccountTab } from "./worker-account-types";

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

  const updateProfilePhoto = useCallback(
    (url: string | null) => {
      setProfilePhotoUrl(url);
      setOverview((current) =>
        current ? { ...current, profile: { ...current.profile, profilePhotoUrl: url } } : current
      );
    },
    [setProfilePhotoUrl]
  );

  useEffect(() => {
    if (!sessionReady) return;

    let alive = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const headers = await authHeaders();
        if (!headers) return;
        const res = await fetch("/api/applicant-portal/account-overview", {
          headers,
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => ({}))) as WorkerAccountOverviewPayload & {
          error?: string;
        };
        if (!res.ok) throw new Error(payload.error || "Could not load account.");
        if (!alive) return;
        setOverview(payload);
        if (payload.profile?.profilePhotoUrl) {
          setProfilePhotoUrl(payload.profile.profilePhotoUrl);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load account.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authHeaders, sessionReady, setProfilePhotoUrl]);

  if (!sessionReady || loading) {
    return <DashboardPageLoader label="Loading account..." className="min-h-[420px]" />;
  }

  const profile = overview?.profile ?? EMPTY_PROFILE;

  return (
    <div className="w-full min-w-0 space-y-4 px-4 py-5 min-[1000px]:px-8">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      <WorkerAccountHeader profile={profile} onProfilePhotoUpdated={updateProfilePhoto} />
      <WorkerAccountTabNav activeTab={activeTab} />
      <WorkerAccountProvider value={{ overview, updateProfilePhoto }}>{children}</WorkerAccountProvider>
    </div>
  );
}
