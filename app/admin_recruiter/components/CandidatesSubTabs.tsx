"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CANDIDATES_TABS, getActiveCandidateTab } from "./candidates-tabs-config";

export function CandidatesSubTabs() {
  const pathname = usePathname() ?? "";
  const activeTab = getActiveCandidateTab(pathname);

  return (
    <nav className="mb-4 w-full min-w-0" aria-label="Candidates navigation">
      <div className="candidate-detail-tabs-scroll flex w-full min-w-0 flex-nowrap items-start gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {CANDIDATES_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`inline-flex shrink-0 flex-col items-center rounded px-3 py-1.5 text-sm font-medium leading-none whitespace-nowrap transition-colors ${
                isActive
                  ? "text-[color:var(--brand-primary)]"
                  : "text-[#2B3D51] hover:text-[color:var(--brand-primary)]"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <span>{tab.label}</span>
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
