"use client";

import { useEffect, useState } from "react";
import { WorkerPortalPageLoader } from "@/app/application/components/applicant-portal/WorkerPortalPageLoader";
import { useApplicantPortal } from "@/app/application/components/applicant-portal/ApplicantPortalProvider";
import { ApplicantTimesheetsTab } from "@/app/application/components/applicant-portal/ApplicantTimesheetsTab";
import type { AttendanceLog } from "@/app/application/components/applicant-portal/types";

type AttendancePayload = {
  today?: AttendanceLog | null;
  recent?: AttendanceLog[];
  error?: string;
};

export default function ApplicantTimesheetsPage() {
  const { session, sessionReady, authHeaders } = useApplicantPortal();
  const [todayAttendance, setTodayAttendance] = useState<AttendanceLog | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionReady || !session) return;

    let alive = true;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = await authHeaders();
        if (!headers) throw new Error("You need to sign in again.");

        const res = await fetch("/api/applicant-portal/attendance", {
          headers,
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => ({}))) as AttendancePayload;
        if (!res.ok) throw new Error(payload.error || "Could not load attendance.");

        if (!alive) return;
        setTodayAttendance(payload.today ?? null);
        setRecentAttendance(payload.recent ?? []);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load attendance.");
        setTodayAttendance(null);
        setRecentAttendance([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authHeaders, session, sessionReady]);

  if (!sessionReady || loading) {
    return <WorkerPortalPageLoader label="Loading timesheets..." />;
  }

  if (!session) return null;

  return (
    <>
      {error ? (
        <div className="mx-4 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 min-[1000px]:mx-8">
          {error}
        </div>
      ) : null}
      <ApplicantTimesheetsTab todayAttendance={todayAttendance} recentAttendance={recentAttendance} />
    </>
  );
}
