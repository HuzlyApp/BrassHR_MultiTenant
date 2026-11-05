"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  useCandidateDetailChrome,
  useCandidateDetailChromeActive,
} from "../../../components/CandidateDetailChrome";
import DetailedCandidateHeader from "../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../components/DetailedTabs";
import CandidateDetailLoader from "../../../components/CandidateDetailLoader";
import HireJourneyClient from "@/app/admin_recruiter/candidates/[workerId]/hire-journey/HireJourneyClient";
import {
  fetchStaffDetailJson,
  workerProfileApiUrl,
} from "@/lib/admin/staff-detail-fetch-cache";

type ProfilePayload = {
  worker?: {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    job_role?: string | null;
    status?: string | null;
    status_label?: string | null;
    profile_photo_url?: string | null;
    email?: string | null;
  };
  error?: string;
};

export default function CandidatePreHirePage() {
  const params = useParams<{ id: string }>();
  const applicantId = params?.id?.trim() ?? "";
  const chromeActive = useCandidateDetailChromeActive();
  const chrome = useCandidateDetailChrome();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(!chromeActive);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!applicantId || chromeActive) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchStaffDetailJson<ProfilePayload>(
          workerProfileApiUrl(applicantId)
        );
        if (!result.ok) throw new Error(result.payload.error || "Failed to load candidate");
        if (!cancelled) setProfile(result.payload);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load candidate");
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [applicantId, chromeActive]);

  const worker = chromeActive ? chrome?.profile?.worker : profile?.worker;
  const name = `${worker?.first_name ?? ""} ${worker?.last_name ?? ""}`.trim();

  if (!applicantId) {
    return (
      <div className="admin-recruiter-page-pad">
        <div className="admin-recruiter-content-width rounded-xl border border-[#E5E7EB] bg-white px-4 py-6 text-sm text-[#667085]">
          Missing candidate id.
        </div>
      </div>
    );
  }

  const journey = (
    <Suspense
      fallback={
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-6 text-sm text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading hiring journey…
        </div>
      }
    >
      <HireJourneyClient workerId={applicantId} embeddedPhase="pre_hire" />
    </Suspense>
  );

  if (chromeActive) {
    return journey;
  }

  return (
    <div className="admin-recruiter-page-pad">
      <div className="admin-recruiter-content-width">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading && !profile ? (
          <CandidateDetailLoader label="Loading candidate..." />
        ) : (
          <>
            <DetailedCandidateHeader
              name={name}
              role={worker?.job_role ?? ""}
              profilePhotoUrl={worker?.profile_photo_url}
              workerId={applicantId}
              candidateEmail={worker?.email}
            />
            <DetailedTabs
              applicantId={applicantId}
              activeTab="Pre-Hire"
              workerStatus={worker?.status}
            />
          </>
        )}

        {journey}
      </div>
    </div>
  );
}
