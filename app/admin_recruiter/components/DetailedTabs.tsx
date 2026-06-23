"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const BASE_TABS = [
  "Checklist",
  "Profile",
  "Attachments",
  "Skill Assessments",
  "Authorization",
  "Activities",
  "Facility Assignments",
  "Agreement",
  "Final Approval",
] as const;

const ONBOARD_TAB = "Onboard Applicant" as const;

type BaseTabName = (typeof BASE_TABS)[number];
type TabName = BaseTabName | typeof ONBOARD_TAB;

type DetailedTabsProps = {
  applicantId?: string;
  activeTab?: TabName;
  /** When the parent page already loaded worker status, skip the extra profile fetch delay. */
  workerStatus?: string | null;
};

const APPROVED_CACHE_PREFIX = "brasshr-approved-worker:";

function readApprovedCache(applicantId?: string): boolean {
  if (!applicantId || typeof window === "undefined") return false;
  return sessionStorage.getItem(`${APPROVED_CACHE_PREFIX}${applicantId}`) === "1";
}

function writeApprovedCache(applicantId: string, approved: boolean) {
  if (typeof window === "undefined") return;
  const key = `${APPROVED_CACHE_PREFIX}${applicantId}`;
  if (approved) sessionStorage.setItem(key, "1");
  else sessionStorage.removeItem(key);
}

function isApprovedStatus(status: string | null | undefined): boolean {
  return status?.toString().trim().toLowerCase() === "approved";
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
    case "Final Approval":
      return `/admin_recruiter/new/final-approval/${id}`;
    case "Onboard Applicant":
      return `/admin_recruiter/new/onboard-applicant/${id}`;
  }
}

export default function DetailedTabs({ applicantId, activeTab, workerStatus }: DetailedTabsProps) {
  const [isApproved, setIsApproved] = useState(() => {
    if (activeTab === ONBOARD_TAB) return true;
    if (workerStatus != null) return isApprovedStatus(workerStatus);
    return readApprovedCache(applicantId);
  });

  useEffect(() => {
    if (workerStatus != null) {
      const approved = isApprovedStatus(workerStatus);
      setIsApproved(approved);
      if (applicantId) writeApprovedCache(applicantId, approved);
      return;
    }

    if (!applicantId) {
      setIsApproved(false);
      return;
    }

    if (activeTab === ONBOARD_TAB) {
      setIsApproved(true);
      writeApprovedCache(applicantId, true);
      return;
    }

    if (readApprovedCache(applicantId)) {
      setIsApproved(true);
    }

    let cancelled = false;
    void fetch(`/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { worker?: { status?: string | null } } | null) => {
        if (cancelled) return;
        const approved = isApprovedStatus(payload?.worker?.status);
        setIsApproved(approved);
        writeApprovedCache(applicantId, approved);
      })
      .catch(() => {
        if (!cancelled) setIsApproved(readApprovedCache(applicantId));
      });

    return () => {
      cancelled = true;
    };
  }, [applicantId, activeTab, workerStatus]);

  const showOnboardTab =
    activeTab === ONBOARD_TAB || isApproved || isApprovedStatus(workerStatus);

  const tabs = useMemo<TabName[]>(
    () => (showOnboardTab ? [...BASE_TABS, ONBOARD_TAB] : [...BASE_TABS]),
    [showOnboardTab]
  );

  return (
    <nav className="mb-6 w-full" aria-label="Applicant sections">
      <div className="flex w-full min-w-0 flex-wrap items-start justify-center gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab != null && tab === activeTab;
          return (
            <Link
              key={tab}
              href={tabHref(tab, applicantId)}
              className={`inline-flex shrink-0 flex-col items-center rounded px-2 py-1 text-sm font-medium leading-none whitespace-nowrap transition-colors ${
                isActive
                  ? "text-[color:var(--brand-primary)]"
                  : "text-[#2B3D51] hover:text-[color:var(--brand-primary)]"
              }`}
            >
              <span>{tab}</span>
              <span
                className={`mt-2 block h-0.5 w-full rounded-full ${
                  isActive ? "bg-[color:var(--brand-primary)]" : "bg-transparent"
                }`}
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
