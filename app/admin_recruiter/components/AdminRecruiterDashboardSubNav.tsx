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
      className="sticky top-[var(--admin-recruiter-header-height,67px)] z-30 w-full shrink-0 border-b border-[#E4E7EC] bg-white"
      aria-label="Workflow builder toolbar"
    >
      <div className="flex min-h-[var(--admin-recruiter-subnav-height,56px)] items-center gap-2 px-3 py-1.5 min-[1000px]:gap-3 min-[1000px]:px-4 min-[1000px]:py-2 sm:min-[1000px]:px-5 lg:min-[1000px]:px-8">
        <div className="min-w-0 flex-1 overflow-hidden">{center ?? null}</div>
        <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1 overflow-x-auto min-[1000px]:gap-2">
          {right ?? null}
        </div>
      </div>
    </nav>
  );
}
