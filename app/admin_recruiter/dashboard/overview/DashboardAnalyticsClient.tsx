"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  DollarSign,
  FileBarChart,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MetricWithTrend = {
  value: number | null;
  changePct: number | null;
  pending?: boolean;
};

type TrendPoint = {
  date: string;
  label: string;
  value: number;
};

type BreakdownSlice = {
  key: string;
  label: string;
  value: number;
  pct: number;
  color: string;
};

type PendingApprovalBar = {
  type: string;
  label: string;
  count: number;
};

type DashboardAnalyticsData = {
  comparisonLabel: string;
  summary: {
    totalWorkforce: MetricWithTrend & { value: number };
    shiftPositions: MetricWithTrend & { value: number };
    newHires: MetricWithTrend & { value: number };
    totalRevenue: MetricWithTrend;
  };
  recruitment: {
    metrics: {
      applications: MetricWithTrend & { value: number };
      interviews: MetricWithTrend & { value: number };
      offerExtended: MetricWithTrend & { value: number };
      hires: MetricWithTrend & { value: number };
    };
    trend: TrendPoint[];
  };
  workforce: {
    metrics: {
      activeWorkers: MetricWithTrend & { value: number };
      attendanceRate: MetricWithTrend & { value: number };
      onTimeStart: MetricWithTrend & { value: number };
      shiftCoverage: MetricWithTrend & { value: number };
    };
    breakdown: BreakdownSlice[];
  };
  financial: {
    pending: boolean;
    metrics: {
      applications: MetricWithTrend & { value: number };
      interviews: MetricWithTrend & { value: number };
      offerExtended: MetricWithTrend & { value: number };
      hires: MetricWithTrend & { value: number };
    };
    revenueTrend: TrendPoint[];
  };
  operational: {
    metrics: {
      unifiedShifts: MetricWithTrend & { value: number };
      pendingApproval: MetricWithTrend & { value: number };
      expiringDocuments: MetricWithTrend & { value: number };
      complianceRate: MetricWithTrend & { value: number };
    };
    pendingApprovalsByType: PendingApprovalBar[];
  };
};

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString();
}

function TrendBadge({ changePct }: { changePct: number | null }) {
  if (changePct === null) return null;
  const positive = changePct >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        positive ? "text-[#10B981]" : "text-[#EF4444]"
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {positive ? "+" : ""}
      {changePct}%
    </span>
  );
}

