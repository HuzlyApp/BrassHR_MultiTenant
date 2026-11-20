"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { AdminTenantBrandingProvider } from "@/app/components/tenant/AdminTenantBrandingProvider";
import { AccountDataProvider } from "@/app/admin_recruiter/account/AccountDataProvider";
import SettingsSidebar from "@/app/admin_recruiter/settings/SettingsSidebar";
import { isSettingsMiniSidebarPath } from "@/app/admin_recruiter/settings/settings-nav";
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
import CandidateDetailChrome from "./components/CandidateDetailChrome";
import AnalyticsSessionTracker from "@/app/components/AnalyticsSessionTracker";
import "./layout.css";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "adminRecruiterSidebarCollapsed";

function persistSidebarCollapsed(next: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
  } catch {
    /* ignore */
  }
}

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
  return (
    <div className="admin-candidate-detail-shell">
      <CandidateDetailChrome>{children}</CandidateDetailChrome>
    </div>
  );
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
  /** Settings icons occupy the first collapsed rail (replacing main icons). */
  const [settingsRailActive, setSettingsRailActive] = useState(false);
  const pathname = usePathname() ?? "";
  const inSettingsArea = isSettingsMiniSidebarPath(pathname);
  const wasInSettingsAreaRef = useRef<boolean | null>(null);
  const settingsCollapseReadyRef = useRef(false);
  const closeMobileNav = useCallback(() => setMobileSidebarOpen(false), []);
  const enterSettingsRail = useCallback(() => setSettingsRailActive(true), []);
  const exitSettingsRail = useCallback(() => setSettingsRailActive(false), []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (stored === "true") setSidebarCollapsed(true);
      else if (stored === "false") setSidebarCollapsed(false);
    } catch {
      /* ignore */
    } finally {
      settingsCollapseReadyRef.current = true;
    }
  }, []);

  /**
   * Enter Settings → collapse main rail + put Settings icons in the first rail.
   * Leave Settings → restore main sidebar icons in the first rail.
   */
  useEffect(() => {
    if (!settingsCollapseReadyRef.current) return;
    const wasInSettings = wasInSettingsAreaRef.current;
    wasInSettingsAreaRef.current = inSettingsArea;
    if (wasInSettings === null) {
      if (inSettingsArea) {
        setSidebarCollapsed(true);
        persistSidebarCollapsed(true);
        setSettingsRailActive(true);
      }
      return;
    }
    if (inSettingsArea && !wasInSettings) {
      setSidebarCollapsed(true);
      persistSidebarCollapsed(true);
      setSettingsRailActive(true);
      return;
    }
    if (!inSettingsArea && wasInSettings) {
      setSettingsRailActive(false);
    }
  }, [inSettingsArea]);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      persistSidebarCollapsed(next);
      return next;
    });
  };

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
  const showSettingsSecondColumn = inSettingsArea && !settingsRailActive;

  return (
    <AdminTenantBrandingProvider>
      <StaffAccessSeed initialAccess={initialAccess ?? null}>
        <AdminStaffAuthGuard>
          <AccountDataProvider>
            <AccessDeniedNotice />
            <AnalyticsSessionTracker />
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
                onToggleCollapsed={toggleSidebarCollapsed}
                settingsRailActive={settingsRailActive && inSettingsArea}
                onEnterSettingsRail={enterSettingsRail}
                onExitSettingsRail={exitSettingsRail}
              />
              <div
                className={`admin-recruiter-content admin-recruiter-main-wrap ${
                  inSettingsArea ? "h-dvh max-h-dvh overflow-hidden" : "min-h-screen"
                }`}
                data-mobile-nav-open={mobileSidebarOpen ? "true" : "false"}
                data-settings-area={inSettingsArea ? "true" : "false"}
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
                  {inSettingsArea ? (
                    <div className="flex min-h-0 min-w-0 w-full flex-1 overflow-x-hidden overflow-y-hidden">
                      {/* Second column only on wide screens after exiting the first-rail Settings icons */}
                      {showSettingsSecondColumn ? (
                        <div className="hidden h-full min-[800px]:block">
                          <SettingsSidebar />
                        </div>
                      ) : null}
                      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pb-8 pt-5 sm:px-6 lg:px-8">
                        <CandidateDetailFrame>{children}</CandidateDetailFrame>
                      </div>
                    </div>
                  ) : (
                    <CandidateDetailFrame>{children}</CandidateDetailFrame>
                  )}
                </WorkflowDashboardHeaderProvider>
              </div>
            </div>
          </AccountDataProvider>
        </AdminStaffAuthGuard>
      </StaffAccessSeed>
    </AdminTenantBrandingProvider>
  );
}
