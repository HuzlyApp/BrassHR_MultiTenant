"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
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

function useCompactCharts() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return compact;
}

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
  iconSrc,
  iconBg,
  cardBg,
  pending,
}: {
  label: string;
  value: number | null;
  changePct: number | null;
  comparisonLabel: string;
  iconSrc: string;
  iconBg: string;
  cardBg: string;
  pending?: boolean;
}) {
  return (
    <div
      className="flex min-h-[88px] w-full min-w-0 items-center gap-3 rounded-md border border-[#E5E7EB] p-3 sm:min-h-[100px] sm:gap-[14px] sm:p-[14px]"
      style={{ backgroundColor: cardBg }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-1 sm:h-[50px] sm:w-[50px]"
        style={{ backgroundColor: iconBg }}
      >
        <img
          src={iconSrc}
          alt=""
          width={30}
          height={30}
          className="h-6 w-6 shrink-0 sm:h-[30px] sm:w-[30px]"
          aria-hidden
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <p className="truncate align-middle font-[Inter,sans-serif] text-[11px] font-semibold leading-4 text-[#6B7280] sm:text-[12px] sm:leading-[16px]">
          {label}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <p className="text-xl font-semibold leading-tight text-[#111827] sm:text-2xl">
            {pending ? "Soon" : formatNumber(value)}
          </p>
          <TrendBadge changePct={changePct} />
        </div>
        <span className="truncate text-[10px] text-[#9CA3AF]">{comparisonLabel}</span>
      </div>
    </div>
  );
}

function formatYAxisTick(value: number): string {
  if (value >= 1000) return `${value / 1000}k`;
  return String(value);
}

const CHART_AXIS_TICK = { fontSize: 10, fill: "#6B7280" };
const CHART_GRID_STROKE = "#E5E7EB";
const FINANCIAL_INSIGHTS_COLOR = "#00B546";
const CHART_GREEN_COLOR = "#008C36";

function getBreakdownColor(slice: BreakdownSlice): string {
  if (slice.key === "active") return CHART_GREEN_COLOR;
  return slice.color;
}

function AnalyticsMetric({
  label,
  value,
  changePct,
}: {
  label: string;
  value: number;
  changePct: number | null;
}) {
  return (
    <div className="space-y-1">
      <p className="font-[Inter,sans-serif] text-[12px] font-semibold leading-[16px] text-[#6B7280]">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-[Inter,sans-serif] text-[18px] font-semibold leading-[24px] text-[#111827]">
          {formatNumber(value)}
        </span>
        <TrendBadge changePct={changePct} />
      </div>
    </div>
  );
}

function BreakdownLegendItem({ slice }: { slice: BreakdownSlice }) {
  const color = getBreakdownColor(slice);
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate font-[Inter,sans-serif] text-[12px] leading-[16px] text-[#374151]">{slice.label}</span>
      </div>
      <span className="shrink-0 font-[Inter,sans-serif] text-[12px] font-semibold leading-[16px] text-[#111827]">
        {slice.value}{" "}
        <span className="font-normal text-[#6B7280]">({slice.pct}%)</span>
      </span>
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
    <section id={id} className="scroll-mt-24 w-full min-w-0 rounded-md border border-[#E5E7EB] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] px-3 py-3 sm:gap-3 sm:px-[14px] sm:py-[14px]">
        <h2
          className="min-w-0 font-[Inter,sans-serif] text-[15px] font-semibold leading-[22px] sm:text-[16px] sm:leading-[24px]"
          style={{ color: titleColor }}
        >
          {title}
        </h2>
        <Link
          href={viewAllHref}
          className="shrink-0 font-[Inter,sans-serif] text-[13px] font-medium leading-5 hover:underline sm:text-[14px] sm:leading-[20px]"
          style={{ color: titleColor }}
        >
          View All
        </Link>
      </div>
      <div className="p-3 sm:p-[14px]">{children}</div>
    </section>
  );
}

const REPORT_CARDS = [
  {
    title: "Recruitment Reports",
    subtitle: "View recruitment & hiring reports",
    href: "/admin_recruiter/candidates",
    icon: Users,
    iconColor: "#3B82F6",
    iconBg: "#EFF6FF",
  },
  {
    title: "Workforce Reports",
    subtitle: "View recruitment & hiring reports",
    href: "/admin_recruiter/workers",
    icon: Users,
    iconColor: "#F97316",
    iconBg: "#FFF7ED",
  },
  {
    title: "Payroll Reports",
    subtitle: "View recruitment & hiring reports",
    href: "#",
    iconSrc: "/icons/dashboard-icons/Shift-Positions.svg",
    iconBg: "#D6FFE6",
    disabled: true,
  },
  {
    title: "Financial Reports",
    subtitle: "View recruitment & hiring reports",
    href: "#",
    iconSrc: "/icons/dashboard-icons/total-revenue.svg",
    iconBg: "#FFF1BF",
    disabled: true,
  },
] as const;

function ReportCard({
  title,
  subtitle,
  icon: Icon,
  iconSrc,
  iconColor,
  iconBg,
  href,
  disabled,
}: {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  iconSrc?: string;
  iconColor?: string;
  iconBg: string;
  href: string;
  disabled?: boolean;
}) {
  const content = (
    <div className="flex h-full min-h-[132px] w-full min-w-0 flex-col rounded-md border border-[#E5E7EB] bg-white p-[14px] transition hover:border-[#D1D5DB]">
      <div
        className="mb-2 flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-md p-1"
        style={{ backgroundColor: iconBg }}
      >
        {iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            width={30}
            height={30}
            className="h-[30px] w-[30px] shrink-0"
            aria-hidden
          />
        ) : Icon ? (
          <Icon className="h-[30px] w-[30px]" style={{ color: iconColor }} strokeWidth={1.75} />
        ) : null}
      </div>
      <h3 className="font-[Inter,sans-serif] text-[14px] font-semibold leading-[20px] text-[#111827]">{title}</h3>
      <p className="mt-1 font-[Inter,sans-serif] text-[12px] font-normal leading-[16px] text-[#6B7280]">{subtitle}</p>
    </div>
  );

  if (disabled) {
    return <div className="min-w-0 cursor-default opacity-90">{content}</div>;
  }

  return (
    <Link href={href} className="block min-w-0">
      {content}
    </Link>
  );
}

export type DashboardAnalyticsFocusSection =
  | "recruitment-analytics"
  | "workforce-analytics"
  | "financial-analytics"
  | "operational-insights";

type DashboardAnalyticsClientProps = {
  focusSection?: DashboardAnalyticsFocusSection;
};

export default function DashboardAnalyticsClient({ focusSection }: DashboardAnalyticsClientProps) {
  const compactCharts = useCompactCharts();
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

  if (error && !data) {
    return (
      <div className="admin-recruiter-page-pad">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const maxPendingBar = Math.max(1, ...data.operational.pendingApprovalsByType.map((b) => b.count));
  const barAxisWidth = compactCharts ? 72 : 108;
  const lineChartMargin = compactCharts
    ? { top: 8, right: 4, left: -20, bottom: 0 }
    : { top: 8, right: 12, left: -12, bottom: 0 };

  return (
    <div className="admin-recruiter-page-pad w-full min-w-0 space-y-3 overflow-x-hidden sm:space-y-[14px]">
        <header className="space-y-1">
          <h1 className="align-middle font-[Inter,sans-serif] text-[22px] font-semibold leading-7 text-[#000000] sm:text-[26px] sm:leading-8 min-[1000px]:text-[30px] min-[1000px]:leading-[36px]">
            Dashboard Overview
          </h1>
          <p className="align-middle font-[Inter,sans-serif] text-sm font-normal leading-5 text-[#6B7280] sm:text-[16px] sm:leading-[24px]">
            Summary of key metrics and insights across your organization.
          </p>
        </header>

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-[14px] xl:grid-cols-4">
          <SummaryCard
            label="Total Workforce"
            value={data.summary.totalWorkforce.value}
            changePct={data.summary.totalWorkforce.changePct}
            comparisonLabel={data.comparisonLabel}
            iconSrc="/icons/dashboard-icons/Total-Workforce.svg"
            iconBg="#FFECD6"
            cardBg="#FFF9F2"
          />
          <SummaryCard
            label="Shift Positions"
            value={data.summary.shiftPositions.value}
            changePct={data.summary.shiftPositions.changePct}
            comparisonLabel={data.comparisonLabel}
            iconSrc="/icons/dashboard-icons/Shift-Positions.svg"
            iconBg="#D6FFE6"
            cardBg="#F2FFF7"
          />
          <SummaryCard
            label="New Hires"
            value={data.summary.newHires.value}
            changePct={data.summary.newHires.changePct}
            comparisonLabel={data.comparisonLabel}
            iconSrc="/icons/dashboard-icons/new-hires.svg"
            iconBg="#FFD6D6"
            cardBg="#FFF2F2"
          />
          <SummaryCard
            label="Total Revenue"
            value={data.summary.totalRevenue.value}
            changePct={data.summary.totalRevenue.changePct}
            comparisonLabel={data.comparisonLabel}
            iconSrc="/icons/dashboard-icons/total-revenue.svg"
            iconBg="#FFF1BF"
            cardBg="#FFFCF2"
            pending={data.summary.totalRevenue.pending}
          />
        </div>

        <div className="grid w-full grid-cols-1 gap-3 sm:gap-[14px] xl:grid-cols-2">
          <SectionCard
            id="recruitment-analytics"
            title="Recruitment Analytics" titleColor="#3B82F6" viewAllHref="/admin_recruiter/candidates">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-[14px] lg:grid-cols-[132px_minmax(0,1fr)] lg:items-center">
              <div className="grid grid-cols-2 gap-3 sm:block sm:space-y-[14px]">
                <AnalyticsMetric
                  label="Applications"
                  value={data.recruitment.metrics.applications.value}
                  changePct={data.recruitment.metrics.applications.changePct}
                />
                <AnalyticsMetric
                  label="Interviews"
                  value={data.recruitment.metrics.interviews.value}
                  changePct={data.recruitment.metrics.interviews.changePct}
                />
                <AnalyticsMetric
                  label="Offer Extended"
                  value={data.recruitment.metrics.offerExtended.value}
                  changePct={data.recruitment.metrics.offerExtended.changePct}
                />
                <AnalyticsMetric
                  label="Hires"
                  value={data.recruitment.metrics.hires.value}
                  changePct={data.recruitment.metrics.hires.changePct}
                />
              </div>
              <div className="h-[200px] w-full min-w-0 sm:h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.recruitment.trend} margin={lineChartMargin}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                    <XAxis dataKey="label" tick={CHART_AXIS_TICK} interval="preserveStartEnd" />
                    <YAxis tick={CHART_AXIS_TICK} width={compactCharts ? 28 : 32} tickFormatter={formatYAxisTick} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#FFFFFF", stroke: "#3B82F6", strokeWidth: 2 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            id="workforce-analytics"
            title="Workforce Analytics" titleColor="#F97316" viewAllHref="/admin_recruiter/workers">
            <div className="grid grid-cols-1 gap-3 sm:gap-[14px] lg:grid-cols-[minmax(120px,132px)_minmax(140px,1fr)_minmax(130px,148px)] lg:items-center">
              <div className="grid grid-cols-2 gap-3 sm:block sm:space-y-[14px]">
                <AnalyticsMetric
                  label="Active Workers"
                  value={data.workforce.metrics.activeWorkers.value}
                  changePct={data.workforce.metrics.activeWorkers.changePct}
                />
                <AnalyticsMetric
                  label="Attendance Rate"
                  value={data.workforce.metrics.attendanceRate.value}
                  changePct={data.workforce.metrics.attendanceRate.changePct}
                />
                <AnalyticsMetric
                  label="On-Time Start"
                  value={data.workforce.metrics.onTimeStart.value}
                  changePct={data.workforce.metrics.onTimeStart.changePct}
                />
                <AnalyticsMetric
                  label="Shift Coverage"
                  value={data.workforce.metrics.shiftCoverage.value}
                  changePct={data.workforce.metrics.shiftCoverage.changePct}
                />
              </div>
              <div className="flex h-[200px] min-h-[180px] w-full min-w-0 items-center justify-center px-1 sm:h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Pie
                      data={data.workforce.breakdown}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius="58%"
                      outerRadius="82%"
                      paddingAngle={2}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    >
                      {data.workforce.breakdown.map((slice) => (
                        <Cell key={slice.key} fill={getBreakdownColor(slice)} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 sm:space-y-[14px]">
                {data.workforce.breakdown.map((slice) => (
                  <BreakdownLegendItem key={slice.key} slice={slice} />
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="grid w-full grid-cols-1 gap-3 sm:gap-[14px] xl:grid-cols-2">
          <SectionCard
            id="financial-analytics"
            title="Financial Insights" titleColor={FINANCIAL_INSIGHTS_COLOR} viewAllHref="#">
            {data.financial.pending ? (
              <p className="mb-3 rounded-md bg-[#F0FDF4] px-3 py-2 text-sm text-[#166534] sm:mb-[14px]">
                Revenue tracking is coming soon. Showing hiring activity below.
              </p>
            ) : null}
            <div className="mb-3 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:mb-[14px] sm:gap-[14px] lg:grid-cols-4">
              <AnalyticsMetric label="Applications" value={data.financial.metrics.applications.value} changePct={null} />
              <AnalyticsMetric label="Interviews" value={data.financial.metrics.interviews.value} changePct={null} />
              <AnalyticsMetric label="Offer Extended" value={data.financial.metrics.offerExtended.value} changePct={null} />
              <AnalyticsMetric label="Hires" value={data.financial.metrics.hires.value} changePct={null} />
            </div>
            <p className="mb-3 font-[Inter,sans-serif] text-[14px] font-semibold leading-[20px] text-[#111827] sm:mb-[14px]">
              Revenue Trend
            </p>
            <div className="h-[180px] w-full min-w-0 sm:h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.financial.revenueTrend} margin={lineChartMargin}>
                  <defs>
                    <linearGradient id="financialRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_GREEN_COLOR} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={CHART_GREEN_COLOR} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                  <XAxis dataKey="label" tick={CHART_AXIS_TICK} interval="preserveStartEnd" />
                  <YAxis tick={CHART_AXIS_TICK} width={compactCharts ? 28 : 32} tickFormatter={formatYAxisTick} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="none"
                    fill="url(#financialRevenueFill)"
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={CHART_GREEN_COLOR}
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#FFFFFF", stroke: CHART_GREEN_COLOR, strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: CHART_GREEN_COLOR, stroke: "#FFFFFF", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard
            id="operational-insights"
            title="Operational Insights" titleColor="#3B82F6" viewAllHref="/admin_recruiter/calendar/shifts">
            <div className="mb-3 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:mb-[14px] sm:gap-[14px] lg:grid-cols-4">
              <AnalyticsMetric
                label="Unified Shifts"
                value={data.operational.metrics.unifiedShifts.value}
                changePct={data.operational.metrics.unifiedShifts.changePct}
              />
              <AnalyticsMetric
                label="Pending Approval"
                value={data.operational.metrics.pendingApproval.value}
                changePct={data.operational.metrics.pendingApproval.changePct}
              />
              <AnalyticsMetric
                label="Expiring Documents"
                value={data.operational.metrics.expiringDocuments.value}
                changePct={data.operational.metrics.expiringDocuments.changePct}
              />
              <AnalyticsMetric
                label="Compliance Rate"
                value={data.operational.metrics.complianceRate.value}
                changePct={data.operational.metrics.complianceRate.changePct}
              />
            </div>
            <p className="mb-3 font-[Inter,sans-serif] text-[14px] font-semibold leading-[20px] text-[#111827] sm:mb-[14px]">
              Pending Approvals by type
            </p>
            <div className="h-[180px] w-full min-w-0 sm:h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.operational.pendingApprovalsByType}
                  layout="vertical"
                  margin={{ top: 4, right: compactCharts ? 4 : 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} horizontal={false} />
                  <XAxis type="number" domain={[0, maxPendingBar]} tick={CHART_AXIS_TICK} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={barAxisWidth}
                    tick={{ fontSize: compactCharts ? 10 : 11, fill: "#374151" }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        <section className="w-full min-w-0 rounded-md border border-[#E5E7EB] bg-white p-3 sm:min-h-[228px] sm:p-[14px]">
          <h2 className="font-[Inter,sans-serif] text-[15px] font-semibold leading-[22px] text-[#111827] sm:text-[16px] sm:leading-[24px]">Reports</h2>
          <div className="mt-3 grid w-full grid-cols-1 gap-3 sm:mt-[14px] sm:grid-cols-2 sm:gap-[14px] xl:grid-cols-4">
            {REPORT_CARDS.map((card) => (
              <ReportCard
                key={card.title}
                title={card.title}
                subtitle={card.subtitle}
                icon={"icon" in card ? card.icon : undefined}
                iconSrc={"iconSrc" in card ? card.iconSrc : undefined}
                iconColor={"iconColor" in card ? card.iconColor : undefined}
                iconBg={card.iconBg}
                href={card.href}
                disabled={"disabled" in card ? card.disabled : false}
              />
            ))}
          </div>
        </section>
    </div>
  );
}
