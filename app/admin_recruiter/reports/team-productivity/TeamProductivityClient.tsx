"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calendar, ChevronDown, Download, Filter } from "lucide-react";

const KPI_CARDS = [
  { label: "Candidates Processed", value: 248, change: "+12%" },
  { label: "Interviews Scheduled", value: 64, change: "+8%" },
  { label: "Offers Extended", value: 18, change: "-3%" },
  { label: "Hires Completed", value: 12, change: "+15%" },
  { label: "Avg. Time to Hire", value: 24, change: "-5%", suffix: " days" },
] as const;

const HIRES_TREND = [
  { label: "Mon", hires: 2 },
  { label: "Tue", hires: 4 },
  { label: "Wed", hires: 3 },
  { label: "Thu", hires: 5 },
  { label: "Fri", hires: 6 },
  { label: "Sat", hires: 1 },
  { label: "Sun", hires: 2 },
];

const PRODUCTIVITY_BY_MEMBER = [
  { name: "Sarah M.", processed: 42 },
  { name: "James K.", processed: 38 },
  { name: "Emily R.", processed: 35 },
  { name: "David L.", processed: 28 },
  { name: "Anna P.", processed: 24 },
];

const TEAM_PERFORMANCE = [
  { name: "Sarah M.", processed: 42, interviews: 18, hires: 6, conversion: 14 },
  { name: "James K.", processed: 38, interviews: 15, hires: 5, conversion: 13 },
  { name: "Emily R.", processed: 35, interviews: 14, hires: 4, conversion: 11 },
  { name: "David L.", processed: 28, interviews: 11, hires: 3, conversion: 11 },
  { name: "Anna P.", processed: 24, interviews: 9, hires: 2, conversion: 8 },
];

const PRODUCTIVITY_BY_DEPT = [
  { dept: "Nursing", value: 86 },
  { dept: "Admin", value: 62 },
  { dept: "Facilities", value: 48 },
  { dept: "Clinical", value: 74 },
  { dept: "Support", value: 55 },
];

const CHART_AXIS_TICK = { fontSize: 10, fill: "#6B7280" };
const CHART_GRID_STROKE = "#E5E7EB";

function KpiCard({
  label,
  value,
  change,
  suffix = "",
}: {
  label: string;
  value: number;
  change: string;
  suffix?: string;
}) {
  const positive = change.startsWith("+");
  return (
    <div className="flex min-h-[131px] flex-1 flex-col justify-center rounded-md border border-[#E5E7EB] bg-white p-[14px]">
      <p className="font-[Inter,sans-serif] text-[12px] font-semibold leading-[16px] text-[#6B7280]">
        {label}
      </p>
      <div className="mt-2 flex items-end gap-2">
        <p className="font-[Inter,sans-serif] text-[24px] font-semibold leading-[32px] text-[#111827]">
          {value.toLocaleString()}
          {suffix}
        </p>
        <span
          className={`mb-1 font-[Inter,sans-serif] text-[12px] font-semibold ${
            positive ? "text-[#10B981]" : "text-[#EF4444]"
          }`}
        >
          {change}
        </span>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-h-[300px] flex-col overflow-hidden rounded-md border border-[#E5E7EB] bg-white ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] px-[14px] py-[10px]">
        <h2 className="font-[Inter,sans-serif] text-[16px] font-semibold leading-[24px] text-[#012352]">
          {title}
        </h2>
        {action}
      </div>
      <div className="min-h-0 flex-1 p-[14px]">{children}</div>
    </section>
  );
}

export default function TeamProductivityClient() {
  const maxMemberBar = useMemo(
    () => Math.max(...PRODUCTIVITY_BY_MEMBER.map((d) => d.processed), 1),
    [],
  );

  return (
    <div className="flex flex-col gap-5 px-4 py-[30px] sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 py-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/admin_recruiter/reports"
            className="mb-2 inline-flex font-[Inter,sans-serif] text-[12px] font-medium text-[#012352] hover:underline"
          >
            ← Back to Report Center
          </Link>
          <h1 className="font-[Inter,sans-serif] text-[30px] font-semibold leading-[36px] text-black">
            Team Productivity
          </h1>
          <p className="font-[Inter,sans-serif] text-[16px] font-normal leading-[24px] text-[#374151]">
            Compare your team&apos;s performance for candidate processing and hiring activities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:gap-[30px]">
          <div className="flex items-center">
            <button
              type="button"
              className="flex items-center gap-1 rounded-l-lg border border-[#E5E7EB] bg-white px-2 py-1.5 font-[Inter,sans-serif] text-[12px] text-[#374151]"
            >
              Last 7 days
              <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-r-lg border border-l-0 border-[#E5E7EB] bg-white px-2 py-1.5 font-[Inter,sans-serif] text-[12px] text-[#374151]"
            >
              <Calendar className="h-4 w-4" aria-hidden />
              Feb 04 - Feb 04
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 font-[Inter,sans-serif] text-[12px] text-[#374151] hover:bg-[#F9FAFB]"
            >
              <Filter className="h-4 w-4" aria-hidden />
              Filters
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 font-[Inter,sans-serif] text-[12px] text-[#374151] hover:bg-[#F9FAFB]"
            >
              <Download className="h-4 w-4" aria-hidden />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
        {KPI_CARDS.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard
          title="Hires Overtime"
          action={
            <button
              type="button"
              className="inline-flex items-center gap-1 font-[Inter,sans-serif] text-[12px] text-[#374151]"
            >
              Daily
              <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
          }
        >
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={HIRES_TREND} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
                <YAxis tick={CHART_AXIS_TICK} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="hires"
                  stroke="#004CFF"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#004CFF" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Productivity by Team Member"
          action={
            <span className="font-[Inter,sans-serif] text-[12px] text-[#012352]">View All</span>
          }
        >
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={PRODUCTIVITY_BY_MEMBER}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} horizontal={false} />
                <XAxis type="number" domain={[0, maxMemberBar]} tick={CHART_AXIS_TICK} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  tick={{ fontSize: 11, fill: "#374151" }}
                />
                <Tooltip />
                <Bar dataKey="processed" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard title="Team Member Performance" className="min-h-[360px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="border-b border-[#E5E7EB] font-[Inter,sans-serif] text-[12px] font-semibold text-[#6B7280]">
                  <th className="pb-3 pr-4">Recruiter</th>
                  <th className="pb-3 pr-4">Processed</th>
                  <th className="pb-3 pr-4">Interviews</th>
                  <th className="pb-3 pr-4">Hires</th>
                  <th className="pb-3">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {TEAM_PERFORMANCE.map((row) => (
                  <tr
                    key={row.name}
                    className="border-b border-[#F3F4F6] font-[Inter,sans-serif] text-[12px] text-[#374151]"
                  >
                    <td className="py-3 pr-4 font-medium text-[#111827]">{row.name}</td>
                    <td className="py-3 pr-4">{row.processed}</td>
                    <td className="py-3 pr-4">{row.interviews}</td>
                    <td className="py-3 pr-4">{row.hires}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#E5E7EB]">
                          <div
                            className="h-full rounded-full bg-[#10B981]"
                            style={{ width: `${Math.min(row.conversion * 5, 100)}%` }}
                          />
                        </div>
                        <span>{row.conversion}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Productivity by Department">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PRODUCTIVITY_BY_DEPT} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                <XAxis dataKey="dept" tick={CHART_AXIS_TICK} />
                <YAxis tick={CHART_AXIS_TICK} />
                <Tooltip />
                <Bar dataKey="value" fill="#BC8B41" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
