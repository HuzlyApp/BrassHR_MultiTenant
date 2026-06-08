"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { ApplicantPortalHeader } from "./ApplicantPortalHeader";
import { ApplicantPortalSidebar } from "./ApplicantPortalSidebar";
import { ApplicantMessagesPanel } from "./ApplicantMessagesPanel";
import type { ApplicantMessage, ApplicantSession } from "./types";

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
  const shellStyle: CSSProperties = brandingToCssVars(branding);

  return (
    <div style={shellStyle} className="min-h-screen bg-[#F8FAFC] text-[#012352]">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <ApplicantPortalSidebar
        applicantName={session?.applicant.name ?? "Applicant"}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        onOpenMessages={() => {
          setMessagesOpen(true);
          setMobileNavOpen(false);
        }}
      />

      <div className="flex min-h-screen flex-col lg:pl-[272px]">
        <ApplicantPortalHeader
          applicantName={session?.applicant.name ?? "Applicant"}
          onMenuClick={() => setMobileNavOpen(true)}
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
