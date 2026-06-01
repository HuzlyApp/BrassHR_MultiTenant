"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminTenantBrandingProvider } from "@/app/components/tenant/AdminTenantBrandingProvider";
import {
  AdminRecruiterSidebar,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
} from "./components/AdminRecruiterSidebar";
import { AdminRecruiterHeader } from "./components/AdminRecruiterHeader";
import GodAdminImpersonationBanner from "./components/GodAdminImpersonationBanner";
import "./layout.css";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "adminRecruiterSidebarCollapsed";

/**
 * Default body copy color for recruiter admin; pages still set explicit colors
 * (e.g. sidebar `text-white`, links `text-teal-*`) where needed.
 */
export default function AdminRecruiterLayout({ children }: { children: ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (stored === "true") setSidebarCollapsed(true);
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
      <div
        className="admin-recruiter-shell min-h-screen text-gray-600"
        style={{
          backgroundColor: "color-mix(in srgb, var(--brand-accent) 12%, #f3f5f5)",
          ["--admin-sidebar-width" as string]: `${sidebarWidth}px`,
        }}
      >
        <AdminRecruiterSidebar
          collapsed={sidebarCollapsed}
          isMobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
        <div className="admin-recruiter-content admin-recruiter-main-wrap min-h-screen">
          <GodAdminImpersonationBanner />
          <AdminRecruiterHeader
            onMenuClick={() => setMobileSidebarOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
            onSidebarToggle={toggleSidebarCollapsed}
          />
          {children}
        </div>
      </div>
    </AdminTenantBrandingProvider>
  );
}
