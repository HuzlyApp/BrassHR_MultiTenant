"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { WorkerAccountShellLayout } from "@/app/application/components/applicant-portal/WorkerAccountShellLayout";
import type { WorkerAccountOverviewPayload, WorkerAccountTab } from "@/app/application/components/applicant-portal/worker-account-types";
import { adminWorkerAccountTabHref } from "../worker-profile-links";

type AdminWorkerAccountShellProps = {
  workerId: string;
  children: ReactNode;
};

export function AdminWorkerAccountShell({ workerId, children }: AdminWorkerAccountShellProps) {
  const [overview, setOverview] = useState<WorkerAccountOverviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const tabHref = useCallback(
    (tab: WorkerAccountTab) => adminWorkerAccountTabHref(workerId, tab),
    [workerId]
  );

  const loadOverview = useCallback(async () => {
    const res = await fetch(
      `/api/admin/worker-account-overview?workerId=${encodeURIComponent(workerId)}`,
      { cache: "no-store" }
    );
    const payload = (await res.json().catch(() => ({}))) as WorkerAccountOverviewPayload & {
      error?: string;
    };
    if (!res.ok) throw new Error(payload.error || "Could not load worker profile.");
    setOverview(payload);
    return payload;
  }, [workerId]);

  const refreshOverview = useCallback(async () => {
    try {
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load worker profile.");
    }
  }, [loadOverview]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        await loadOverview();
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load worker profile.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [loadOverview]);

  return (
    <WorkerAccountShellLayout
      activeTab="overview"
      overview={overview}
      error={error}
      readOnly
      hideTabs
      tabHref={tabHref}
      updateProfilePhoto={() => undefined}
      refreshOverview={refreshOverview}
      loading={loading}
    >
      {children}
    </WorkerAccountShellLayout>
  );
}
