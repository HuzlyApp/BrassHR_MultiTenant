"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingLayout from "@/app/components/OnboardingLayout";
import { supabaseBrowser } from "@/lib/supabase-browser";

type ApplicantSession = {
  applicant: {
    id: string;
    tenantId: string;
    email: string | null;
    name: string;
  };
  statusLabel: string;
  message: string;
};

type ApplicantMessage = {
  id: string;
  sender_role: "applicant" | "recruiter";
  body: string;
  created_at: string;
};

type MeetingType = "online" | "phone" | "in_person";
type AppointmentStatus = "requested" | "confirmed" | "rescheduled" | "cancelled";

type AppointmentSlot = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  meeting_type: MeetingType;
  meeting_link: string | null;
  location: string | null;
  notes: string | null;
};

type Appointment = {
  id: string;
  slot_id: string | null;
  status: AppointmentStatus;
  meeting_type: MeetingType | null;
  confirmed_starts_at: string | null;
  confirmed_ends_at: string | null;
  meeting_link: string | null;
  location: string | null;
  reschedule_reason: string | null;
  requested_at: string;
  updated_at: string;
};

type AppointmentPayload = {
  availableSlots?: AppointmentSlot[];
  appointment?: Appointment | null;
  selectedSlot?: AppointmentSlot | null;
  error?: string;
};

type AttendanceStatus = "clocked_in" | "clocked_out";
type AttendanceLog = {
  id: string;
  status: AttendanceStatus;
  attendance_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  total_seconds: number | null;
  clock_in_ip: string;
  clock_out_ip: string | null;
  clock_in_address: string | null;
  clock_out_address: string | null;
  clock_in_latitude: number;
  clock_in_longitude: number;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_in_location_timestamp: string;
  clock_out_location_timestamp: string | null;
  clock_in_location_permission_status: string;
  clock_out_location_permission_status: string | null;
};

type AttendancePayload = {
  today?: AttendanceLog | null;
  recent?: AttendanceLog[];
  currentStatus?: string;
  error?: string;
};

type BrowserLocation = {
  latitude: number;
  longitude: number;
  timestamp: string;
  permissionStatus: "granted";
};

function meetingTypeLabel(type: MeetingType | null | undefined) {
  if (type === "online") return "Online meeting";
  if (type === "phone") return "Phone call";
  if (type === "in_person") return "In-person appointment";
  return "Meeting";
}

function scheduleStatusLabel(status: AppointmentStatus | null | undefined) {
  if (status === "requested") return "Schedule requested";
  if (status === "confirmed") return "Confirmed";
  if (status === "rescheduled") return "Rescheduled";
  if (status === "cancelled") return "Cancelled";
  return "No schedule yet";
}

