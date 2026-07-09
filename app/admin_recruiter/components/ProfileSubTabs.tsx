"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ProfileSubTab = "Details" | "Resume" | "Notes";

const SUB_TABS: ProfileSubTab[] = ["Details", "Resume", "Notes"];

type ProfileSubTabsProps = {
  applicantId?: string;
  activeTab: ProfileSubTab;
};

function subTabHref(tab: ProfileSubTab, applicantId: string, isWorkerRoute: boolean) {
  if (isWorkerRoute) {
    switch (tab) {
      case "Details":
        return `/admin_recruiter/workers/${applicantId}/profile`;
      case "Resume":
        return `/admin_recruiter/workers/${applicantId}/profile/resume`;
      case "Notes":
        return `/admin_recruiter/workers/${applicantId}/profile/notes`;
    }
  }
  switch (tab) {
    case "Details":
      return `/admin_recruiter/new/profile/${applicantId}`;
    case "Resume":
      return `/admin_recruiter/new/profile/resume/${applicantId}`;
    case "Notes":
      return `/admin_recruiter/new/profile/notes/${applicantId}`;
  }
}

const tabLinkClass = (isActive: boolean) =>
  `shrink-0 px-0 pb-3 pt-1 text-sm font-medium leading-5 whitespace-nowrap transition-colors ${
    isActive
      ? "-mb-px border-b-2 border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]"
      : "border-b-2 border-transparent text-[#2B3D51] hover:text-[color:var(--brand-primary)]"
  }`;

export default function ProfileSubTabs({ applicantId, activeTab }: ProfileSubTabsProps) {
  const pathname = usePathname();
  const isWorkerRoute = pathname?.startsWith("/admin_recruiter/workers/") ?? false;
  const id = applicantId ?? "";

  return (
    <nav className="mb-4 w-full min-w-0 border-b border-[#E5E7EB]" aria-label="Profile sections">
      <div className="candidate-detail-tabs-scroll overflow-x-auto">
        <div className="mx-auto flex w-max min-w-full items-end justify-center gap-x-6 px-1">
          {SUB_TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <Link
                key={tab}
                href={subTabHref(tab, id, isWorkerRoute)}
                className={tabLinkClass(isActive)}
              >
                {tab}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
