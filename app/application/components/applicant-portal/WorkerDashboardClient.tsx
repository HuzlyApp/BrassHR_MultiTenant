"use client";

import { useEffect, useState } from "react";
import OnboardingLoader from "@/app/components/OnboardingLoader";
import {
  TenantBrandingProvider,
  useTenantBranding,
} from "@/app/components/tenant/TenantBrandingContext";
import { ApplicantPortalShell } from "@/app/application/components/applicant-portal/ApplicantPortalShell";
import { WorkerDashboardOverview } from "@/app/application/components/applicant-portal/WorkerDashboardOverview";
import type {
  ApplicantNote,
  ApplicantSession,
  Appointment,
  AppointmentSlot,
  AttendanceLog,
} from "@/app/application/components/applicant-portal/types";
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

export function WorkerDashboardClient() {
  const bootstrapBranding = useTenantBranding();
  const { session, loading, error } = useApplicantPortalSession();
  const authHeaders = useApplicantPortalAuthHeaders();
  const [portalBranding, setPortalBranding] = useState<TenantBranding | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceLog[]>([]);
  const [notes, setNotes] = useState<ApplicantNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
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

    let alive = true;

    void (async () => {
      setPageError(null);
      try {
        const headers = await authHeaders();
        if (!headers) return;

        const [appointmentsRes, attendanceRes, notesRes] = await Promise.all([
          fetch("/api/applicant-portal/appointments", { headers, cache: "no-store" }),
          fetch("/api/applicant-portal/attendance", { headers, cache: "no-store" }),
          fetch("/api/applicant-portal/notes", { headers, cache: "no-store" }),
        ]);

        const appointmentsPayload = (await appointmentsRes.json().catch(() => ({}))) as {
          appointment?: Appointment | null;
          selectedSlot?: AppointmentSlot | null;
          error?: string;
        };
        const attendancePayload = (await attendanceRes.json().catch(() => ({}))) as {
          recent?: AttendanceLog[];
          error?: string;
        };
        const notesPayload = (await notesRes.json().catch(() => ({}))) as {
          notes?: ApplicantNote[];
          error?: string;
        };

        if (!appointmentsRes.ok) {
          throw new Error(appointmentsPayload.error || "Could not load schedule.");
        }
        if (!attendanceRes.ok) {
          throw new Error(attendancePayload.error || "Could not load attendance.");
        }
        if (!notesRes.ok) {
          throw new Error(notesPayload.error || "Could not load announcements.");
        }

        if (!alive) return;
        setAppointment(appointmentsPayload.appointment ?? null);
        setSelectedSlot(appointmentsPayload.selectedSlot ?? null);
        setRecentAttendance(attendancePayload.recent ?? []);
        setNotes(notesPayload.notes ?? []);
      } catch (err) {
        if (alive) {
          setPageError(err instanceof Error ? err.message : "Could not load dashboard.");
        }
      } finally {
        if (alive) setNotesLoading(false);
      }
    })();

    void loadMessages();

    return () => {
      alive = false;
    };
  }, [authHeaders, loadMessages, loading, session]);

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
        <OnboardingLoader label="Loading dashboard..." />
      </TenantBrandingProvider>
    );
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
        {error || pageError ? (
          <div className="mx-4 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 min-[1000px]:mx-8">
            {error || pageError}
          </div>
        ) : null}

        {session ? (
          <WorkerDashboardOverview
            userName={session.applicant.name}
            appointment={appointment}
            selectedSlot={selectedSlot}
            recentAttendance={recentAttendance}
            notes={notes}
            notesLoading={notesLoading}
          />
        ) : null}
      </ApplicantPortalShell>
    </TenantBrandingProvider>
  );
}
