"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
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
import type { ApplicantMessage, ApplicantSession } from "@/app/application/components/applicant-portal/types";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { persistOnboardingSlugCookie } from "@/lib/tenant/client-onboarding-slug";

export type SupportTicketCreatePayload = {
  subject: string;
  description: string;
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
};

export type ApplicantPortalMessaging = {
  messages: ApplicantMessage[];
  messageBody: string;
  setMessageBody: (value: string) => void;
  sending: boolean;
  aiTyping: boolean;
  recruiterDirectHint: boolean;
  lastInquiry: string;
  onSendMessage: (file?: File | null) => Promise<void>;
  onContactRecruiter: () => void;
  onSupportTicketCreated: (payload: { ticketId?: string; chatMessage?: ApplicantMessage }) => void;
};

type ApplicantPortalContextValue = {
  session: ApplicantSession | null;
  sessionReady: boolean;
  sessionError: string | null;
  authHeaders: () => Promise<{ Authorization: string } | null>;
  messaging: ApplicantPortalMessaging;
  profilePhotoUrl: string | null;
  setProfilePhotoUrl: (url: string | null) => void;
};

const ApplicantPortalContext = createContext<ApplicantPortalContextValue | null>(null);

async function loadTenantBranding(tenantId: string): Promise<TenantBranding | null> {
  const res = await fetch(`/api/tenant-branding?tenantId=${encodeURIComponent(tenantId)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const payload = (await res.json().catch(() => ({}))) as { branding?: TenantBranding };
  return payload.branding ?? null;
}

export function useApplicantPortal() {
  const context = useContext(ApplicantPortalContext);
  if (!context) {
    throw new Error("useApplicantPortal must be used within ApplicantPortalProvider.");
  }
  return context;
}

function ApplicantPortalLayoutInner({ children }: { children: ReactNode }) {
  const bootstrapBranding = useTenantBranding();
  const { session, loading, error } = useApplicantPortalSession();
  const authHeaders = useApplicantPortalAuthHeaders();
  const [portalBranding, setPortalBranding] = useState<TenantBranding | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

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
    handleSupportTicketCreated,
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
  const sessionReady = !loading && Boolean(session);
  const showSessionLoader = loading && !session;

  useEffect(() => {
    if (!sessionReady) return;

    let alive = true;
    void (async () => {
      try {
        const headers = await authHeaders();
        if (!headers) return;
        const res = await fetch("/api/applicant-portal/profile-photo", { headers, cache: "no-store" });
        const payload = (await res.json().catch(() => ({}))) as { profilePhotoUrl?: string | null };
        if (!res.ok || !alive) return;
        setProfilePhotoUrl(payload.profilePhotoUrl ?? null);
      } catch {
        if (alive) setProfilePhotoUrl(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authHeaders, sessionReady]);

  const messaging: ApplicantPortalMessaging = {
    messages,
    messageBody,
    setMessageBody,
    sending,
    aiTyping,
    recruiterDirectHint,
    lastInquiry,
    onSendMessage: onSendMessage,
    onContactRecruiter: handleContactRecruiter,
    onSupportTicketCreated: handleSupportTicketCreated,
  };

  if (!loading && !session && error) {
    return (
      <TenantBrandingProvider branding={branding}>
        <div className="flex min-h-screen items-center justify-center bg-[#F4F4F4] p-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </TenantBrandingProvider>
    );
  }

  return (
    <ApplicantPortalContext.Provider
      value={{
        session,
        sessionReady,
        sessionError: error,
        authHeaders,
        messaging,
        profilePhotoUrl,
        setProfilePhotoUrl,
      }}
    >
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
          authHeaders={authHeaders}
          onSupportTicketCreated={handleSupportTicketCreated}
        >
          {pageError || error ? (
            <div className="mx-4 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 min-[1000px]:mx-8">
              {pageError || error}
            </div>
          ) : null}

          {showSessionLoader ? null : children}
        </ApplicantPortalShell>
      </TenantBrandingProvider>
    </ApplicantPortalContext.Provider>
  );
}

export function ApplicantPortalProvider({ children }: { children: ReactNode }) {
  return <ApplicantPortalLayoutInner>{children}</ApplicantPortalLayoutInner>;
}
