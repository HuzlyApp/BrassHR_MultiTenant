"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TicketsTab = "tickets" | "departments" | "knowledgebase";

const BASE = "/application/applicant-dashboard/tickets";

function tabClass(active: boolean): string {
  const base =
    "inline-flex items-center border-b-[1.5px] px-2 pb-2.5 pt-1 text-sm font-normal leading-5 transition-colors";
  return active
    ? `${base} border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]`
    : `${base} border-transparent text-[#012352] hover:text-[color:var(--brand-primary)]`;
}

const TAB_LINKS: Array<{ id: TicketsTab; href: string; label: string }> = [
  { id: "tickets", href: BASE, label: "Tickets" },
  { id: "departments", href: `${BASE}/departments`, label: "Departments" },
  { id: "knowledgebase", href: `${BASE}/knowledgebase`, label: "Knowledgebase" },
];

function getActiveTab(pathname: string): TicketsTab {
  if (pathname.startsWith(`${BASE}/departments`)) return "departments";
  if (pathname.startsWith(`${BASE}/knowledgebase`)) return "knowledgebase";
  return "tickets";
}

export function WorkerTicketsSubNav({ action }: { action?: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const activeTab = getActiveTab(pathname);

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] pt-1">
      <nav aria-label="Tickets sections" className="flex flex-wrap items-center gap-6">
        {TAB_LINKS.map((tab) => (
          <Link key={tab.id} href={tab.href} className={tabClass(activeTab === tab.id)}>
            {tab.label}
          </Link>
        ))}
      </nav>
      {action ? <div className="pb-2">{action}</div> : null}
    </div>
  );
}
