"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SchedulingTab = "schedule" | "attendance";

function tabClass(active: boolean): string {
  const base =
    "inline-flex items-center border-b-[1.5px] px-2 pb-2.5 pt-1 text-sm font-normal leading-5 transition-colors";
  return active
    ? `${base} border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]`
    : `${base} border-transparent text-[#012352] hover:text-[color:var(--brand-primary)]`;
}

const TAB_LINKS: Array<{ id: SchedulingTab; href: string; label: string }> = [
  { id: "schedule", href: "/admin_recruiter/calendar/shifts", label: "Schedule" },
  { id: "attendance", href: "/admin_recruiter/attendance", label: "Time & Attendance" },
];

function getActiveTab(pathname: string): SchedulingTab {
  if (pathname.startsWith("/admin_recruiter/attendance")) return "attendance";
  return "schedule";
}

export function SchedulingSubNav() {
  const pathname = usePathname() ?? "";
  const activeTab = getActiveTab(pathname);

  return (
    <nav
      aria-label="Scheduling sections"
      className="mb-6 flex flex-wrap items-center gap-4"
    >
      {TAB_LINKS.map((tab) => (
        <Link key={tab.id} href={tab.href} className={tabClass(activeTab === tab.id)}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
