"use client";

import Link from "next/link";

const TABS = [
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

type TabName = (typeof TABS)[number];

type DetailedTabsProps = {
  applicantId?: string;
  activeTab: TabName;
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
    case "History":
      return `/admin_recruiter/new/history/${id}`;
  }
}

export default function DetailedTabs({ applicantId, activeTab }: DetailedTabsProps) {
  return (
    <nav className="mb-6 w-full" aria-label="Applicant sections">
      <div className="mx-auto flex w-full max-w-[1300px] flex-wrap items-start justify-center gap-1">
        {TABS.map((tab) => {
          const isActive = tab === activeTab;
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
