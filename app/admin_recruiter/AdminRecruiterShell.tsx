"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { AdminTenantBrandingProvider } from "@/app/components/tenant/AdminTenantBrandingProvider";
import { AccountDataProvider } from "@/app/admin_recruiter/account/AccountDataProvider";
import { StaffAccessSeed } from "@/lib/admin/hooks/use-staff-module-access";
import type { StaffAccessRecord } from "@/lib/admin/staff-access-cache";
import {
  AdminRecruiterSidebar,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_COLLAPSED_WIDTH_NARROW,
  SIDEBAR_COLLAPSED_WIDTH_MOBILE,
  SIDEBAR_EXPANDED_WIDTH,
} from "./components/AdminRecruiterSidebar";
import { AdminRecruiterHeader } from "./components/AdminRecruiterHeader";
import { AdminRecruiterDashboardSubNav } from "./components/AdminRecruiterDashboardSubNav";
import { WorkflowDashboardHeaderProvider } from "./components/WorkflowDashboardHeaderContext";
import GodAdminImpersonationBanner from "./components/GodAdminImpersonationBanner";
import { AdminStaffAuthGuard } from "./components/AdminStaffAuthGuard";
import { isCandidateDetailPage } from "./components/candidate-detail-navigation";
import "./layout.css";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "adminRecruiterSidebarCollapsed";

function AccessDeniedNotice() {
  const pathname = usePathname();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("access") !== "denied") return;
    toast.error("You don't have access to that page.");
    params.delete("access");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [pathname]);

  return null;
}

function CloseMobileNavOnNavigate({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  return null;
}

function CandidateDetailFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  if (!isCandidateDetailPage(pathname)) return children;
  return <div className="admin-candidate-detail-shell">{children}</div>;
}

/**
 * Default body copy color for recruiter admin; pages still set explicit colors
 * (e.g. sidebar `text-white`, links `text-teal-*`) where needed.
 */
export default function AdminRecruiterShell({
  children,
  initialAccess,
}: {
  children: ReactNode;
  initialAccess?: StaffAccessRecord | null;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const closeMobileNav = useCallback(() => setMobileSidebarOpen(false), []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (stored === "true") setSidebarCollapsed(true);
      else if (stored === "false") setSidebarCollapsed(false);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <AdminTenantBrandingProvider>
      <StaffAccessSeed initialAccess={initialAccess ?? null}>
      <AdminStaffAuthGuard>
      <AccountDataProvider>
      <AccessDeniedNotice />
      <CloseMobileNavOnNavigate onClose={closeMobileNav} />
      <div
        className="admin-recruiter-shell min-h-screen text-gray-600"
        style={{
          backgroundColor: "#F4F4F4",
          ["--admin-sidebar-width" as string]: `${sidebarWidth}px`,
          ["--admin-sidebar-collapsed-width" as string]: `${SIDEBAR_COLLAPSED_WIDTH}px`,
          ["--admin-sidebar-collapsed-width-narrow" as string]: `${SIDEBAR_COLLAPSED_WIDTH_NARROW}px`,
          ["--admin-sidebar-collapsed-width-mobile" as string]: `${SIDEBAR_COLLAPSED_WIDTH_MOBILE}px`,
        }}
      >
        <AdminRecruiterSidebar
          collapsed={sidebarCollapsed}
          isMobileOpen={mobileSidebarOpen}
          onMobileClose={closeMobileNav}
        />
        <div
          className="admin-recruiter-content admin-recruiter-main-wrap min-h-screen"
          data-mobile-nav-open={mobileSidebarOpen ? "true" : "false"}
        >
          <GodAdminImpersonationBanner />
          <AdminRecruiterHeader
            onMenuClick={() => setMobileSidebarOpen(true)}
            mobileNavOpen={mobileSidebarOpen}
            sidebarCollapsed={sidebarCollapsed}
            onSidebarToggle={toggleSidebarCollapsed}
          />
          <WorkflowDashboardHeaderProvider>
            <AdminRecruiterDashboardSubNav />
            <CandidateDetailFrame>{children}</CandidateDetailFrame>
          </WorkflowDashboardHeaderProvider>
        </div>
      </div>
      </AccountDataProvider>
      </AdminStaffAuthGuard>
      </StaffAccessSeed>
    </AdminTenantBrandingProvider>
  );
}
