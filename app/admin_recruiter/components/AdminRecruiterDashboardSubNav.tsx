"use client";

import { usePathname } from "next/navigation";
import { useWorkflowBuilderHeaderChrome } from "@/app/admin_recruiter/components/WorkflowBuilderHeaderBar";

const DASHBOARD_BASE = "/admin_recruiter/dashboard";
const BUILDER_ROUTE = `${DASHBOARD_BASE}/onboarding-builder`;

function isBuilderRoute(pathname: string): boolean {
  return pathname.startsWith(BUILDER_ROUTE);
}

export function AdminRecruiterDashboardSubNav() {
  const pathname = usePathname() ?? "";
  const { center, right } = useWorkflowBuilderHeaderChrome();

  if (!isBuilderRoute(pathname)) {
    return null;
  }

  return (
    <nav
      className="sticky top-[var(--admin-recruiter-header-height,67px)] z-30 w-full border-b border-[#E4E7EC] bg-white"
      aria-label="Workflow builder toolbar"
    >
      <div className="flex h-[56px] items-center justify-between gap-4 px-5 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center">{center ?? null}</div>
        <div className="flex shrink-0 items-center justify-end">{right ?? null}</div>
      </div>
    </nav>
  );
}
