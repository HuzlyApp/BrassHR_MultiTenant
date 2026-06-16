"use client";

import { useEffect, useState, type ReactNode } from "react";
import OnboardingLoader from "@/app/components/OnboardingLoader";
import {
  TenantBrandingProvider,
  useTenantBranding,
} from "@/app/components/tenant/TenantBrandingContext";
import { ApplicantPortalShell } from "@/app/application/components/applicant-portal/ApplicantPortalShell";
import {
  useApplicantPortalAuthHeaders,
  useApplicantPortalSession,
} from "@/app/application/components/applicant-portal/useApplicantPortalSession";
import { useApplicantPortalMessaging } from "@/app/application/components/applicant-portal/useApplicantPortalMessaging";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { persistOnboardingSlugCookie } from "@/lib/tenant/client-onboarding-slug";

async function loadTenantBranding(tenantId: string): Promise<TenantBranding | null> {
  const res = await fetch(`/api/tenant-branding?tenantId=${encodeURIComponent(tenantId)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const payload = (await res.json().catch(() => ({}))) as { branding?: TenantBranding };
  return payload.branding ?? null;
}

export function ApplicantPortalRoutePage({ children }: { children: ReactNode }) {
  const bootstrapBranding = useTenantBranding();
  const { session, loading, error } = useApplicantPortalSession();
  const authHeaders = useApplicantPortalAuthHeaders();
  const [portalBranding, setPortalBranding] = useState<TenantBranding | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const {
    messages,
    messageBody,
    setMessageBody,
    sending,
    aiTyping,
    recruiterDirectHint,
    lastInquiry,
    loadMessages,
    handleSendMessage,
    handleContactRecruiter,
    handleCreateSupportTicket,
  } = useApplicantPortalMessaging({
    workerId: session?.applicant.id,
    authHeaders,
  });

  useEffect(() => {
    if (!session?.applicant.tenantId) return;
    void loadTenantBranding(session.applicant.tenantId).then((branding) => {
      if (!branding) return;
      setPortalBranding(branding);
      if (branding.slug) persistOnboardingSlugCookie(branding.slug);
    });
  }, [session?.applicant.tenantId]);

  useEffect(() => {
    if (loading || !session) return;
    void loadMessages();
  }, [loadMessages, loading, session]);

  async function onSendMessage(file?: File | null) {
    setPageError(null);
    try {
      await handleSendMessage(file);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Could not send message.");
    }
  }

  const branding = portalBranding ?? bootstrapBranding;

  if (loading) {
    return (
      <TenantBrandingProvider branding={branding}>
        <OnboardingLoader label="Loading..." />
      </TenantBrandingProvider>
    );
  }

  if (!session) {
    if (error) {
      return (
        <TenantBrandingProvider branding={branding}>
          <div className="flex min-h-screen items-center justify-center p-6">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </TenantBrandingProvider>
      );
    }
    return null;
  }

  return (
    <TenantBrandingProvider branding={branding}>
      <ApplicantPortalShell
        session={session}
        messages={messages}
        messageBody={messageBody}
        sending={sending}
        aiTyping={aiTyping}
        recruiterDirectHint={recruiterDirectHint}
        lastInquiry={lastInquiry}
        onMessageBodyChange={setMessageBody}
        onSendMessage={onSendMessage}
        onContactRecruiter={handleContactRecruiter}
        onCreateSupportTicket={handleCreateSupportTicket}
      >
        {pageError || error ? (
          <div className="mx-8 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-700">
            {pageError || error}
          </div>
        ) : null}
        {children}
      </ApplicantPortalShell>
    </TenantBrandingProvider>
  );
}
