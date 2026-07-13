"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type ProfileSubTab = "Details" | "Resume" | "Notes";

const SUB_TABS: ProfileSubTab[] = ["Details", "Resume", "Notes"];

/** Match admin mobile layouts where embedded PDF preview is unreliable. */
const MOBILE_RESUME_MAX_WIDTH = 767;

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

function resumePreviewHref(applicantId: string) {
  return `/api/admin/worker-resume-preview?workerId=${encodeURIComponent(applicantId)}`;
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
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${MOBILE_RESUME_MAX_WIDTH}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_RESUME_MAX_WIDTH}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <nav className="mb-4 w-full min-w-0 border-b border-[#E5E7EB]" aria-label="Profile sections">
      <div className="candidate-detail-tabs-scroll overflow-x-auto">
        <div className="mx-auto flex w-max min-w-full items-end justify-center gap-x-6 px-1">
          {SUB_TABS.map((tab) => {
            const isActive = tab === activeTab;
            const href = subTabHref(tab, id, isWorkerRoute);

            // Mobile: open PDF in a real new tab via native anchor (avoids popup blockers).
            if (tab === "Resume" && isMobile && id) {
              return (
                <a
                  key={tab}
                  href={resumePreviewHref(id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={tabLinkClass(false)}
                >
                  Resume
                </a>
              );
            }

            return (
              <Link key={tab} href={href} className={tabLinkClass(isActive)}>
                {tab}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
