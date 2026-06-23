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
};

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

export default function DetailedTabs({ applicantId, activeTab }: DetailedTabsProps) {
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    if (!applicantId) {
      setIsApproved(false);
      return;
    }

    let cancelled = false;
    void fetch(`/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { worker?: { status?: string | null } } | null) => {
        if (cancelled) return;
        const status = payload?.worker?.status?.toString().trim().toLowerCase() ?? "";
        setIsApproved(status === "approved");
      })
      .catch(() => {
        if (!cancelled) setIsApproved(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applicantId]);

  const tabs = useMemo<TabName[]>(
    () => (isApproved ? [...BASE_TABS, ONBOARD_TAB] : [...BASE_TABS]),
    [isApproved]
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
