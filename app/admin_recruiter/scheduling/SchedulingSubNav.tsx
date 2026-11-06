"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ScheduleSubTab = "week_view" | "who_is_off";

function tabClass(active: boolean): string {
  const base =
    "inline-flex items-center border-b-[2px] px-3 pb-2.5 pt-1 text-sm font-medium leading-5 transition-colors";
  return active
    ? `${base} border-[color:var(--brand-primary,#BC8B41)] text-[color:var(--brand-primary,#BC8B41)]`
    : `${base} border-transparent text-[#64748B] hover:text-[color:var(--brand-primary,#BC8B41)]`;
}

const TAB_LINKS: Array<{ id: ScheduleSubTab; href: string; label: string }> = [
  { id: "week_view", href: "/admin_recruiter/calendar/shifts", label: "Week View" },
  { id: "who_is_off", href: "/admin_recruiter/scheduling/who-is-off", label: "Who is off" },
];

function getActiveTab(pathname: string): ScheduleSubTab {
  if (pathname.includes("/who-is-off")) return "who_is_off";
  return "week_view";
}

export function SchedulingSubNav() {
  const pathname = usePathname() ?? "";
  const activeTab = getActiveTab(pathname);

  return (
    <nav
      aria-label="Schedule sections"
      className="mb-4 flex flex-wrap items-center gap-2 border-b border-[#E2E8F0]"
    >
      {TAB_LINKS.map((tab) => (
        <Link key={tab.id} href={tab.href} className={tabClass(activeTab === tab.id)}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
