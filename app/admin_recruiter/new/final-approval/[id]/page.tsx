"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import DetailedTabs from "../../../components/DetailedTabs";
import CandidateDetailLoader from "../../../components/CandidateDetailLoader";
import FinalApprovalPanel from "../../../components/FinalApprovalPanel";
import { buildFinalApprovalViewModel } from "@/lib/admin/final-approval";

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
    phone?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    created_at?: string | null;
    years_experience?: number | null;
  };
  skillAssessments?: {
    completed?: number;
    total?: number;
    rows?: Array<{
      total_score?: number | null;
      completed?: boolean | null;
      category_title?: string | null;
      result_status?: string | null;
    }>;
  };
  onboardingCompletion?: { percent?: number };
  onboardingSteps?: Array<{ id: string; label: string; state: string }>;
  references?: unknown[];
  attachment_requirements?: Array<{
    id: string;
    title: string;
    status?: string | null;
    url?: string | null;
  }>;
  documents?: {
    nursing_license_url?: boolean;
    tb_test_url?: boolean;
    cpr_certification_url?: boolean;
  } | null;
  error?: string;
};

type ChecklistPayload = {
  worker?: { status?: string | null };
  meta?: { progressPercent?: number };
  tracker?: { done?: boolean[] };
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

export default function NewApplicantFinalApprovalPage() {
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
      const message = error instanceof Error ? error.message : "Failed to load final approval";
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

  const finalApprovalData = useMemo(
    () => buildFinalApprovalViewModel(profile ?? {}, checklist ?? {}),
    [profile, checklist]
  );

  return (
    <div className="admin-recruiter-page-pad">
      <div className="admin-recruiter-content-width">
        <DetailedTabs applicantId={applicantId} activeTab="Final Approval" />

        {loadError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </div>
        ) : null}

        {loading && !profile ? (
          <CandidateDetailLoader label="Loading final approval..." />
        ) : (
          <FinalApprovalPanel
            workerId={applicantId ?? ""}
            data={finalApprovalData}
            onRefresh={() => void loadData(true)}
          />
        )}
      </div>
    </div>
  );
}
