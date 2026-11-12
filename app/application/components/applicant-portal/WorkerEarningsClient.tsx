"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  CreditCard,
  Download,
  Wallet,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AnalyticsChartFrame from "@/app/components/charts/AnalyticsChartFrame";
import { WORKER_CHART_BLUE } from "./worker-dashboard-utils";
import {
  DEMO_EARNINGS_HISTORY,
  DEMO_EARNINGS_METRICS,
  DEMO_EARNINGS_MONTHLY,
  formatPayCurrency,
  formatPayHours,
} from "./worker-pay-demo";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SCHEDULE_SUBTITLE_CLASS,
  WORKER_SCHEDULE_SUBTITLE_STYLE,
  WORKER_SCHEDULE_TITLE_CLASS,
  WORKER_SCHEDULE_TITLE_STYLE,
} from "./worker-schedule-typography";

const PAYSLIPS_HREF = "/application/applicant-dashboard/pay/payslips";
const NAVY = "var(--brand-secondary, #012352)";

type RangeId = "3m" | "6m" | "1y";

const RANGE_OPTIONS: { id: RangeId; label: string; months: number }[] = [
  { id: "3m", label: "3 Months", months: 3 },
  { id: "6m", label: "6 Months", months: 6 },
  { id: "1y", label: "1 Year", months: 12 },
];

const METRIC_CARDS = [
  {
    id: "net",
    label: "Net Pay",
    value: formatPayCurrency(DEMO_EARNINGS_METRICS.netPay),
    subtitle: DEMO_EARNINGS_METRICS.netPaySubtitle,
    iconBg: "#CCFBF1",
    iconColor: "#0D9488",
    Icon: Wallet,
  },
  {
    id: "gross",
    label: "Gross Pay",
    value: formatPayCurrency(DEMO_EARNINGS_METRICS.grossPay),
    subtitle: DEMO_EARNINGS_METRICS.grossPaySubtitle,
    iconBg: "#DCFCE7",
    iconColor: "#16A34A",
    Icon: CreditCard,
  },
  {
    id: "hours",
    label: "Total Hours",
    value: `${DEMO_EARNINGS_METRICS.totalHours}h`,
    subtitle: DEMO_EARNINGS_METRICS.totalHoursSubtitle,
    iconBg: "#DBEAFE",
    iconColor: "#2563EB",
    Icon: Clock3,
  },
  {
    id: "next",
    label: "Next Pay Date",
    value: DEMO_EARNINGS_METRICS.nextPayDate,
    subtitle: DEMO_EARNINGS_METRICS.nextPaySubtitle,
    iconBg: "#D1FAE5",
    iconColor: "#059669",
    Icon: CalendarDays,
  },
] as const;

function formatAxisCurrency(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value}`;
}

export function WorkerEarningsClient() {
  const [range, setRange] = useState<RangeId>("1y");

  const chartData = useMemo(() => {
    const months = RANGE_OPTIONS.find((r) => r.id === range)?.months ?? 12;
    return DEMO_EARNINGS_MONTHLY.slice(-months);
  }, [range]);

  return (
    <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} pb-8`}>
      <div className="mb-5">
        <h1 className={WORKER_SCHEDULE_TITLE_CLASS} style={WORKER_SCHEDULE_TITLE_STYLE}>
          Earnings
        </h1>
        <p className={WORKER_SCHEDULE_SUBTITLE_CLASS} style={WORKER_SCHEDULE_SUBTITLE_STYLE}>
          View earnings, download payslips, and track your pay history.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {METRIC_CARDS.map(({ id, label, value, subtitle, iconBg, iconColor, Icon }) => (
          <div key={id} className={`${WORKER_SCHEDULE_CARD_CLASS} p-4 shadow-sm sm:p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#6B7280]">{label}</p>
                <p className="mt-1 truncate text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">
                  {value}
                </p>
                <p className="mt-1 text-xs font-medium text-[#6B7280]">{subtitle}</p>
              </div>
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: iconBg, color: iconColor }}
                aria-hidden
              >
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <section className={`${WORKER_SCHEDULE_CARD_CLASS} mb-5 p-4 shadow-sm sm:p-5`}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-[#111827]">Earnings Overview</h2>
          <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-1">
            {RANGE_OPTIONS.map((option) => {
              const active = range === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setRange(option.id)}
                  className={`h-8 rounded-md px-3 text-xs font-semibold transition sm:text-sm ${
                    active
                      ? "bg-[#012352] text-white shadow-sm"
                      : "text-[#6B7280] hover:bg-white hover:text-[#111827]"
                  }`}
                  style={active ? { backgroundColor: NAVY } : undefined}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <AnalyticsChartFrame className="h-[260px] w-full sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "#6B7280", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatAxisCurrency}
                tick={{ fill: "#6B7280", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                formatter={(value) => formatPayCurrency(Number(value ?? 0))}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="amount"
                fill={WORKER_CHART_BLUE}
                radius={[6, 6, 0, 0]}
                barSize={28}
                name="Earnings"
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#1D4ED8"
                strokeWidth={2}
                dot={{ r: 3, fill: "#1D4ED8", strokeWidth: 0 }}
                name="Trend"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </AnalyticsChartFrame>
      </section>

      <section className={`${WORKER_SCHEDULE_CARD_CLASS} shadow-sm`}>
        <div className="flex flex-col gap-3 border-b border-[#E5E7EB] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <h2 className="text-base font-semibold text-[#111827]">Earnings History</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 items-center rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151]">
              May - July 2026
            </span>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#374151] transition hover:bg-[#F9FAFB]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                <th className="min-w-[220px] px-4 py-3 sm:px-5">Pay Period</th>
                <th className="whitespace-nowrap px-4 py-3">Hours</th>
                <th className="whitespace-nowrap px-4 py-3">Gross</th>
                <th className="whitespace-nowrap px-4 py-3">Net</th>
                <th className="whitespace-nowrap px-4 py-3">Status</th>
                <th className="whitespace-nowrap px-4 py-3 text-right sm:px-5">Payslip</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_EARNINGS_HISTORY.map((row) => (
                <tr key={row.id} className="border-b border-[#E5E7EB] last:border-b-0">
                  <td className="px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[#111827]">{row.periodLabel}</span>
                      {row.isCurrent ? (
                        <span className="inline-flex rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[11px] font-semibold text-[#047857]">
                          Current
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-[#374151]">
                    {formatPayHours(row.hours)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-[#111827]">
                    {formatPayCurrency(row.gross)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-[#111827]">
                    {formatPayCurrency(row.net)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    {row.status === "upcoming" ? (
                      <span className="inline-flex rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-[11px] font-semibold text-[#B45309]">
                        Upcoming
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
                        Paid
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right sm:px-5">
                    <Link
                      href={PAYSLIPS_HREF}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#111827]"
                      aria-label={`Open payslip for ${row.periodLabel}`}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
