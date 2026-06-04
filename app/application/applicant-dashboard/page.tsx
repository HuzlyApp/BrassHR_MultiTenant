"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ApplicantPortalShell } from "@/app/application/components/applicant-portal/ApplicantPortalShell";
import { ApplicantPortalTabs } from "@/app/application/components/applicant-portal/ApplicantPortalTabs";
import { ApplicantScheduleTab } from "@/app/application/components/applicant-portal/ApplicantScheduleTab";
import { ApplicantTimesheetsTab } from "@/app/application/components/applicant-portal/ApplicantTimesheetsTab";
import type {
  ApplicantMessage,
  ApplicantPortalTab,
  ApplicantSession,
  Appointment,
  AppointmentSlot,
  AttendanceLog,
} from "@/app/application/components/applicant-portal/types";

type AppointmentPayload = {
  availableSlots?: AppointmentSlot[];
  appointment?: Appointment | null;
  selectedSlot?: AppointmentSlot | null;
  error?: string;
};

type AttendancePayload = {
  today?: AttendanceLog | null;
  recent?: AttendanceLog[];
  error?: string;
};

type BrowserLocation = {
  latitude: number;
  longitude: number;
  timestamp: string;
  permissionStatus: "granted";
};

export default function ApplicantDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ApplicantPortalTab>("schedule");
  const [session, setSession] = useState<ApplicantSession | null>(null);
  const [messages, setMessages] = useState<ApplicantMessage[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AppointmentSlot[]>([]);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceLog | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceLog[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [showRescheduleReason, setShowRescheduleReason] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [requestingSchedule, setRequestingSchedule] = useState(false);
  const [requestingReschedule, setRequestingReschedule] = useState(false);
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function authHeaders() {
    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : null;
  }

  async function loadMessages(headers: { Authorization: string }) {
    const res = await fetch("/api/applicant-portal/messages", {
      headers,
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as {
      messages?: ApplicantMessage[];
      error?: string;
    };
    if (!res.ok) throw new Error(payload.error || "Could not load messages.");
    setMessages(payload.messages ?? []);
  }

  async function loadAppointments(headers: { Authorization: string }) {
    const res = await fetch("/api/applicant-portal/appointments", {
      headers,
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as AppointmentPayload;
    if (!res.ok) throw new Error(payload.error || "Could not load appointment schedule.");
    setAvailableSlots(payload.availableSlots ?? []);
    setAppointment(payload.appointment ?? null);
    setSelectedSlot(payload.selectedSlot ?? null);
  }

  async function loadAttendance(headers: { Authorization: string }) {
    const res = await fetch("/api/applicant-portal/attendance", {
      headers,
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as AttendancePayload;
    if (!res.ok) throw new Error(payload.error || "Could not load attendance.");
    setTodayAttendance(payload.today ?? null);
    setRecentAttendance(payload.recent ?? []);
  }

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const headers = await authHeaders();
        if (!headers) {
          router.replace("/");
          return;
        }

        const res = await fetch("/api/applicant-portal/session", {
          headers,
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => ({}))) as ApplicantSession & { error?: string };
        if (!res.ok) throw new Error(payload.error || "Could not load applicant dashboard.");
        if (!alive) return;

        setSession(payload);
        await Promise.all([loadMessages(headers), loadAppointments(headers), loadAttendance(headers)]);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load applicant dashboard.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function handleSendMessage() {
    const body = messageBody.trim();
    if (!body) return;

    setSending(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");

      const res = await fetch("/api/applicant-portal/messages", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not send message.");

      setMessageBody("");
      await loadMessages(headers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  async function handleRequestSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlotId) return;

    setRequestingSchedule(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");

      const res = await fetch("/api/applicant-portal/appointments", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: selectedSlotId }),
      });
      const payload = (await res.json().catch(() => ({}))) as AppointmentPayload;
      if (!res.ok) throw new Error(payload.error || "Could not request schedule.");

      setAvailableSlots(payload.availableSlots ?? []);
      setAppointment(payload.appointment ?? null);
      setSelectedSlot(payload.selectedSlot ?? null);
      setSelectedSlotId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request schedule.");
    } finally {
      setRequestingSchedule(false);
    }
  }

  async function handleRequestReschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appointment?.id || !rescheduleReason.trim()) return;

    setRequestingReschedule(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");

      const res = await fetch("/api/applicant-portal/appointments", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: appointment.id, reason: rescheduleReason }),
      });
      const payload = (await res.json().catch(() => ({}))) as AppointmentPayload;
      if (!res.ok) throw new Error(payload.error || "Could not request reschedule.");

      setAvailableSlots(payload.availableSlots ?? []);
      setAppointment(payload.appointment ?? null);
      setSelectedSlot(payload.selectedSlot ?? null);
      setRescheduleReason("");
      setShowRescheduleReason(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request reschedule.");
    } finally {
      setRequestingReschedule(false);
    }
  }

  async function getVerifiedLocation(): Promise<BrowserLocation> {
    if (!("geolocation" in navigator)) {
      throw new Error(
        "We could not verify your location or network information. Please try again or contact the tenant/recruiter."
      );
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: new Date(position.timestamp).toISOString(),
            permissionStatus: "granted",
          });
        },
        (geoError) => {
          if (geoError.code === geoError.PERMISSION_DENIED) {
            reject(
              new Error(
                "Location access is required to verify your attendance. Please enable location permissions and try again."
              )
            );
            return;
          }
          reject(
            new Error(
              "We could not verify your location or network information. Please try again or contact the tenant/recruiter."
            )
          );
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  async function handleAttendanceAction(action: "clock_in" | "clock_out") {
    setAttendanceSubmitting(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const location = await getVerifiedLocation();

      const res = await fetch("/api/applicant-portal/attendance", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action, location }),
      });
      const payload = (await res.json().catch(() => ({}))) as AttendancePayload;
      if (!res.ok) throw new Error(payload.error || "Could not update attendance.");

      setTodayAttendance(payload.today ?? null);
      setRecentAttendance(payload.recent ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update attendance.");
    } finally {
      setAttendanceSubmitting(false);
    }
  }

  return (
    <ApplicantPortalShell
      session={session}
      messages={messages}
      messageBody={messageBody}
      sending={sending}
      onMessageBodyChange={setMessageBody}
      onSendMessage={handleSendMessage}
    >
      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center px-8 text-[15px] text-[#64748B]">
          Loading dashboard...
        </div>
      ) : null}

      {error ? (
        <div className="mx-8 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {!loading && session ? (
        <>
          <ApplicantPortalTabs activeTab={activeTab} onChange={setActiveTab} />
          {activeTab === "schedule" ? (
            <ApplicantScheduleTab
                todayAttendance={todayAttendance}
                recentAttendance={recentAttendance}
                appointment={appointment}
                selectedSlot={selectedSlot}
                availableSlots={availableSlots}
                selectedSlotId={selectedSlotId}
                rescheduleReason={rescheduleReason}
                showRescheduleReason={showRescheduleReason}
                requestingSchedule={requestingSchedule}
                requestingReschedule={requestingReschedule}
                attendanceSubmitting={attendanceSubmitting}
                onSelectedSlotIdChange={setSelectedSlotId}
                onRescheduleReasonChange={setRescheduleReason}
                onShowRescheduleReasonChange={setShowRescheduleReason}
                onRequestSchedule={handleRequestSchedule}
                onRequestReschedule={handleRequestReschedule}
                onAttendanceAction={handleAttendanceAction}
            />
          ) : (
            <ApplicantTimesheetsTab todayAttendance={todayAttendance} recentAttendance={recentAttendance} />
          )}
        </>
      ) : null}
    </ApplicantPortalShell>
  );
}