function formatScheduleDate(iso: string | null | undefined) {
  if (!iso) return "To be confirmed";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "To be confirmed";
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return "In progress";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function shortDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function attendanceStatusLabel(log: AttendanceLog | null) {
  if (!log) return "Not clocked in";
  return log.status === "clocked_in" ? "Clocked in" : "Clocked out";
}

function locationDisplay(address: string | null | undefined, lat: number | null | undefined, lng: number | null | undefined) {
  if (address?.trim()) return address;
  if (lat != null && lng != null) return `${lat}, ${lng}`;
  return "—";
}

export default function ApplicantDashboardPage() {
  const router = useRouter();
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

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  const scheduleDate = appointment?.confirmed_starts_at ?? selectedSlot?.starts_at ?? null;
  const scheduleMeetingType = appointment?.meeting_type ?? selectedSlot?.meeting_type ?? null;
  const scheduleMeetingLink = appointment?.meeting_link ?? selectedSlot?.meeting_link ?? null;
  const scheduleLocation = appointment?.location ?? selectedSlot?.location ?? null;
  const isClockedIn = todayAttendance?.status === "clocked_in";

  return (
    <OnboardingLayout
      cardClassName="md:grid-cols-[730px_330px]"
      rightPanelImageSrc="/images/verification-status.jpg"
      rightPanelImageClassName="object-cover object-center grayscale opacity-60"
    >
      <div className="flex min-h-[650px] flex-col px-8 py-10 sm:px-10">
        <div className="mb-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Applicant Dashboard
          </p>
          <h1 className="mt-2 text-[30px] font-semibold leading-10 text-slate-900">
            {session?.applicant.name ?? "Applicant Dashboard"}
          </h1>
          <p className="mt-2 max-w-[560px] text-[15px] leading-6 text-slate-500">
            Check your application status and message the tenant / recruiter about missing documents,
            approval timelines, or other application-related questions.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-[15px] text-slate-600">
            Loading applicant dashboard...
          </div>
        ) : null}

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-[14px] font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {session ? (
          <div className="grid flex-1 gap-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[14px] font-semibold text-slate-500">Application Status</p>
                  <h2 className="mt-1 text-[24px] font-semibold text-slate-900">
                    {session.statusLabel}
                  </h2>
                </div>
                <span className="rounded-full bg-[#2ec9b5] px-4 py-2 text-[14px] font-semibold text-white">
                  {session.statusLabel}
                </span>
              </div>
              <p className="mt-4 rounded-xl border border-[#99f6e4] bg-[#ecfeff] px-4 py-3 text-[15px] font-medium text-[#0f766e]">
                {session.message}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-semibold text-slate-900">
                    Attendance / Time Tracking
                  </h2>
                  <p className="mt-1 max-w-[560px] text-[14px] leading-5 text-slate-500">
                    Clock in and clock out to record your attendance. Your IP address and location may
                    be captured for verification.
                  </p>
                </div>
                <span className="rounded-full bg-[#ecfeff] px-4 py-2 text-[13px] font-semibold text-[#0f766e]">
                  Current Status: {attendanceStatusLabel(todayAttendance)}
                </span>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-700">
                {!todayAttendance ? (
                  <p className="font-medium text-slate-700">No attendance record for today yet.</p>
                ) : (
                  <div className="grid gap-2 text-[13px] leading-5 text-slate-600 sm:grid-cols-2">
                    <p>
                      <span className="font-semibold text-slate-800">Clock-in time:</span>{" "}
                      {shortDateTime(todayAttendance.clock_in_at)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">Clock-out time:</span>{" "}
                      {shortDateTime(todayAttendance.clock_out_at)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">Total hours:</span>{" "}
                      {formatDuration(todayAttendance.total_seconds)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">Status:</span>{" "}
                      {attendanceStatusLabel(todayAttendance)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">Clock-in IP address:</span>{" "}
                      {todayAttendance.clock_in_ip}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">Clock-out IP address:</span>{" "}
                      {todayAttendance.clock_out_ip ?? "—"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">Clock-in location:</span>{" "}
                      {locationDisplay(
                        todayAttendance.clock_in_address,
                        todayAttendance.clock_in_latitude,
                        todayAttendance.clock_in_longitude
                      )}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">Clock-out location:</span>{" "}
                      {locationDisplay(
                        todayAttendance.clock_out_address,
                        todayAttendance.clock_out_latitude,
                        todayAttendance.clock_out_longitude
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12px] leading-5 text-slate-500">
                  Browser location permission is required before clocking in or out.
                </p>
                <button
                  type="button"
                  onClick={() => handleAttendanceAction(isClockedIn ? "clock_out" : "clock_in")}
                  disabled={attendanceSubmitting}
                  className="inline-flex h-11 min-w-[130px] items-center justify-center rounded-xl bg-[#0ea5a4] px-4 text-[15px] font-semibold text-white transition hover:bg-[#0c8d8b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {attendanceSubmitting ? "Verifying..." : isClockedIn ? "Clock Out" : "Clock In"}
                </button>
              </div>

              {recentAttendance.length > 0 ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-[1.1fr_1fr_1fr] bg-slate-50 px-4 py-2 text-[12px] font-semibold text-slate-500">
                    <span>Date</span>
                    <span>Status</span>
                    <span>Total</span>
                  </div>
                  {recentAttendance.slice(0, 3).map((log) => (
                    <div
                      key={log.id}
                      className="grid grid-cols-[1.1fr_1fr_1fr] border-t border-slate-200 px-4 py-2 text-[13px] text-slate-700"
                    >
                      <span>{log.attendance_date}</span>
                      <span>{attendanceStatusLabel(log)}</span>
                      <span>{formatDuration(log.total_seconds)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-semibold text-slate-900">
                    Schedule Appointment / Interview
                  </h2>
                  <p className="mt-1 max-w-[560px] text-[14px] leading-5 text-slate-500">
                    Choose an available time to discuss your application, next steps, or required
                    documents with the tenant / recruiter.
                  </p>
                </div>
                <span className="rounded-full border border-[#F2C46D] bg-[#FFF7E6] px-4 py-2 text-[13px] font-semibold text-[#A16207]">
                  {scheduleStatusLabel(appointment?.status)}
                </span>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-700">
                {!appointment ? (
                  <p className="font-medium text-slate-700">No appointment has been scheduled yet.</p>
                ) : appointment.status === "confirmed" ? (
                  <p className="font-semibold text-[#0f766e]">Your appointment has been confirmed.</p>
                ) : (
                  <p className="font-medium text-slate-700">
                    Current schedule status: {scheduleStatusLabel(appointment.status)}.
                  </p>
                )}

                {appointment ? (
                  <div className="mt-3 grid gap-2 text-[13px] leading-5 text-slate-600 sm:grid-cols-2">
                    <p>
                      <span className="font-semibold text-slate-800">Date / Time:</span>{" "}
                      {formatScheduleDate(scheduleDate)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">Meeting Type:</span>{" "}
                      {meetingTypeLabel(scheduleMeetingType)}
                    </p>
                    {scheduleMeetingLink ? (
                      <p className="sm:col-span-2">
                        <span className="font-semibold text-slate-800">Meeting Link:</span>{" "}
                        <a
                          href={scheduleMeetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-[#0ea5a4] underline-offset-4 hover:underline"
                        >
                          {scheduleMeetingLink}
                        </a>
                      </p>
                    ) : null}
                    {scheduleLocation ? (
                      <p className="sm:col-span-2">
                        <span className="font-semibold text-slate-800">Location:</span>{" "}
                        {scheduleLocation}
                      </p>
                    ) : null}
                    {appointment.reschedule_reason ? (
                      <p className="sm:col-span-2">
                        <span className="font-semibold text-slate-800">Reschedule reason:</span>{" "}
                        {appointment.reschedule_reason}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <form onSubmit={handleRequestSchedule} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <select
                  value={selectedSlotId}
                  onChange={(event) => setSelectedSlotId(event.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-[#0ea5a4]"
                >
                  <option value="">
                    {availableSlots.length > 0 ? "Choose an available time slot" : "No available time slots"}
                  </option>
                  {availableSlots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {formatScheduleDate(slot.starts_at)} - {meetingTypeLabel(slot.meeting_type)}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!selectedSlotId || requestingSchedule}
                  className="inline-flex h-11 min-w-[150px] items-center justify-center rounded-xl bg-[#0ea5a4] px-4 text-[15px] font-semibold text-white transition hover:bg-[#0c8d8b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {requestingSchedule ? "Requesting..." : "Request Schedule"}
                </button>
              </form>

              {appointment && appointment.status !== "cancelled" ? (
                <div className="mt-4">
                  {!showRescheduleReason ? (
                    <button
                      type="button"
                      onClick={() => setShowRescheduleReason(true)}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-[#F2C46D] bg-white px-4 text-[14px] font-semibold text-[#A16207] transition hover:bg-[#FFF7E6]"
                    >
                      Request Reschedule
                    </button>
                  ) : (
                    <form onSubmit={handleRequestReschedule} className="space-y-3">
                      <textarea
                        value={rescheduleReason}
                        onChange={(event) => setRescheduleReason(event.target.value)}
                        placeholder="Add a short reason for requesting a new schedule."
                        rows={3}
                        className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0ea5a4]"
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowRescheduleReason(false);
                            setRescheduleReason("");
                          }}
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-[14px] font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!rescheduleReason.trim() || requestingReschedule}
                          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0ea5a4] px-4 text-[14px] font-semibold text-white transition hover:bg-[#0c8d8b] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {requestingReschedule ? "Sending..." : "Request Reschedule"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : null}
            </section>

            <section className="flex min-h-[330px] flex-col rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-[20px] font-semibold text-slate-900">
                  Message Tenant / Recruiter
                </h2>
                <p className="mt-1 text-[14px] leading-5 text-slate-500">
                  Ask questions about your application status, missing documents, or approval timeline.
                </p>
              </div>

              <div className="flex max-h-[260px] flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
                {messages.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-[14px] text-slate-500">
                    No messages yet. Send your first question to the tenant / recruiter.
                  </p>
                ) : null}
                {messages.map((message) => {
                  const isApplicant = message.sender_role === "applicant";
                  return (
                    <div
                      key={message.id}
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-5 ${
                        isApplicant
                          ? "ml-auto bg-[#0ea5a4] text-white"
                          : "mr-auto bg-slate-100 text-slate-700"
                      }`}
                    >
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] opacity-75">
                        {isApplicant ? "You" : "Recruiter"}
                      </p>
                      <p>{message.body}</p>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleSendMessage} className="border-t border-slate-200 p-4">
                <textarea
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  placeholder="Ask about your application status or send a message to the admin recruiter."
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0ea5a4]"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={sending || !messageBody.trim()}
                    className="inline-flex h-11 min-w-[130px] items-center justify-center rounded-xl bg-[#0ea5a4] px-4 text-[15px] font-semibold text-white transition hover:bg-[#0c8d8b] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? "Sending..." : "Send Message"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}
      </div>
    </OnboardingLayout>
  );
}
