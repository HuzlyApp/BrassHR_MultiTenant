"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

type DetailPayload = {
  employee: {
    employeeId: string;
    name: string;
    email: string;
    departmentName: string | null;
    roleLabel: string;
    engagedHours: number | null;
    jobsWorked: number | null;
    activityCount: number | null;
    statusUpdates: number | null;
    stageAdvances: number | null;
    stageAdvancesByStage: Array<{ stageName: string; count: number }>;
    candidateMatches: number | null;
    targetAttainment: number | null;
  } | null;
  timeline: Array<{
    id: string;
    occurredAt: string;
    eventType: string;
    module: string;
    entityType: string | null;
    entityId: string | null;
    jobId: string | null;
    actorUserId: string | null;
    attributionType: string;
    source: string;
    description: string;
  }>;
  jobsWorked: Array<{ jobId: string; activityCount: number }>;
  sessions: Array<{
    sessionId: string;
    loginAt: string;
    logoutAt: string | null;
    sessionHours: number;
    engagedHours: number;
    idleHours: number;
    activities: number;
  }>;
  period: { label: string; start: string; end: string };
  disclosure: string;
  kpiExplanations: Array<{ key: string; explanation: string; value: string }>;
};

export default function EmployeeDetailClient({ employeeId }: { employeeId: string }) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = searchParams.toString();
    fetch(`/api/admin/reports/team-productivity/employees/${employeeId}?${qs}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load employee");
        if (!cancelled) setData(json as DetailPayload);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load employee");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, searchParams]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-[30px] text-[#6B7280] sm:px-6 lg:px-8">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading employee performance…
      </div>
    );
  }

  if (error || !data?.employee) {
    return (
      <div className="px-4 py-[30px] sm:px-6 lg:px-8">
        <Link
          href={`/admin_recruiter/reports/team-productivity?${searchParams.toString()}`}
          className="mb-3 inline-flex text-[12px] font-medium text-[#012352] hover:underline"
        >
          ← Back to Team Productivity
        </Link>
        <p className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
          {error || "Employee not found"}
        </p>
      </div>
    );
  }

  const emp = data.employee;

  return (
    <div className="flex flex-col gap-5 px-4 py-[30px] sm:px-6 lg:px-8">
      <div>
        <Link
          href={`/admin_recruiter/reports/team-productivity?${searchParams.toString()}`}
          className="mb-2 inline-flex font-[Inter,sans-serif] text-[12px] font-medium text-[#012352] hover:underline"
        >
          ← Back to Team Productivity
        </Link>
        <h1 className="font-[Inter,sans-serif] text-[30px] font-semibold leading-[36px] text-black">
          {emp.name}
        </h1>
        <p className="font-[Inter,sans-serif] text-[14px] text-[#374151]">
          {emp.roleLabel}
          {emp.departmentName ? ` · ${emp.departmentName}` : ""} · {data.period.label}
        </p>
        <p className="mt-2 max-w-3xl font-[Inter,sans-serif] text-[11px] text-[#6B7280]">
          {data.disclosure}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["Engaged hours", emp.engagedHours],
            ["Jobs worked", emp.jobsWorked],
            ["Status updates", emp.statusUpdates],
            ["Stage advances", emp.stageAdvances],
            ["Candidate matches", emp.candidateMatches],
            ["Activities", emp.activityCount],
            ["Target attainment", emp.targetAttainment],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-md border border-[#E5E7EB] bg-white p-[14px]"
          >
            <p className="text-[12px] font-semibold text-[#6B7280]">{label}</p>
            <p className="mt-2 text-[22px] font-semibold text-[#111827]">
              {value != null ? value : "N/A"}
            </p>
          </div>
        ))}
      </div>

      {emp.stageAdvancesByStage?.length ? (
        <section className="rounded-md border border-[#E5E7EB] bg-white">
          <div className="border-b border-[#E5E7EB] px-[14px] py-[10px]">
            <h2 className="text-[16px] font-semibold text-[#012352]">Moved forward by stage</h2>
          </div>
          <div className="overflow-x-auto p-[14px]">
            <table className="w-full min-w-[360px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-[#6B7280]">
                  <th className="pb-2 pr-3">Destination stage</th>
                  <th className="pb-2">Advances</th>
                </tr>
              </thead>
              <tbody>
                {emp.stageAdvancesByStage.map((row) => (
                  <tr key={row.stageName} className="border-b border-[#F3F4F6] text-[#374151]">
                    <td className="py-2 pr-3 font-medium text-[#111827]">{row.stageName}</td>
                    <td className="py-2">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-md border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] px-[14px] py-[10px]">
          <h2 className="text-[16px] font-semibold text-[#012352]">KPI explanation</h2>
        </div>
        <ul className="space-y-3 p-[14px]">
          {data.kpiExplanations.map((item) => (
            <li key={item.key} className="text-[12px] text-[#374151]">
              <span className="font-semibold text-[#111827]">{item.key}</span>: {item.value} —{" "}
              {item.explanation}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] px-[14px] py-[10px]">
          <h2 className="text-[16px] font-semibold text-[#012352]">Jobs worked on</h2>
        </div>
        <div className="p-[14px]">
          {data.jobsWorked.length === 0 ? (
            <p className="text-[12px] text-[#6B7280]">No attributed job activity in this period.</p>
          ) : (
            <ul className="space-y-2 text-[12px] text-[#374151]">
              {data.jobsWorked.map((job) => (
                <li key={job.jobId} className="flex justify-between border-b border-[#F3F4F6] py-2">
                  <span className="font-mono text-[11px]">{job.jobId}</span>
                  <span>{job.activityCount} activities</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-md border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] px-[14px] py-[10px]">
          <h2 className="text-[16px] font-semibold text-[#012352]">Session history</h2>
        </div>
        <div className="overflow-x-auto p-[14px]">
          {data.sessions.length === 0 ? (
            <p className="text-[12px] text-[#6B7280]">No sessions recorded in this period.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-[#6B7280]">
                  <th className="pb-2 pr-3">Login</th>
                  <th className="pb-2 pr-3">Logout</th>
                  <th className="pb-2 pr-3">Session</th>
                  <th className="pb-2 pr-3">Engaged</th>
                  <th className="pb-2">Idle</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((s) => (
                  <tr key={s.sessionId} className="border-b border-[#F3F4F6] text-[#374151]">
                    <td className="py-2 pr-3">{new Date(s.loginAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">
                      {s.logoutAt ? new Date(s.logoutAt).toLocaleString() : "—"}
                    </td>
                    <td className="py-2 pr-3">{s.sessionHours}h</td>
                    <td className="py-2 pr-3">{s.engagedHours}h</td>
                    <td className="py-2">{s.idleHours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rounded-md border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] px-[14px] py-[10px]">
          <h2 className="text-[16px] font-semibold text-[#012352]">Activity timeline</h2>
        </div>
        <div className="p-[14px]">
          {data.timeline.length === 0 ? (
            <p className="text-[12px] text-[#6B7280]">No activity events in this period.</p>
          ) : (
            <ul className="space-y-3">
              {data.timeline.map((item) => (
                <li key={item.id} className="border-b border-[#F3F4F6] pb-3 text-[12px] text-[#374151]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#111827]">{item.description}</span>
                    <span className="text-[#6B7280]">{new Date(item.occurredAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#6B7280]">
                    {item.module} · {item.eventType} · attribution: {item.attributionType} · source:{" "}
                    {item.source}
                    {item.jobId ? ` · job ${item.jobId}` : ""}
                    {item.entityType && item.entityId
                      ? ` · ${item.entityType} ${item.entityId}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
