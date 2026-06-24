"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkerPortalPageLoader } from "@/app/application/components/applicant-portal/WorkerPortalPageLoader";
import { useApplicantPortal } from "@/app/application/components/applicant-portal/ApplicantPortalProvider";
import { ApplicantPortalTabs } from "@/app/application/components/applicant-portal/ApplicantPortalTabs";
import { ApplicantScheduleTab } from "@/app/application/components/applicant-portal/ApplicantScheduleTab";
import { ApplicantNotesTab } from "@/app/application/components/applicant-portal/ApplicantNotesTab";
import type {
  ApplicantNote,
  ApplicantPortalTab,
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
  active?: AttendanceLog | null;
  recent?: AttendanceLog[];
  error?: string;
};

type BrowserLocation = {
  latitude: number;
  longitude: number;
  timestamp: string;
  permissionStatus: "granted";
};

function parseTab(value: string | null): ApplicantPortalTab {
  if (value === "notes") return value;
  return "schedule";
}

export default function ApplicantSchedulePage() {
  return (
    <Suspense fallback={<WorkerPortalPageLoader label="Loading schedule..." />}>
      <ApplicantSchedulePageContent />
    </Suspense>
  );
}

function ApplicantSchedulePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { session, sessionReady, authHeaders } = useApplicantPortal();
  const [activeTab, setActiveTab] = useState<ApplicantPortalTab>(() =>
    parseTab(searchParams.get("tab"))
  );
  const [availableSlots, setAvailableSlots] = useState<AppointmentSlot[]>([]);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceLog | null>(null);
  const [activeAttendance, setActiveAttendance] = useState<AttendanceLog | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceLog[]>([]);
  const [notes, setNotes] = useState<ApplicantNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [showRescheduleReason, setShowRescheduleReason] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [requestingSchedule, setRequestingSchedule] = useState(false);
  const [requestingReschedule, setRequestingReschedule] = useState(false);
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("tab") === "timesheets") {
      router.replace("/application/applicant-dashboard/schedule/timesheets");
    }
  }, [router, searchParams]);

  useEffect(() => {
    setActiveTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

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

  async function loadNotes(headers: { Authorization: string }) {
    setNotesLoading(true);
    try {
      const res = await fetch("/api/applicant-portal/notes", {
        headers,
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        notes?: ApplicantNote[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not load notes.");
      setNotes(payload.notes ?? []);
    } finally {
      setNotesLoading(false);
    }
  }

  async function loadAttendance(headers: { Authorization: string }) {
    const res = await fetch("/api/applicant-portal/attendance", {
      headers,
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as AttendancePayload;
    if (!res.ok) throw new Error(payload.error || "Could not load attendance.");
    setTodayAttendance(payload.today ?? null);
    setActiveAttendance(payload.active ?? null);
    setRecentAttendance(payload.recent ?? []);
  }

  useEffect(() => {
    if (!sessionReady || !session) return;

    let alive = true;
    setDataLoading(true);

    void (async () => {
      try {
        const headers = await authHeaders();
        if (!headers) return;

        await Promise.all([
          loadAppointments(headers),
          loadAttendance(headers),
          loadNotes(headers),
        ]);
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : "Could not load schedule.");
        }
      } finally {
        if (alive) setDataLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authHeaders, session, sessionReady]);

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
      if (!res.ok) {
        if (res.status === 409 && action === "clock_in") {
          await loadAttendance(headers);
        }
        throw new Error(payload.error || "Could not update attendance.");
      }

      setTodayAttendance(payload.today ?? null);
      setActiveAttendance(payload.active ?? null);
      setRecentAttendance(payload.recent ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update attendance.");
    } finally {
      setAttendanceSubmitting(false);
    }
  }

  if (!sessionReady || dataLoading) {
    return <WorkerPortalPageLoader label="Loading schedule..." />;
  }

  if (!session) return null;

  return (
    <>
      {error ? (
        <div className="mx-4 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 min-[1000px]:mx-8">
          {error}
        </div>
      ) : null}

      <ApplicantPortalTabs activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === "schedule" ? (
        <ApplicantScheduleTab
          todayAttendance={todayAttendance}
          activeAttendance={activeAttendance}
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
        <ApplicantNotesTab notes={notes} loading={notesLoading} />
      )}
    </>
  );
}
