"use client";

import { useEffect, useState } from "react";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import { useApplicantPortal } from "@/app/application/components/applicant-portal/ApplicantPortalProvider";
import { WorkerDashboardOverview } from "@/app/application/components/applicant-portal/WorkerDashboardOverview";
import type {
  ApplicantNote,
  Appointment,
  AppointmentSlot,
  AttendanceLog,
} from "@/app/application/components/applicant-portal/types";

export function WorkerDashboardClient() {
  const { session, sessionReady, authHeaders } = useApplicantPortal();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceLog[]>([]);
  const [notes, setNotes] = useState<ApplicantNote[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionReady || !session) return;

    let alive = true;
    setDataLoading(true);

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
        if (alive) setDataLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authHeaders, session, sessionReady]);

  if (!sessionReady || dataLoading) {
    return <DashboardPageLoader label="Loading dashboard..." className="min-h-[360px]" />;
  }

  if (!session) return null;

  return (
    <>
      {pageError ? (
        <div className="mx-4 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 min-[1000px]:mx-8">
          {pageError}
        </div>
      ) : null}

      <WorkerDashboardOverview
        userName={session.applicant.name}
        appointment={appointment}
        selectedSlot={selectedSlot}
        recentAttendance={recentAttendance}
        notes={notes}
        notesLoading={false}
      />
    </>
  );
}
