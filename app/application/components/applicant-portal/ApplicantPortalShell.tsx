"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { ApplicantPortalHeader } from "./ApplicantPortalHeader";
import {
  ApplicantPortalSidebar,
  WORKER_SIDEBAR_COLLAPSED_WIDTH,
  WORKER_SIDEBAR_EXPANDED_WIDTH,
} from "./ApplicantPortalSidebar";
import { ApplicantMessagesPanel } from "./ApplicantMessagesPanel";
import type { ApplicantMessage, ApplicantSession } from "./types";
import "./applicant-portal.css";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "applicantPortalSidebarCollapsed";

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

  const sidebarWidth = sidebarCollapsed ? WORKER_SIDEBAR_COLLAPSED_WIDTH : WORKER_SIDEBAR_EXPANDED_WIDTH;

  return (
    <div style={shellStyle} className="min-h-screen bg-[#F8FAFC] text-[#012352]">
      <ApplicantPortalSidebar
        applicantName={session?.applicant.name ?? "Applicant"}
        mobileOpen={mobileNavOpen}
        collapsed={sidebarCollapsed}
        onMobileClose={() => setMobileNavOpen(false)}
        onOpenMessages={() => {
          setMessagesOpen(true);
          setMobileNavOpen(false);
        }}
      />

      <div
        className="applicant-portal-main flex min-h-screen flex-col"
        style={{ "--worker-sidebar-width": `${sidebarWidth}px` } as CSSProperties}
      >
        <ApplicantPortalHeader
          applicantName={session?.applicant.name ?? "Applicant"}
          sidebarCollapsed={sidebarCollapsed}
          onMenuClick={() => setMobileNavOpen(true)}
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
