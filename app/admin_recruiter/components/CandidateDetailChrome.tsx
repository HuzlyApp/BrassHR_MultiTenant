"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  CANDIDATE_PIPELINE_REFRESH_EVENT,
  type CandidatePipelineRefreshDetail,
} from "@/lib/admin/candidate-pipeline-events";
import {
  fetchStaffDetailJson,
  invalidateStaffDetailCache,
  workerProfileApiUrl,
} from "@/lib/admin/staff-detail-fetch-cache";
import { formatPhoneForDisplay } from "@/lib/admin/worker-profile-field-client";
import type { CandidateDetailTab } from "@/lib/onboarding/candidate-detail-tabs";
import CandidateCommunicationDialog from "./CandidateCommunicationDialog";
import DetailedCandidateHeader from "./DetailedCandidateHeader";
import DetailedTabs from "./DetailedTabs";
import { parseCandidateDetailRoute } from "./candidate-detail-navigation";

type ChromeWorker = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  job_role?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  status_label?: string | null;
  job_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  profile_photo_url?: string | null;
};

type ChromeProfilePayload = {
  worker?: ChromeWorker;
  job_id?: string | null;
  /** Applied job public title (preferred over resume profession in the header). */
  job_title?: string | null;
  /** Job requisition UUID for the applied-job header link. */
  job_requisition_id?: string | null;
  /** job_applications.submitted_at || created_at for header Application Date. */
  application_applied_at?: string | null;
  activity?: { source?: string | null };
  onboardingSteps?: Array<{
    state: "complete" | "in_progress" | "pending";
    phase?: "pre_hire" | "post_hire";
  }>;
  onboardingCompletion?: { percent?: number | null };
  error?: string;
};

function chromeHasApplication(profile: ChromeProfilePayload | null): boolean {
  if (!profile) return false;
  return Boolean(
    profile.job_requisition_id?.trim() ||
      profile.job_id?.trim() ||
      profile.job_title?.trim() ||
      profile.worker?.job_id?.trim()
  );
}

type CandidateDetailChromeContextValue = {
  active: true;
  applicantId: string;
  activeTab: CandidateDetailTab;
  workerStatus: string | null;
  profile: ChromeProfilePayload | null;
  loading: boolean;
  refresh: () => void;
};

const CandidateDetailChromeContext =
  createContext<CandidateDetailChromeContextValue | null>(null);

export function useCandidateDetailChrome(): CandidateDetailChromeContextValue | null {
  return useContext(CandidateDetailChromeContext);
}

/** True when shell-level header/tabs are already mounted for this applicant. */
export function useCandidateDetailChromeActive(): boolean {
  return useCandidateDetailChrome()?.active === true;
}

function formatHeaderDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function CandidateDetailChromeInner({
  applicantId,
  activeTab,
  children,
}: {
  applicantId: string;
  activeTab: CandidateDetailTab;
  children: ReactNode;
}) {
  const [profile, setProfile] = useState<ChromeProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [commOpen, setCommOpen] = useState(false);
  const headerView = activeTab === "Resume" ? "header" : undefined;

  const refresh = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  useEffect(() => {
    function handlePipelineRefresh(event: Event) {
      const detail = (event as CustomEvent<CandidatePipelineRefreshDetail>).detail;
      if (detail?.workerId !== applicantId) return;
      if (detail.statusName) {
        setProfile((current) => current?.worker ? { ...current, worker: { ...current.worker, status_label: detail.statusName } } : current);
      }
      invalidateStaffDetailCache(workerProfileApiUrl(applicantId));
      refresh();
    }
    window.addEventListener(CANDIDATE_PIPELINE_REFRESH_EVENT, handlePipelineRefresh);
    return () => {
      window.removeEventListener(CANDIDATE_PIPELINE_REFRESH_EVENT, handlePipelineRefresh);
    };
  }, [applicantId, refresh]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await fetchStaffDetailJson<ChromeProfilePayload>(
          workerProfileApiUrl(applicantId, null, headerView),
          // After Mark as complete / pipeline refresh, skip the 30s TTL cache.
          refreshToken > 0 ? { bust: true } : undefined
        );
        if (cancelled) return;
        if (!result.ok) {
          setProfile(null);
          return;
        }
        setProfile(result.payload);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [applicantId, refreshToken, headerView]);

  const worker = profile?.worker;
  const name = `${worker?.first_name ?? ""} ${worker?.last_name ?? ""}`.trim() || "Applicant";
  const jobTitle = profile?.job_title?.trim() || "";
  const jobRequisitionId = profile?.job_requisition_id?.trim() || "";
  const role = jobTitle || worker?.job_role?.trim() || "—";
  const roleHref = jobRequisitionId
    ? `/admin_recruiter/jobs/${encodeURIComponent(jobRequisitionId)}`
    : null;
  const location = [worker?.city ?? "", worker?.state ?? ""].filter(Boolean).join(", ") || null;
  const workerStatus = worker?.status ?? null;

  // Match hire-journey / legacy profile: Overall Hiring Progress on Profile (and other
  // non-phase tabs) counts pre-hire only — not pre+post (BUG-169).
  const progressSteps = useMemo(() => {
    const steps = profile?.onboardingSteps ?? [];
    if (activeTab === "Post-Hire") {
      return steps.filter((step) => step.phase === "post_hire");
    }
    return steps.filter((step) => (step.phase ?? "pre_hire") !== "post_hire");
  }, [profile?.onboardingSteps, activeTab]);

  const progressPercent = useMemo(() => {
    if (!profile?.onboardingSteps) {
      return profile?.onboardingCompletion?.percent ?? null;
    }
    if (progressSteps.length === 0) return 0;
    const completed = progressSteps.filter((step) => step.state === "complete").length;
    return Math.round((completed / progressSteps.length) * 100);
  }, [profile?.onboardingSteps, profile?.onboardingCompletion?.percent, progressSteps]);

  const progressInProgress = profile?.onboardingSteps
    ? progressSteps.filter((step) => step.state === "in_progress").length
    : null;
  const progressUpcoming = profile?.onboardingSteps
    ? progressSteps.filter((step) => step.state === "pending").length
    : null;

  const contextValue = useMemo<CandidateDetailChromeContextValue>(
    () => ({
      active: true,
      applicantId,
      activeTab,
      workerStatus,
      profile,
      loading,
      refresh,
    }),
    [applicantId, activeTab, workerStatus, profile, loading, refresh]
  );

  if (loading && !profile?.worker) {
    return <div className="admin-recruiter-page-pad" role="status">Loading candidate...</div>;
  }
  if (!profile?.worker) {
    return <div className="admin-recruiter-page-pad" role="alert">
      <h1>Record not found</h1>
      <p>This record is unavailable or you do not have access.</p>
      <a href="/admin_recruiter/new">Back to applicants</a>
    </div>;
  }

  return (
    <CandidateDetailChromeContext.Provider value={contextValue}>
      <div className="admin-recruiter-page-pad admin-candidate-detail-chrome-active max-w-full overflow-x-hidden">
        <div className="admin-recruiter-content-width min-w-0 max-w-full overflow-x-hidden">
          <DetailedCandidateHeader
            persistent
            name={name}
            role={role}
            roleHref={roleHref}
            loading={loading && !worker}
            profilePhotoUrl={worker?.profile_photo_url}
            workerId={applicantId}
            candidateEmail={worker?.email ?? null}
            phone={worker?.phone ? formatPhoneForDisplay(worker.phone) : null}
            location={location}
            statusLabel={worker?.status_label ?? null}
            applicationDate={formatHeaderDate(
              profile?.application_applied_at ?? worker?.created_at
            )}
            jobId={worker?.job_id ?? profile?.job_id ?? profile?.job_requisition_id ?? null}
            source={profile?.activity?.source ?? null}
            progressPercent={progressPercent}
            progressInProgress={progressInProgress}
            progressUpcoming={progressUpcoming}
            progressDate={formatHeaderDate(
              profile?.application_applied_at ??
                worker?.updated_at ??
                worker?.created_at
            )}
            onMessageClick={() => setCommOpen(true)}
            messageDisabled={!worker?.email?.trim() && !worker?.phone?.trim()}
            hasApplication={chromeHasApplication(profile)}
          />
          <DetailedTabs
            persistent
            applicantId={applicantId}
            activeTab={activeTab}
            workerStatus={workerStatus}
          />
          <CandidateCommunicationDialog
            open={commOpen}
            onClose={() => setCommOpen(false)}
            workerId={applicantId}
            candidateName={name}
            email={worker?.email ?? null}
            phone={worker?.phone ?? null}
          />
          {children}
        </div>
      </div>
    </CandidateDetailChromeContext.Provider>
  );
}

/**
 * Persistent header + tabs for candidate detail routes.
 * Stays mounted across tab navigations so the summary card does not remount/refetch.
 */
export default function CandidateDetailChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const parsed = parseCandidateDetailRoute(pathname);

  if (!parsed?.applicantId) {
    return <>{children}</>;
  }

  return (
    <CandidateDetailChromeInner
      key={parsed.applicantId}
      applicantId={parsed.applicantId}
      activeTab={parsed.activeTab}
    >
      {children}
    </CandidateDetailChromeInner>
  );
}
