"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchStaffDetailJson } from "@/lib/admin/staff-detail-fetch-cache";
import { resolveApplicationWorkerId, type ApplicationApplicantSource } from "@/lib/jobs/application-applicant-display";
import { isUuid } from "@/lib/validation/uuid";

export default function ApplicationDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError(null);
    if (!isUuid(id)) {
      setError("This application link is invalid.");
      return;
    }
    // Reuse the authenticated, tenant-scoped API; never resolve an unscoped application ID.
    void fetchStaffDetailJson<{ application?: ApplicationApplicantSource & { worker_id?: string | null } }>(
      `/api/admin/job-applications/${encodeURIComponent(id)}`, { ttlMs: 0, bust: true }
    ).then((result) => {
      if (!active) return;
      if (!result.ok) throw new Error("This application is unavailable in the selected company.");
      const workerId = result.payload.application && resolveApplicationWorkerId(result.payload.application);
      if (!workerId || !isUuid(workerId)) throw new Error("This application does not have a candidate profile yet.");
      router.replace(`/admin_recruiter/new/applications/${encodeURIComponent(workerId)}?applicationId=${encodeURIComponent(id)}`);
    }).catch((failure: unknown) => {
      if (active) setError(failure instanceof Error ? failure.message : "Could not open the application.");
    });
    return () => { active = false; };
  }, [id, router, attempt]);

  return <div className="space-y-4 p-6">
    {error ? <>
      <p role="alert">{error}</p>
      <button type="button" className="underline" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
      <Link className="ml-4 underline" href="/admin_recruiter/applications">Back to applicants</Link>
    </> : <p role="status">Opening application…</p>}
  </div>;
}
