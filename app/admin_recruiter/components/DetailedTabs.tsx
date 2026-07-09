"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCandidateAlreadyConverted } from "@/lib/admin/convert-candidate-to-worker";
import {
  CANDIDATE_PIPELINE_REFRESH_EVENT,
  type CandidatePipelineRefreshDetail,
} from "@/lib/admin/candidate-pipeline-events";
import {
  buildCandidatePipelineSteps,
  type CandidatePipelineChecklistPayload,
  type CandidatePipelineProfilePayload,
} from "@/lib/admin/candidate-pipeline-stepper";
import CandidatePipelineStepper from "./CandidatePipelineStepper";

const BASE_TABS = [
  "Checklist",
  "Profile",
  "Attachments",
  "Skill Assessments",
  "Authorization",
  "Activities",
  "Facility Assignments",
  "Agreement",
  "History",
] as const;

const ONBOARDED_TAB = "Onboarded Applicant" as const;

type BaseTabName = (typeof BASE_TABS)[number];
type TabName = BaseTabName | typeof ONBOARDED_TAB;

type DetailedTabsProps = {
  applicantId?: string;
  activeTab?: TabName;
  /** When the parent page already loaded worker status, skip the extra profile fetch delay. */
  workerStatus?: string | null;
  /** Live checklist payload from the Checklist tab — keeps the stepper in sync without a second fetch. */
  checklistPayload?: CandidatePipelineChecklistPayload | null;
};

const ONBOARDED_CACHE_PREFIX = "brasshr-onboarded-worker:";

function readOnboardedCache(applicantId?: string): boolean {
  if (!applicantId || typeof window === "undefined") return false;
  return sessionStorage.getItem(`${ONBOARDED_CACHE_PREFIX}${applicantId}`) === "1";
}

function writeOnboardedCache(applicantId: string, onboarded: boolean) {
  if (typeof window === "undefined") return;
  const key = `${ONBOARDED_CACHE_PREFIX}${applicantId}`;
  if (onboarded) sessionStorage.setItem(key, "1");
  else sessionStorage.removeItem(key);
}

function tabHref(tab: TabName, applicantId?: string) {
  const id = applicantId ?? "";
  switch (tab) {
    case "Checklist":
      return `/admin_recruiter/new/checklist/${id}`;
    case "Profile":
      return `/admin_recruiter/new/profile/${id}`;
    case "Attachments":
      return `/admin_recruiter/new/attachments/${id}`;
    case "Skill Assessments":
      return `/admin_recruiter/new/skill-assessments/${id}`;
    case "Authorization":
      return `/admin_recruiter/new/authorization/${id}`;
    case "Activities":
      return `/admin_recruiter/new/activities/${id}`;
    case "Facility Assignments":
      return `/admin_recruiter/new/facility-assignments/${id}`;
    case "Agreement":
      return `/admin_recruiter/new/agreement/${id}`;
    case "History":
      return `/admin_recruiter/new/history/${id}`;
    case "Onboarded Applicant":
      return `/admin_recruiter/new/onboard-applicant/${id}`;
  }
}

