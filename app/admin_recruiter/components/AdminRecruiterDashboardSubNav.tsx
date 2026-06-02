"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const DASHBOARD_BASE = "/admin_recruiter/dashboard";

type WorkflowTab = "builder" | "templates" | "my-flows" | "library";

function isDashboardWorkflowRoute(pathname: string): boolean {
  return (
    pathname === DASHBOARD_BASE ||
    pathname.startsWith(`${DASHBOARD_BASE}/onboarding-builder`) ||
    pathname.startsWith(`${DASHBOARD_BASE}/templates`) ||
    pathname.startsWith(`${DASHBOARD_BASE}/workflowlibrary`) ||
    pathname.startsWith(`${DASHBOARD_BASE}/onboarding-flows`)
  );
}

function getActiveTab(pathname: string): WorkflowTab | null {
  if (pathname.startsWith(`${DASHBOARD_BASE}/onboarding-builder`)) return "builder";
  if (pathname.startsWith(`${DASHBOARD_BASE}/templates`)) return "templates";
  if (pathname.startsWith(`${DASHBOARD_BASE}/onboarding-flows`)) return "my-flows";
  if (pathname.startsWith(`${DASHBOARD_BASE}/workflowlibrary`)) return "library";
  return null;
}

function tabClass(active: boolean): string {
  return active
    ? "cursor-pointer border-b-2 border-[#C7922F] pb-1 text-[#C7922F]"
    : "cursor-pointer text-[#012352] transition-colors hover:text-[#C7922F]";
}

export function AdminRecruiterDashboardSubNav() {
  const pathname = usePathname() ?? "";

  if (!isDashboardWorkflowRoute(pathname)) {
    return null;
  }

  const activeTab = getActiveTab(pathname);
  const showBreadcrumb =
    pathname.startsWith(`${DASHBOARD_BASE}/onboarding-builder`) ||
    pathname.startsWith(`${DASHBOARD_BASE}/templates`) ||
    pathname.startsWith(`${DASHBOARD_BASE}/workflowlibrary`) ||
    pathname.startsWith(`${DASHBOARD_BASE}/onboarding-flows`);

  const breadcrumbCurrent = pathname.startsWith(`${DASHBOARD_BASE}/onboarding-builder`)
    ? "Onboarding Builder"
    : pathname.startsWith(`${DASHBOARD_BASE}/onboarding-flows`)
      ? "Onboarding Flows"
      : "Workflow Library";

  return (
    <nav
      className="sticky top-[64px] z-30 flex h-[62px] w-full items-center justify-between border-b border-[#E4E7EC] bg-white px-5 lg:px-8"
      aria-label="Workflow dashboard navigation"
    >
      {showBreadcrumb ? (
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-[#667085]">
          <Link href={DASHBOARD_BASE} className="hover:text-[#344054]">
            Dashboard
          </Link>
          <span aria-hidden>&gt;</span>
          <span className="truncate text-[#344054]">{breadcrumbCurrent}</span>
        </div>
      ) : (
        <span className="sr-only">Dashboard workflow navigation</span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-6 text-sm">
        <Link href={`${DASHBOARD_BASE}/onboarding-builder`} className={tabClass(activeTab === "builder")}>
          Builder
        </Link>
        <Link href={`${DASHBOARD_BASE}/templates`} className={tabClass(activeTab === "templates")}>
          Templates
        </Link>
        <Link href={`${DASHBOARD_BASE}/onboarding-flows`} className={tabClass(activeTab === "my-flows")}>
          My Flows
        </Link>
        <Link href={`${DASHBOARD_BASE}/workflowlibrary`} className={tabClass(activeTab === "library")}>
          Library
        </Link>
      </div>
    </nav>
  );
}
