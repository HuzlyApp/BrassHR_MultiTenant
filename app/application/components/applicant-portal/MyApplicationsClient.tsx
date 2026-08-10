"use client";

import { useCallback, useEffect, useState } from "react";
import { useApplicantPortal } from "@/app/application/components/applicant-portal/ApplicantPortalProvider";

type MeApplication = {
  applicationId: string;
  workerId: string;
  status: string;
  statusLabel: string;
  appliedAt: string;
  tenant: { id: string; name: string };
  job: { id: string; title: string; location: string | null };
};

export function MyApplicationsClient() {
  const { sessionReady, authHeaders } = useApplicantPortal();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<MeApplication[]>([]);

  const load = useCallback(async () => {
    if (!sessionReady) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/me/applications", { headers, cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Could not load applications.");
      setApplications((payload.applications ?? []) as MeApplication[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load applications.");
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, sessionReady]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold text-[#0F172A]">My Applications</h1>
      <p className="mt-1 text-sm text-[#64748B]">
        Jobs you have applied to across companies on Brass HR.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-[#64748B]">Loading applications…</p>
      ) : error ? (
        <p className="mt-8 text-sm text-[#B91C1C]">{error}</p>
      ) : applications.length === 0 ? (
        <p className="mt-8 text-sm text-[#64748B]">You have not applied to any jobs yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {applications.map((app) => (
            <li
              key={app.applicationId}
              className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A]">{app.job.title}</p>
                  <p className="mt-0.5 text-sm text-[#475569]">{app.tenant.name}</p>
                  {app.job.location ? (
                    <p className="mt-0.5 text-xs text-[#94A3B8]">{app.job.location}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-md bg-[#F1F5F9] px-2 py-1 text-xs font-medium text-[#334155]">
                  {app.statusLabel}
                </span>
              </div>
              <p className="mt-2 text-xs text-[#94A3B8]">
                Applied {new Date(app.appliedAt).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
