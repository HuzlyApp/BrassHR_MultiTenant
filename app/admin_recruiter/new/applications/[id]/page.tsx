"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  useCandidateDetailChrome,
  useCandidateDetailChromeActive,
} from "../../../components/CandidateDetailChrome";
import DetailedCandidateHeader from "../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../components/DetailedTabs";
import CandidateDetailLoader from "../../../components/CandidateDetailLoader";
import { ScheduleInterviewModal } from "@/app/admin_recruiter/calendar/components/ScheduleInterviewModal";
import { CandidateProfileApplicationsTab } from "@/app/admin_recruiter/candidates/[workerId]/CandidateProfileApplicationsTab";
import type {
  CandidateProfileApplication,
  CandidateProfilePayload,
} from "@/lib/admin/candidate-profile-view";
import {
  candidateProfileApiUrl,
  fetchStaffDetailJson,
  workerProfileApiUrl,
} from "@/lib/admin/staff-detail-fetch-cache";
import { normalizeApplicationStatus } from "@/lib/jobs/application-status";
import {
  invitationSuccessMessage,
  type ScheduleInterviewPayload,
} from "@/lib/interviews/schedule-payload";

type WorkerProfilePayload = {
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

export default function CandidateDetailApplicationsPage() {
  const params = useParams<{ id: string }>();
  const applicantId = params?.id?.trim() ?? "";
  const chromeActive = useCandidateDetailChromeActive();
  const chrome = useCandidateDetailChrome();

  const [headerProfile, setHeaderProfile] = useState<WorkerProfilePayload | null>(null);
  const [applications, setApplications] = useState<CandidateProfileApplication[]>([]);
  const [matchApplicationId, setMatchApplicationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewSubmitting, setInterviewSubmitting] = useState(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);
  const [interviewTarget, setInterviewTarget] = useState<CandidateProfileApplication | null>(null);

  const load = useCallback(async () => {
    if (!applicantId) {
      setLoading(false);
      setError("Missing candidate id.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const profileResult = await fetchStaffDetailJson<CandidateProfilePayload & { error?: string }>(
        candidateProfileApiUrl(applicantId)
      );

      if (!chromeActive) {
        const headerResult = await fetchStaffDetailJson<WorkerProfilePayload>(
          workerProfileApiUrl(applicantId)
        );
        if (!headerResult.ok) {
          throw new Error(headerResult.payload.error || "Failed to load candidate");
        }
        setHeaderProfile(headerResult.payload);
      }

      if (!profileResult.ok) {
        throw new Error(profileResult.payload.error || "Failed to load applications");
      }

      setApplications(profileResult.payload.applications ?? []);
      setMatchApplicationId(profileResult.payload.match?.applicationId ?? null);
    } catch (err) {
      if (!chromeActive) setHeaderProfile(null);
      setApplications([]);
      setMatchApplicationId(null);
      setError(err instanceof Error ? err.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, [applicantId, chromeActive]);

  useEffect(() => {
    void load();
  }, [load]);

  function beginScheduleInterview() {
    const preferred =
      applications.find((row) => row.id === matchApplicationId) ?? applications[0] ?? null;
    if (!preferred) {
      toast.error("This candidate has no job applications to schedule against.");
      return;
    }
    setInterviewTarget(preferred);
    setInterviewError(null);
    setInterviewOpen(true);
  }

  async function handleScheduleInterview(payload: ScheduleInterviewPayload) {
    if (!interviewTarget) return;
    const worker = headerProfile?.worker;
    const name = `${worker?.first_name ?? ""} ${worker?.last_name ?? ""}`.trim() || "Candidate";
    setInterviewSubmitting(true);
    setInterviewError(null);
    try {
      const response = await fetch("/api/admin/applicant-appointments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          applicationId: interviewTarget.id,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        invitation?: {
          sentCount: number;
          failedCount: number;
          skippedCount: number;
          invitationStatus: "sent" | "partial" | "failed" | "pending";
        };
      };
      if (!response.ok) throw new Error(data.error || "Failed to schedule interview");
      setInterviewOpen(false);
      setInterviewError(null);
      setInterviewTarget(null);
      toast.success(`${name}: ${invitationSuccessMessage(data.invitation)}`);
    } catch (scheduleError) {
      const message =
        scheduleError instanceof Error ? scheduleError.message : "Failed to schedule interview";
      setInterviewError(message);
      toast.error(message);
    } finally {
      setInterviewSubmitting(false);
    }
  }

  const worker = chromeActive ? chrome?.profile?.worker : headerProfile?.worker;
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

  const applicationsBody = (
    <>
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {loading ? (
        <CandidateDetailLoader label="Loading applications..." />
      ) : (
        <CandidateProfileApplicationsTab
          applications={applications}
          onScheduleInterview={beginScheduleInterview}
        />
      )}
    </>
  );

  const interviewModal = interviewTarget ? (
    <ScheduleInterviewModal
      open={interviewOpen}
      applicants={[
        {
          id: applicantId,
          name: name || "Candidate",
          status: normalizeApplicationStatus(interviewTarget.status),
        },
      ]}
      submitting={interviewSubmitting}
      error={interviewError}
      onClose={() => {
        setInterviewOpen(false);
        setInterviewError(null);
        setInterviewTarget(null);
      }}
      onSubmit={(payload) => void handleScheduleInterview(payload)}
      fixedWorkerId={applicantId}
      fixedApplicantName={name || "Candidate"}
      fixedApplicationId={interviewTarget.id}
      fixedJobTitle={interviewTarget.jobTitle || undefined}
      defaultTitle={name ? `Interview with ${name}` : undefined}
    />
  ) : null;

  if (chromeActive) {
    return (
      <>
        {applicationsBody}
        {interviewModal}
      </>
    );
  }

  return (
    <div className="admin-recruiter-page-pad">
      <div className="admin-recruiter-content-width">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading && !headerProfile ? (
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
              activeTab="Applications"
              workerStatus={worker?.status ?? null}
            />
            {loading ? (
              <CandidateDetailLoader label="Loading applications..." />
            ) : (
              <CandidateProfileApplicationsTab
                applications={applications}
                onScheduleInterview={beginScheduleInterview}
              />
            )}
          </>
        )}
      </div>

      {interviewModal}
    </div>
  );
}