export default function DetailedTabs({
  applicantId,
  activeTab,
  workerStatus,
  checklistPayload,
}: DetailedTabsProps) {
  const [isOnboarded, setIsOnboarded] = useState(() => {
    if (workerStatus != null) return isCandidateAlreadyConverted({ status: workerStatus });
    return readOnboardedCache(applicantId);
  });
  const [profilePayload, setProfilePayload] = useState<CandidatePipelineProfilePayload | null>(null);
  const [fetchedChecklist, setFetchedChecklist] = useState<CandidatePipelineChecklistPayload | null>(null);
  const [pipelineRefreshToken, setPipelineRefreshToken] = useState(0);
  const hasLiveChecklistRef = useRef(false);
  hasLiveChecklistRef.current = checklistPayload != null;

  const refreshPipelineData = useCallback(() => {
    setPipelineRefreshToken((value) => value + 1);
  }, []);

  useEffect(() => {
    if (workerStatus != null) {
      const onboarded = isCandidateAlreadyConverted({ status: workerStatus });
      setIsOnboarded(onboarded);
      if (applicantId) writeOnboardedCache(applicantId, onboarded);
    }

    if (!applicantId) {
      if (workerStatus == null) setIsOnboarded(false);
      setProfilePayload(null);
      setFetchedChecklist(null);
      return;
    }

    if (workerStatus == null && readOnboardedCache(applicantId)) {
      setIsOnboarded(true);
    }

    let cancelled = false;
    const skipChecklistFetch = hasLiveChecklistRef.current;

    void Promise.all([
      fetch(`/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`, {
        cache: "no-store",
      }),
      skipChecklistFetch
        ? Promise.resolve(null)
        : fetch(`/api/admin/worker-checklist?workerId=${encodeURIComponent(applicantId)}`, {
            cache: "no-store",
          }),
    ])
      .then(async ([profileRes, checklistRes]) => {
        const profile = profileRes.ok
          ? ((await profileRes.json()) as CandidatePipelineProfilePayload)
          : {};
        const checklist = checklistRes?.ok
          ? ((await checklistRes.json()) as CandidatePipelineChecklistPayload)
          : {};

        if (cancelled) return;

        if (workerStatus == null) {
          const worker = profile.worker;
          const onboarded = isCandidateAlreadyConverted(worker ?? {});
          setIsOnboarded(onboarded);
          writeOnboardedCache(applicantId, onboarded);
        }

        setProfilePayload(profile);
        if (!skipChecklistFetch) {
          setFetchedChecklist(checklist);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (workerStatus == null) setIsOnboarded(readOnboardedCache(applicantId));
        setProfilePayload(null);
        if (!skipChecklistFetch) setFetchedChecklist(null);
      });

    return () => {
      cancelled = true;
    };
  }, [applicantId, workerStatus, pipelineRefreshToken]);

  useEffect(() => {
    if (!applicantId) return;

    function handlePipelineRefresh(event: Event) {
      const detail = (event as CustomEvent<CandidatePipelineRefreshDetail>).detail;
      if (detail?.workerId === applicantId) {
        refreshPipelineData();
      }
    }

    window.addEventListener(CANDIDATE_PIPELINE_REFRESH_EVENT, handlePipelineRefresh);
    return () => {
      window.removeEventListener(CANDIDATE_PIPELINE_REFRESH_EVENT, handlePipelineRefresh);
    };
  }, [applicantId, refreshPipelineData]);

  const pipelineSteps = useMemo(() => {
    if (!applicantId) return null;
    const checklist = checklistPayload ?? fetchedChecklist ?? {};
    return buildCandidatePipelineSteps(profilePayload ?? {}, checklist, applicantId);
  }, [applicantId, checklistPayload, fetchedChecklist, profilePayload]);

  const showOnboardedTab =
    activeTab === ONBOARDED_TAB ||
    isOnboarded ||
    isCandidateAlreadyConverted({ status: workerStatus }) ||
    (workerStatus ?? "").trim().toLowerCase() === "approved";

  const tabs = useMemo<TabName[]>(
    () => (showOnboardedTab ? [...BASE_TABS, ONBOARDED_TAB] : [...BASE_TABS]),
    [showOnboardedTab]
  );

  return (
    <div className="mb-6 w-full min-w-0">
      <CandidatePipelineStepper
        steps={pipelineSteps ?? undefined}
        applicantId={applicantId}
        className="mb-6"
      />

      <nav className="w-full min-w-0" aria-label="Applicant sections">
        <div className="candidate-detail-tabs-scroll overflow-x-auto pb-1 md:overflow-x-auto">
            <div className="mx-auto flex w-max min-w-full flex-nowrap justify-center gap-1">
              {tabs.map((tab) => {
                const isActive = activeTab != null && tab === activeTab;
                return (
                  <Link
                    key={tab}
                    href={tabHref(tab, applicantId)}
                    className={`inline-flex min-h-9 shrink-0 flex-col items-center justify-center rounded px-2.5 py-0.5 text-sm font-medium leading-none whitespace-nowrap transition-colors ${
                      isActive
                        ? "text-[color:var(--brand-primary)]"
                        : "text-[#2B3D51] hover:text-[color:var(--brand-primary)]"
                    }`}
                  >
                    <span>{tab}</span>
                    <span
                      className={`mt-1.5 block h-0.5 w-full rounded-full ${
                        isActive ? "bg-[color:var(--brand-primary)]" : "bg-transparent"
                      }`}
                      aria-hidden
                    />
                  </Link>
                );
              })}
            </div>
        </div>
      </nav>
    </div>
  );
}
