"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CandidatesSubTabs } from "../components/CandidatesSubTabs";
import {
  CANDIDATES_PAGE_SUBTITLE_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "../candidates/candidates-typography";

type AttendanceStatus = "clocked_in" | "clocked_out";

type AttendanceRow = {
  id: string;
  applicant_name: string;
  applicant_email: string | null;
  attendance_date: string;
  status: AttendanceStatus;
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
};

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
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

function statusLabel(status: AttendanceStatus) {
  return status === "clocked_in" ? "Clocked in" : "Clocked out";
}

function locationText(
  address: string | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined
) {
  if (address?.trim()) return address;
  if (lat == null || lng == null) return "—";
  return `${lat}, ${lng}`;
}

export default function AdminApplicantAttendancePage() {
  const [logs, setLogs] = useState<AttendanceRow[]>([]);
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (date) params.set("date", date);
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/applicant-attendance?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        logs?: AttendanceRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Failed to load attendance logs.");
      setLogs(payload.logs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [date, q, status]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadLogs();
  }

  return (
    <main className="px-5 pb-8 pt-5 lg:px-8">
      <CandidatesSubTabs />
      <div className="mb-6">
        <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
          Candidates
        </h1>
        <p className={CANDIDATES_PAGE_SUBTITLE_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
          Manage applicants in one place
        </p>
        <h2 className="mt-4 text-xl font-semibold text-[#0F172A]">Attendance / Time Tracking</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">
          Review applicant clock-in and clock-out logs, including total hours, IP address, and
          browser location coordinates captured for verification.
        </p>
      </div>

      <form
        onSubmit={handleFilter}
        className="mb-5 grid gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm md:grid-cols-[1fr_180px_180px_auto]"
      >
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Filter by applicant name or email"
          className="h-11 rounded-xl border border-[#CBD5E1] px-4 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
        />
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="h-11 rounded-xl border border-[#CBD5E1] px-4 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-11 rounded-xl border border-[#CBD5E1] px-4 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
        >
          <option value="">All statuses</option>
          <option value="clocked_in">Clocked in</option>
          <option value="clocked_out">Clocked out</option>
        </select>
        <button
          type="submit"
          className="h-11 rounded-xl bg-[color:var(--brand-primary)] px-5 text-sm font-semibold text-white transition hover:brightness-95"
        >
          Filter
        </button>
      </form>

      {error ? (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-left text-sm">
            <thead className="bg-[#F8FAFC] text-xs uppercase tracking-[0.08em] text-[#64748B]">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Clock In</th>
                <th className="px-4 py-3">Clock Out</th>
                <th className="px-4 py-3">Total Hours</th>
                <th className="px-4 py-3">Clock-in IP</th>
                <th className="px-4 py-3">Clock-out IP</th>
                <th className="px-4 py-3">Clock-in Location</th>
                <th className="px-4 py-3">Clock-out Location</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-[#334155]">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-[#64748B]" colSpan={11}>
                    Loading attendance logs...
                  </td>
                </tr>
              ) : null}
              {!loading && logs.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-[#64748B]" colSpan={11}>
                    No attendance logs found.
                  </td>
                </tr>
              ) : null}
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 font-medium text-[#0F172A]">{log.applicant_name}</td>
                  <td className="px-4 py-3">{log.applicant_email ?? "—"}</td>
                  <td className="px-4 py-3">{log.attendance_date}</td>
                  <td className="px-4 py-3">{formatDateTime(log.clock_in_at)}</td>
                  <td className="px-4 py-3">{formatDateTime(log.clock_out_at)}</td>
                  <td className="px-4 py-3">{formatDuration(log.total_seconds)}</td>
                  <td className="px-4 py-3">{log.clock_in_ip}</td>
                  <td className="px-4 py-3">{log.clock_out_ip ?? "—"}</td>
                  <td className="px-4 py-3">
                    {locationText(log.clock_in_address, log.clock_in_latitude, log.clock_in_longitude)}
                  </td>
                  <td className="px-4 py-3">
                    {locationText(log.clock_out_address, log.clock_out_latitude, log.clock_out_longitude)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--brand-primary) 12%, white)",
                        color: "var(--brand-primary)",
                      }}
                    >
                      {statusLabel(log.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
