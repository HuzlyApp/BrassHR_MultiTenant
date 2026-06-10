"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CANDIDATES_TABS, getActiveCandidateTab } from "./candidates-tabs-config";

function tabClass(active: boolean): string {
  return active
    ? "border-b-2 border-[color:var(--brand-primary)] pb-3 text-[color:var(--brand-primary)]"
    : "border-b-2 border-transparent pb-3 text-[#667085] transition-colors hover:text-[color:var(--brand-primary)]";
}

export function CandidatesSubTabs() {
  const pathname = usePathname() ?? "";
  const activeTab = getActiveCandidateTab(pathname);

  return (
    <nav className="mb-4 border-b border-[#E4E7EC] bg-transparent" aria-label="Candidates navigation">
      <div className="flex h-[44px] items-end gap-8 overflow-x-auto text-sm font-medium [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {CANDIDATES_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={`shrink-0 whitespace-nowrap ${tabClass(activeTab === tab.id)}`}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
