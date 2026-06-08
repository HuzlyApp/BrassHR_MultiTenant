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
    <nav
      className="mb-4 mx-auto flex w-full max-w-[1300px] flex-wrap items-end gap-x-8 gap-y-2 border-b border-[#E5E7EB]"
      aria-label="Applicant sections"
    >
      {TABS.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <Link
            key={tab}
            href={tabHref(tab, applicantId)}
            className={`shrink-0 px-0 pb-3 pt-1 text-sm font-medium leading-5 whitespace-nowrap transition-colors ${
              isActive
                ? "-mb-px border-b-2 border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]"
                : "border-b-2 border-transparent text-[#2B3D51] hover:text-[color:var(--brand-primary)]"
            }`}
          >
            {tab}
          </Link>
        );
      })}
    </nav>
  );
}
