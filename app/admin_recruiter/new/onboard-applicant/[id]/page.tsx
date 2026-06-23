"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import DetailedTabs from "../../../components/DetailedTabs";
import CandidateDetailLoader from "../../../components/CandidateDetailLoader";
import OnboardedApplicantPanel from "../../../components/OnboardedApplicantPanel";
import { buildOnboardedApplicantViewModel } from "@/lib/admin/onboarded-applicant";

type ProfilePayload = {
  worker?: {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    job_role?: string | null;
    status?: string | null;
    converted_worker_type?: string | null;
    converted_at?: string | null;
    profile_photo_url?: string | null;
    email?: string | null;
    phone?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    employee_id?: string | null;
    employee_number?: string | null;
    employment_type?: string | null;
    reports_to?: string | null;
  };
  onboardingCompletion?: { percent?: number };
  onboardingSteps?: Array<{ id: string; label: string; state: string; detail?: string }>;
  attachment_requirements?: Array<{
    id: string;
    title: string;
    status?: string | null;
    url?: string | null;
  }>;
  error?: string;
};

type ChecklistPayload = {
  worker?: { status?: string | null };
  meta?: { progressPercent?: number };
  sections?: Array<{
    id: string;
    rows: Array<{
      id: string;
      title: string;
      state: string;
      badge?: string;
      checked?: boolean;
    }>;
  }>;
  error?: string;
};

export default function OnboardApplicantPage() {
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [checklist, setChecklist] = useState<ChecklistPayload | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!applicantId) return;
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const [profileRes, checklistRes] = await Promise.all([
        fetch(`/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`, {
          cache: "no-store",
        }),
        fetch(`/api/admin/worker-checklist?workerId=${encodeURIComponent(applicantId)}`, {
          cache: "no-store",
        }),
      ]);

      const profileJson = (await profileRes.json()) as ProfilePayload;
      const checklistJson = (await checklistRes.json()) as ChecklistPayload;

      if (!profileRes.ok) {
        throw new Error(profileJson.error || `Failed to load profile (${profileRes.status})`);
      }
      if (!checklistRes.ok) {
        throw new Error(checklistJson.error || `Failed to load checklist (${checklistRes.status})`);
      }

      setProfile(profileJson);
      setChecklist(checklistJson);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load onboard applicant";
      setLoadError(message);
      setProfile(null);
      setChecklist(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [applicantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onboardedData = useMemo(
    () => buildOnboardedApplicantViewModel(profile ?? {}, checklist ?? {}),
    [profile, checklist]
  );

  return (
    <div className="admin-recruiter-page-pad">
      <div className="admin-recruiter-content-width">
        <DetailedTabs
          applicantId={applicantId}
          activeTab="Onboard Applicant"
          workerStatus={profile?.worker?.status}
        />

        {loadError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </div>
        ) : null}

        {loading && !profile ? (
          <CandidateDetailLoader label="Loading onboard applicant..." />
        ) : (
          <OnboardedApplicantPanel
            workerId={applicantId ?? ""}
            data={onboardedData}
            onConversionComplete={() => loadData(true)}
          />
        )}
      </div>
    </div>
  );
}

