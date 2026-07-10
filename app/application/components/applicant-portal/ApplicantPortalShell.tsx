"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { ApplicantPortalHeader } from "./ApplicantPortalHeader";
import {
  ApplicantPortalSidebar,
  WORKER_SIDEBAR_COLLAPSED_WIDTH,
  WORKER_SIDEBAR_COLLAPSED_WIDTH_MOBILE,
  WORKER_SIDEBAR_COLLAPSED_WIDTH_NARROW,
  WORKER_SIDEBAR_EXPANDED_WIDTH,
} from "./ApplicantPortalSidebar";

const WORKER_SIDEBAR_COLLAPSED_STORAGE_KEY = "workerPortalSidebarCollapsed";
import { ApplicantPortalUiProvider } from "./ApplicantPortalUiContext";
import type { ApplicantSession } from "./types";
import "./applicant-portal.css";

const GROUP_CHAT_HREF = "/application/applicant-dashboard/group-chat?tab=recruiter";

type Props = {
  session: ApplicantSession | null;
  children: React.ReactNode;
};

export function ApplicantPortalShell({ session, children }: Props) {
  const branding = useTenantBranding();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const shellStyle: CSSProperties = brandingToCssVars(branding);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(WORKER_SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (stored === "true") setSidebarCollapsed(true);
      else if (stored === "false") setSidebarCollapsed(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileNavOpen]);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(WORKER_SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const openMessages = useCallback(() => {
    router.push(GROUP_CHAT_HREF);
  }, [router]);

  const sidebarWidth = sidebarCollapsed ? WORKER_SIDEBAR_COLLAPSED_WIDTH : WORKER_SIDEBAR_EXPANDED_WIDTH;

  const shellCssVars = {
    ...shellStyle,
    "--worker-sidebar-width": `${sidebarWidth}px`,
    "--worker-sidebar-collapsed-width": `${WORKER_SIDEBAR_COLLAPSED_WIDTH}px`,
    "--worker-sidebar-collapsed-width-narrow": `${WORKER_SIDEBAR_COLLAPSED_WIDTH_NARROW}px`,
    "--worker-sidebar-collapsed-width-mobile": `${WORKER_SIDEBAR_COLLAPSED_WIDTH_MOBILE}px`,
  } as CSSProperties;

  return (
    <ApplicantPortalUiProvider openRecruiterMessages={openMessages}>
      <div style={shellCssVars} className="applicant-portal-shell min-h-screen bg-[#F4F4F4] text-[#012352]">
        <ApplicantPortalSidebar
          applicantName={session?.applicant.name ?? "Applicant"}
          mobileOpen={mobileNavOpen}
          collapsed={sidebarCollapsed}
          onMobileClose={closeMobileNav}
          onOpenMessages={() => {
            openMessages();
            setMobileNavOpen(false);
          }}
        />

        <div
          className="applicant-portal-main applicant-portal-main-wrap flex min-h-screen flex-col bg-[#F4F4F4]"
          data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
          data-mobile-nav-open={mobileNavOpen ? "true" : "false"}
        >
          <ApplicantPortalHeader
            applicantName={session?.applicant.name ?? "Applicant"}
            mobileNavOpen={mobileNavOpen}
            sidebarCollapsed={sidebarCollapsed}
            onMenuClick={openMobileNav}
            onSidebarToggle={toggleSidebarCollapsed}
            onOpenMessages={openMessages}
          />
          <main className="flex flex-1 flex-col bg-[#F4F4F4]">{children}</main>
        </div>
      </div>
    </ApplicantPortalUiProvider>
  );
}
