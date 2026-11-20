"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, List } from "lucide-react";

export type ScheduleViewMode = "calendar" | "list";

const DEFAULT_SCHEDULE_HREF = "/admin_recruiter/calendar/shifts";

function isSchedulePath(pathname: string): boolean {
  return (
    pathname.includes("/calendar/shifts") ||
    (pathname.includes("/admin_recruiter/scheduling") && !pathname.includes("/who-is-off"))
  );
}

export function getScheduleViewMode(
  pathname: string,
  viewParam: string | null
): ScheduleViewMode | null {
  if (!isSchedulePath(pathname)) return null;
  return viewParam === "list" ? "list" : "calendar";
}

function scheduleBaseHref(pathname: string): string {
  if (pathname.includes("/admin_recruiter/scheduling") && !pathname.includes("/who-is-off")) {
    return "/admin_recruiter/scheduling";
  }
  if (pathname.includes("/calendar/shifts")) {
    return "/admin_recruiter/calendar/shifts";
  }
  return DEFAULT_SCHEDULE_HREF;
}

type SchedulingSubNavProps = {
  /** Controlled view when rendered inside the schedule page. */
  activeView?: ScheduleViewMode;
  onViewChange?: (view: ScheduleViewMode) => void;
};

export function SchedulingSubNav({ activeView, onViewChange }: SchedulingSubNavProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const urlView = getScheduleViewMode(pathname, searchParams.get("view"));
  const resolvedActive = activeView ?? urlView;
  const baseHref = scheduleBaseHref(pathname);
  const controlled = typeof onViewChange === "function";

  const tabs: Array<{
    id: ScheduleViewMode;
    href: string;
    label: string;
    icon: typeof CalendarDays;
  }> = [
    {
      id: "calendar",
      href: baseHref,
      label: "Calendar",
      icon: CalendarDays,
    },
    {
      id: "list",
      href: `${baseHref}?view=list`,
      label: "List",
      icon: List,
    },
  ];

  return (
    <nav
      aria-label="Schedule views"
      className="inline-flex items-center rounded-[8px] bg-[#E5E7EB] p-0.5"
    >
      {tabs.map((tab) => {
        const active = resolvedActive === tab.id;
        const Icon = tab.icon;
        const className = `inline-flex h-[30px] items-center gap-1 rounded-[8px] px-2.5 text-[10px] leading-[15px] transition-colors ${
          active
            ? "bg-[color:var(--brand-secondary,#012352)] font-medium text-white"
            : "bg-transparent font-normal text-[color:var(--brand-secondary,#012352)] hover:bg-white/60"
        }`;

        if (controlled) {
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onViewChange(tab.id)}
              aria-pressed={active}
              className={`cursor-pointer ${className}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{tab.label}</span>
            </button>
          );
        }

        return (
          <Link key={tab.id} href={tab.href} className={className}>
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
