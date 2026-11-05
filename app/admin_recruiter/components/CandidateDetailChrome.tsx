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
  fetchStaffDetailJson,
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
  activity?: { source?: string | null };
  onboardingSteps?: Array<{ state: "complete" | "in_progress" | "pending" }>;
  onboardingCompletion?: { percent?: number | null };
  error?: string;
};

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
  return d.toLocaleDateString();
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

  const refresh = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await fetchStaffDetailJson<ChromeProfilePayload>(
          workerProfileApiUrl(applicantId)
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
  }, [applicantId, refreshToken]);

  const worker = profile?.worker;
  const name = `${worker?.first_name ?? ""} ${worker?.last_name ?? ""}`.trim() || "Applicant";
  const role = worker?.job_role?.trim() || "—";
  const location = [worker?.city ?? "", worker?.state ?? ""].filter(Boolean).join(", ") || null;
  const workerStatus = worker?.status ?? null;

  const progressInProgress = profile?.onboardingSteps
    ? profile.onboardingSteps.filter((step) => step.state === "in_progress").length
    : null;
  const progressUpcoming = profile?.onboardingSteps
    ? profile.onboardingSteps.filter((step) => step.state === "pending").length
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

  return (
    <CandidateDetailChromeContext.Provider value={contextValue}>
      <div className="admin-recruiter-page-pad admin-candidate-detail-chrome-active">
        <div className="admin-recruiter-content-width">
          <DetailedCandidateHeader
            persistent
            name={name}
            role={role}
            loading={loading && !worker}
            profilePhotoUrl={worker?.profile_photo_url}
            workerId={applicantId}
            candidateEmail={worker?.email ?? null}
            phone={worker?.phone ? formatPhoneForDisplay(worker.phone) : null}
            location={location}
            statusLabel={worker?.status_label ?? null}
            applicationDate={formatHeaderDate(worker?.created_at)}
            jobId={worker?.job_id ?? profile?.job_id ?? null}
            source={profile?.activity?.source ?? null}
            progressPercent={profile?.onboardingCompletion?.percent ?? null}
            progressInProgress={progressInProgress}
            progressUpcoming={progressUpcoming}
            progressDate={formatHeaderDate(worker?.updated_at ?? worker?.created_at)}
            onMessageClick={() => setCommOpen(true)}
            messageDisabled={!worker?.email?.trim() && !worker?.phone?.trim()}
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