function SummaryCard({
  label,
  value,
  changePct,
  comparisonLabel,
  icon,
  iconBg,
  pending,
}: {
  label: string;
  value: number | null;
  changePct: number | null;
  comparisonLabel: string;
  icon: React.ReactNode;
  iconBg: string;
  pending?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </div>
        <div className="min-w-0 text-right">
          <p className="text-sm text-[#6B7280]">{label}</p>
          <p className="mt-1 text-[32px] font-semibold leading-none text-[#111827]">
            {pending ? "Soon" : formatNumber(value)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <TrendBadge changePct={changePct} />
        <span className="truncate text-[11px] text-[#9CA3AF]">{comparisonLabel}</span>
      </div>
    </div>
  );
}

function MetricPill({
  label,
  value,
  changePct,
}: {
  label: string;
  value: number;
  changePct: number | null;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
      <p className="text-xs text-[#6B7280]">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-lg font-semibold text-[#111827]">{formatNumber(value)}</span>
        <TrendBadge changePct={changePct} />
      </div>
    </div>
  );
}

function SectionCard({
  id,
  title,
  titleColor,
  viewAllHref,
  children,
}: {
  id?: string;
  title: string;
  titleColor: string;
  viewAllHref: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
        <h2 className="text-base font-semibold" style={{ color: titleColor }}>
          {title}
        </h2>
        <Link href={viewAllHref} className="text-sm font-medium hover:underline" style={{ color: titleColor }}>
          View All
        </Link>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const REPORT_CARDS = [
  {
    title: "Recruitment Reports",
    subtitle: "Hiring & interviews",
    href: "/admin_recruiter/candidates",
    color: "#3B82F6",
    icon: Users,
  },
  {
    title: "Workforce Reports",
    subtitle: "Workers & shifts",
    href: "/admin_recruiter/workers",
    color: "#F59E0B",
    icon: Briefcase,
  },
  {
    title: "Payroll Reports",
    subtitle: "Pay & hours",
    href: "#",
    color: "#10B981",
    icon: FileBarChart,
    disabled: true,
  },
  {
    title: "Financial Reports",
    subtitle: "Revenue & billing",
    href: "#",
    color: "#EAB308",
    icon: DollarSign,
    disabled: true,
  },
] as const;

export type DashboardAnalyticsFocusSection =
  | "recruitment-analytics"
  | "workforce-analytics"
  | "financial-analytics"
  | "operational-insights";

type DashboardAnalyticsClientProps = {
  focusSection?: DashboardAnalyticsFocusSection;
};

export default function DashboardAnalyticsClient({ focusSection }: DashboardAnalyticsClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardAnalyticsData | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dashboard-analytics", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as DashboardAnalyticsData & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load analytics");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    if (!focusSection || !data) return;
    const element = document.getElementById(focusSection);
    if (!element) return;
    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [focusSection, data]);

  if (loading && !data) {
    return (
      <div className="px-5 py-6 lg:px-8">
        <DashboardPageLoader label="Loading overview..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="px-5 py-6 lg:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const maxPendingBar = Math.max(1, ...data.operational.pendingApprovalsByType.map((b) => b.count));

  return (
    <div className="relative px-5 py-6 lg:px-8">
      {loading && data ? <DashboardPageLoader label="Updating overview..." overlay /> : null}
      <div className="mx-auto w-full max-w-[1400px] space-y-6">
        <header className="space-y-1">
          <h1 className="font-[Inter,sans-serif] text-[18px] font-semibold leading-[28px] text-[#012352]">
            Dashboard Overview
          </h1>
          <p className="font-[Inter,sans-serif] text-[12px] font-normal leading-[16px] text-[#6B7280]">
            Summary of key metrics and insights across your organization.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total Workforce"
            value={data.summary.totalWorkforce.value}
            changePct={data.summary.totalWorkforce.changePct}
            comparisonLabel={data.comparisonLabel}
            icon={<Users className="h-5 w-5 text-[#F97316]" />}
            iconBg="#FFF7ED"
          />
          <SummaryCard
            label="Shift Positions"
            value={data.summary.shiftPositions.value}
            changePct={data.summary.shiftPositions.changePct}
            comparisonLabel={data.comparisonLabel}
            icon={<Briefcase className="h-5 w-5 text-[#10B981]" />}
            iconBg="#ECFDF5"
          />
          <SummaryCard
            label="New Hires"
            value={data.summary.newHires.value}
            changePct={data.summary.newHires.changePct}
            comparisonLabel={data.comparisonLabel}
            icon={<UserPlus className="h-5 w-5 text-[#EF4444]" />}
            iconBg="#FEF2F2"
          />
          <SummaryCard
            label="Total Revenue"
            value={data.summary.totalRevenue.value}
            changePct={data.summary.totalRevenue.changePct}
            comparisonLabel={data.comparisonLabel}
            icon={<DollarSign className="h-5 w-5 text-[#EAB308]" />}
            iconBg="#FEFCE8"
            pending={data.summary.totalRevenue.pending}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard
            id="recruitment-analytics"
            title="Recruitment Analytics" titleColor="#3B82F6" viewAllHref="/admin_recruiter/candidates">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
              <div className="space-y-3">
                <MetricPill
                  label="Applications"
                  value={data.recruitment.metrics.applications.value}
                  changePct={data.recruitment.metrics.applications.changePct}
                />
                <MetricPill
                  label="Interviews"
                  value={data.recruitment.metrics.interviews.value}
                  changePct={data.recruitment.metrics.interviews.changePct}
                />
                <MetricPill
                  label="Offer Extended"
                  value={data.recruitment.metrics.offerExtended.value}
                  changePct={data.recruitment.metrics.offerExtended.changePct}
                />
                <MetricPill
                  label="Hires"
                  value={data.recruitment.metrics.hires.value}
                  changePct={data.recruitment.metrics.hires.changePct}
                />
              </div>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.recruitment.trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6B7280" }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} width={36} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="workforce-analytics"
            title="Workforce Analytics" titleColor="#F97316" viewAllHref="/admin_recruiter/workers">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[160px_minmax(0,1fr)_140px]">
              <div className="space-y-3">
                <MetricPill
                  label="Active Workers"
                  value={data.workforce.metrics.activeWorkers.value}
                  changePct={data.workforce.metrics.activeWorkers.changePct}
                />
                <MetricPill
                  label="Attendance Rate"
                  value={data.workforce.metrics.attendanceRate.value}
                  changePct={data.workforce.metrics.attendanceRate.changePct}
                />
                <MetricPill
                  label="On-Time Start"
                  value={data.workforce.metrics.onTimeStart.value}
                  changePct={data.workforce.metrics.onTimeStart.changePct}
                />
                <MetricPill
                  label="Shift Coverage"
                  value={data.workforce.metrics.shiftCoverage.value}
                  changePct={data.workforce.metrics.shiftCoverage.changePct}
                />
              </div>
              <div className="flex h-[220px] items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.workforce.breakdown}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {data.workforce.breakdown.map((slice) => (
                        <Cell key={slice.key} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {data.workforce.breakdown.map((slice) => (
                  <div key={slice.key} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                      <span className="truncate text-[#374151]">{slice.label}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold text-[#111827]">{slice.value}</div>
                      <div className="text-xs text-[#6B7280]">{slice.pct}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard
            id="financial-analytics"
            title="Financial Analytics" titleColor="#10B981" viewAllHref="#">
            {data.financial.pending ? (
              <p className="mb-4 rounded-lg bg-[#F0FDF4] px-3 py-2 text-sm text-[#166534]">
                Revenue tracking is coming soon. Showing hiring activity below.
              </p>
            ) : null}
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricPill label="Applications" value={data.financial.metrics.applications.value} changePct={null} />
              <MetricPill label="Interviews" value={data.financial.metrics.interviews.value} changePct={null} />
              <MetricPill label="Offer Extended" value={data.financial.metrics.offerExtended.value} changePct={null} />
              <MetricPill label="Hires" value={data.financial.metrics.hires.value} changePct={null} />
            </div>
            <p className="mb-2 text-sm font-semibold text-[#111827]">Revenue Trend</p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.financial.revenueTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6B7280" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} width={36} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard
            id="operational-insights"
            title="Operational Insights" titleColor="#3B82F6" viewAllHref="/admin_recruiter/calendar/shifts">
            <div className="mb-4 grid grid-cols-2 gap-3">
              <MetricPill
                label="Unified Shifts"
                value={data.operational.metrics.unifiedShifts.value}
                changePct={data.operational.metrics.unifiedShifts.changePct}
              />
              <MetricPill
                label="Pending Approval"
                value={data.operational.metrics.pendingApproval.value}
                changePct={data.operational.metrics.pendingApproval.changePct}
              />
              <MetricPill
                label="Expiring Documents"
                value={data.operational.metrics.expiringDocuments.value}
                changePct={data.operational.metrics.expiringDocuments.changePct}
              />
              <MetricPill
                label="Compliance Rate"
                value={data.operational.metrics.complianceRate.value}
                changePct={data.operational.metrics.complianceRate.changePct}
              />
            </div>
            <p className="mb-2 text-sm font-semibold text-[#111827]">Pending Approvals by type</p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.operational.pendingApprovalsByType}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" domain={[0, maxPendingBar]} tick={{ fontSize: 10, fill: "#6B7280" }} />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 11, fill: "#374151" }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[#111827]">Reports</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {REPORT_CARDS.map((card) => {
              const Icon = card.icon;
              const inner = (
                <div className="flex min-h-[120px] flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div
                    className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${card.color}18` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: card.color }} />
                  </div>
                  <h3 className="text-base font-semibold text-[#111827]">{card.title}</h3>
                  <p className="mt-1 text-sm text-[#6B7280]">{card.subtitle}</p>
                  {"disabled" in card && card.disabled ? (
                    <span className="mt-3 inline-flex w-fit rounded-md bg-[#F3F4F6] px-2 py-1 text-xs font-medium text-[#6B7280]">
                      Coming soon
                    </span>
                  ) : (
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium" style={{ color: card.color }}>
                      <TrendingUp className="h-4 w-4" />
                      Open
                    </span>
                  )}
                </div>
              );

              if ("disabled" in card && card.disabled) {
                return <div key={card.title}>{inner}</div>;
              }

              return (
                <Link key={card.title} href={card.href}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
