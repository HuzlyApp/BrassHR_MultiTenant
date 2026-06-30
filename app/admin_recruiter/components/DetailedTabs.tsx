"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isCandidateAlreadyConverted } from "@/lib/admin/convert-candidate-to-worker";
import {
  buildCandidatePipelineSteps,
  type CandidatePipelineStep,
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

export default function DetailedTabs({ applicantId, activeTab, workerStatus }: DetailedTabsProps) {
  const [isOnboarded, setIsOnboarded] = useState(() => {
    if (workerStatus != null) return isCandidateAlreadyConverted({ status: workerStatus });
    return readOnboardedCache(applicantId);
  });
  const [pipelineSteps, setPipelineSteps] = useState<CandidatePipelineStep[] | null>(null);

  useEffect(() => {
    if (workerStatus != null) {
      const onboarded = isCandidateAlreadyConverted({ status: workerStatus });
      setIsOnboarded(onboarded);
      if (applicantId) writeOnboardedCache(applicantId, onboarded);
    }

    if (!applicantId) {
      if (workerStatus == null) setIsOnboarded(false);
      setPipelineSteps(null);
      return;
    }

    if (workerStatus == null && readOnboardedCache(applicantId)) {
      setIsOnboarded(true);
    }

    let cancelled = false;

    void Promise.all([
      fetch(`/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`, {
        cache: "no-store",
      }),
      fetch(`/api/admin/worker-checklist?workerId=${encodeURIComponent(applicantId)}`, {
        cache: "no-store",
      }),
    ])
      .then(async ([profileRes, checklistRes]) => {
        const profile = profileRes.ok
          ? ((await profileRes.json()) as Record<string, unknown>)
          : {};
        const checklist = checklistRes.ok
          ? ((await checklistRes.json()) as Record<string, unknown>)
          : {};

        if (cancelled) return;

        if (workerStatus == null) {
          const worker = profile.worker as { status?: string | null } | undefined;
          const onboarded = isCandidateAlreadyConverted(worker ?? {});
          setIsOnboarded(onboarded);
          writeOnboardedCache(applicantId, onboarded);
        }

        setPipelineSteps(
          buildCandidatePipelineSteps(
            profile as Parameters<typeof buildCandidatePipelineSteps>[0],
            checklist as Parameters<typeof buildCandidatePipelineSteps>[1]
          )
        );
      })
      .catch(() => {
        if (cancelled) return;
        if (workerStatus == null) setIsOnboarded(readOnboardedCache(applicantId));
        setPipelineSteps(null);
      });

    return () => {
      cancelled = true;
    };
  }, [applicantId, workerStatus]);

  const showOnboardedTab =
    activeTab === ONBOARDED_TAB ||
    isOnboarded ||
    isCandidateAlreadyConverted({ status: workerStatus });

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
        <div className="candidate-detail-tabs-scroll overflow-x-auto pb-1">
            <div className="mx-auto flex w-max min-w-full justify-center gap-1">
              {tabs.map((tab) => {
                const isActive = activeTab != null && tab === activeTab;
                return (
                  <Link
                    key={tab}
                    href={tabHref(tab, applicantId)}
                    className={`inline-flex shrink-0 flex-col items-center rounded px-2.5 py-0.5 text-sm font-medium leading-none whitespace-nowrap transition-colors ${
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
