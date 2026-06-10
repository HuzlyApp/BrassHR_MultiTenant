"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { ApplicantPortalHeader } from "./ApplicantPortalHeader";
import {
  ApplicantPortalSidebar,
  WORKER_SIDEBAR_COLLAPSED_WIDTH,
  WORKER_SIDEBAR_COLLAPSED_WIDTH_NARROW,
  WORKER_SIDEBAR_EXPANDED_WIDTH,
} from "./ApplicantPortalSidebar";
import { ApplicantMessagesPanel } from "./ApplicantMessagesPanel";
import type { ApplicantMessage, ApplicantSession } from "./types";
import "./applicant-portal.css";

type Props = {
  session: ApplicantSession | null;
  messages: ApplicantMessage[];
  messageBody: string;
  sending: boolean;
  onMessageBodyChange: (value: string) => void;
  onSendMessage: () => Promise<void>;
  children: React.ReactNode;
};

export function ApplicantPortalShell({
  session,
  messages,
  messageBody,
  sending,
  onMessageBodyChange,
  onSendMessage,
  children,
}: Props) {
  const branding = useTenantBranding();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const shellStyle: CSSProperties = brandingToCssVars(branding);

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
    setSidebarCollapsed((prev) => !prev);
  };

  const sidebarWidth = sidebarCollapsed ? WORKER_SIDEBAR_COLLAPSED_WIDTH : WORKER_SIDEBAR_EXPANDED_WIDTH;

  const shellCssVars = {
    ...shellStyle,
    "--worker-sidebar-width": `${sidebarWidth}px`,
    "--worker-sidebar-collapsed-width": `${WORKER_SIDEBAR_COLLAPSED_WIDTH}px`,
    "--worker-sidebar-collapsed-width-narrow": `${WORKER_SIDEBAR_COLLAPSED_WIDTH_NARROW}px`,
  } as CSSProperties;

  return (
    <div style={shellCssVars} className="applicant-portal-shell min-h-screen bg-[#F8FAFC] text-[#012352]">
      <ApplicantPortalSidebar
        applicantName={session?.applicant.name ?? "Applicant"}
        mobileOpen={mobileNavOpen}
        collapsed={sidebarCollapsed}
        onMobileClose={closeMobileNav}
        onOpenMessages={() => {
          setMessagesOpen(true);
          setMobileNavOpen(false);
        }}
      />

      <div
        className="applicant-portal-main flex min-h-screen flex-col"
        data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
        data-mobile-nav-open={mobileNavOpen ? "true" : "false"}
      >
        <ApplicantPortalHeader
          applicantName={session?.applicant.name ?? "Applicant"}
          mobileNavOpen={mobileNavOpen}
          sidebarCollapsed={sidebarCollapsed}
          onMenuClick={openMobileNav}
          onSidebarToggle={toggleSidebarCollapsed}
          onOpenMessages={() => setMessagesOpen(true)}
        />
        <main className="flex-1">{children}</main>
      </div>

      <ApplicantMessagesPanel
        open={messagesOpen}
        onClose={() => setMessagesOpen(false)}
        messages={messages}
        messageBody={messageBody}
        sending={sending}
        onMessageBodyChange={onMessageBodyChange}
        onSendMessage={onSendMessage}
      />
    </div>
  );
}
