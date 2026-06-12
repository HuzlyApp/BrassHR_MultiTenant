"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkflowBuilderHeaderChrome } from "@/app/admin_recruiter/components/WorkflowBuilderHeaderBar";

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
  const base =
    "inline-flex h-full items-center border-b-2 px-0.5 text-sm font-medium leading-5 transition-colors";
  return active
    ? `${base} border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]`
    : `${base} border-transparent text-[#012352] hover:text-[color:var(--brand-primary)]`;
}

const TAB_LINKS: Array<{ id: WorkflowTab; href: string; label: string }> = [
  { id: "builder", href: `${DASHBOARD_BASE}/onboarding-builder`, label: "Builder" },
  { id: "templates", href: `${DASHBOARD_BASE}/templates`, label: "Templates" },
  { id: "my-flows", href: `${DASHBOARD_BASE}/onboarding-flows`, label: "My Flows" },
  { id: "library", href: `${DASHBOARD_BASE}/workflowlibrary`, label: "Library" },
];

export function AdminRecruiterDashboardSubNav() {
  const pathname = usePathname() ?? "";
  const { banner, center, right } = useWorkflowBuilderHeaderChrome();

  if (!isDashboardWorkflowRoute(pathname)) {
    return null;
  }

  const activeTab = getActiveTab(pathname);

  return (
    <nav
      className="sticky top-[64px] z-30 w-full border-b border-[#E4E7EC] bg-white"
      aria-label="Workflow dashboard navigation"
    >
      {banner ? (
        <div
          className="border-b px-5 py-2 lg:px-8"
          style={{
            borderColor: "#E4E7EC",
            backgroundColor: "color-mix(in srgb, var(--brand-primary) 6%, white)",
          }}
        >
          {banner}
        </div>
      ) : null}

      <div className="flex h-[56px] items-center gap-3 px-5 lg:gap-4 lg:px-8">
        <div className="flex h-full shrink-0 items-stretch gap-5 sm:gap-6">
          {TAB_LINKS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={tabClass(activeTab === tab.id)}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center px-2">
          {center ?? null}
        </div>

        <div className="flex shrink-0 items-center justify-end">{right ?? null}</div>
      </div>
    </nav>
  );
}
