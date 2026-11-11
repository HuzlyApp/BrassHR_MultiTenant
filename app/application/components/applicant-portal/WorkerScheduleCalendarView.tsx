"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, LayoutGrid, List } from "lucide-react";
import {
  addEasternDays,
  easternDateString,
  getEasternParts,
  startOfEasternDay,
} from "@/lib/datetime/eastern";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { getFirstName } from "./worker-dashboard-utils";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SCHEDULE_SUBTITLE_STYLE,
  WORKER_SCHEDULE_TITLE_CLASS,
  WORKER_SCHEDULE_TITLE_STYLE,
  WORKER_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";
import type {
  WorkerMonthSchedulePayload,
  WorkerScheduleEvent,
} from "@/lib/applicant-portal/load-worker-month-schedule";

type CalendarLayout = "month" | "list";

type DayCell = {
  date: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  events: WorkerScheduleEvent[];
};

type EventTheme = {
  bg: string;
  text: string;
  border: string;
  legend: string;
};

const WORK_THEMES: EventTheme[] = [
  { bg: "#DBEAFE", text: "#1D4ED8", border: "#93C5FD", legend: "#3B82F6" },
  { bg: "#DCFCE7", text: "#15803D", border: "#86EFAC", legend: "#22C55E" },
  { bg: "#FEF3C7", text: "#B45309", border: "#FCD34D", legend: "#F59E0B" },
  { bg: "#EDE9FE", text: "#6D28D9", border: "#C4B5FD", legend: "#8B5CF6" },
];

const PTO_THEME: EventTheme = {
  bg: "#FFEDD5",
  text: "#C2410C",
  border: "#FDBA74",
  legend: "#FB923C",
};

const HOLIDAY_THEME: EventTheme = {
  bg: "#D1FAE5",
  text: "#047857",
  border: "#6EE7B7",
  legend: "#34D399",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function themeForEvent(event: WorkerScheduleEvent): EventTheme {
  if (event.kind === "pto") return PTO_THEME;
  if (event.kind === "holiday") return HOLIDAY_THEME;
  return WORK_THEMES[event.colorIndex % WORK_THEMES.length];
}

function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = easternDateString(startOfEasternDay(new Date(Date.UTC(year, month - 1, 1, 12))));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = easternDateString(startOfEasternDay(new Date(Date.UTC(year, month - 1, lastDay, 12))));
  return { start, end };
}

function buildMonthOptions(reference: Date, span = 18): Array<{ value: string; label: string }> {
  const parts = getEasternParts(reference);
  const options: Array<{ value: string; label: string }> = [];
  for (let offset = -6; offset < span - 6; offset += 1) {
    const cursor = new Date(Date.UTC(parts.year, parts.month - 1 + offset, 1, 12));
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const label = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(cursor);
    options.push({ value: `${y}-${String(m).padStart(2, "0")}`, label });
  }
  return options;
}

function formatNextShiftDate(workDate: string): string {
  const [year, month, day] = workDate.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(noonUtc);
}

function formatListDate(workDate: string): { primary: string; weekday: string } {
  const [year, month, day] = workDate.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12));
  return {
    primary: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(noonUtc),
    weekday: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "UTC",
    }).format(noonUtc),
  };
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

type Props = {
  userName: string;
};

export function WorkerScheduleCalendarView({ userName }: Props) {
  const { authHeaders } = useApplicantPortal();
  const todayParts = getEasternParts(new Date());
  const [monthKey, setMonthKey] = useState(
    () => `${todayParts.year}-${String(todayParts.month).padStart(2, "0")}`
  );
  const [layout, setLayout] = useState<CalendarLayout>("month");
  const [events, setEvents] = useState<WorkerScheduleEvent[]>([]);
  const [nextShift, setNextShift] = useState<WorkerMonthSchedulePayload["nextShift"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthOptions = useMemo(() => buildMonthOptions(new Date()), []);
  const [year, month] = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return [y, m] as const;
  }, [monthKey]);

  const bounds = useMemo(() => monthBounds(year, month), [year, month]);
  const todayDate = easternDateString(new Date());

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");

      const qs = new URLSearchParams({ start: bounds.start, end: bounds.end });
      const res = await fetch(`/api/applicant-portal/schedule?${qs.toString()}`, {
        headers,
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as WorkerMonthSchedulePayload & {
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not load schedule.");

      setEvents(payload.events ?? []);
      setNextShift(payload.nextShift ?? null);
    } catch (err) {
      setEvents([]);
      setNextShift(null);
      setError(err instanceof Error ? err.message : "Could not load schedule.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, bounds.end, bounds.start]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, WorkerScheduleEvent[]>();
    for (const event of events) {
      const list = map.get(event.workDate) ?? [];
      list.push(event);
      map.set(event.workDate, list);
    }
    return map;
  }, [events]);

  const calendarDays = useMemo(() => {
    const firstOfMonth = startOfEasternDay(new Date(Date.UTC(year, month - 1, 1, 12)));
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1, 12)).getUTCDay();
    const start = addEasternDays(firstOfMonth, -firstWeekday);
    const days: DayCell[] = [];

    for (let i = 0; i < 42; i += 1) {
      const date = addEasternDays(start, i);
      const dateKey = easternDateString(date);
      const parts = getEasternParts(date);
      days.push({
        date: dateKey,
        dayNumber: parts.day,
        inMonth: parts.month === month && parts.year === year,
        isToday: dateKey === todayDate,
        events: eventsByDate.get(dateKey) ?? [],
      });
    }

    if (days.slice(35).every((day) => !day.inMonth && day.events.length === 0)) {
      return days.slice(0, 35);
    }
    return days;
  }, [eventsByDate, month, todayDate, year]);

  const listDays = useMemo(() => {
    const dates = [...eventsByDate.keys()].sort();
    return dates.map((date) => ({
      date,
      ...formatListDate(date),
      events: eventsByDate.get(date) ?? [],
    }));
  }, [eventsByDate]);

  function handleExport() {
    const rows = [
      ["Date", "Start", "End", "Title", "Label", "Facility", "Kind"].join(","),
      ...events.map((event) =>
        [
          event.workDate,
          event.startTime,
          event.endTime,
          csvEscape(event.title),
          csvEscape(event.label),
          csvEscape(event.facility ?? ""),
          event.kind,
        ].join(",")
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `schedule-${monthKey}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const monthLabel =
    monthOptions.find((option) => option.value === monthKey)?.label ??
    new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, month - 1, 1, 12))
    );

  return (
    <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} pb-8`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={WORKER_SCHEDULE_TITLE_CLASS} style={WORKER_SCHEDULE_TITLE_STYLE}>
            Hello {getFirstName(userName)}!
          </h1>
        </div>
        <div className="inline-flex min-w-0 items-center gap-3 rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-3">
          <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#94A3B8]">
            Next Shift
          </span>
          <span className="min-w-0 text-[14px] font-medium text-[#012352]" style={WORKER_SECTION_TITLE_STYLE}>
            {nextShift
              ? `${formatNextShiftDate(nextShift.workDate)} • ${nextShift.timeRange}`
              : "No upcoming shifts"}
          </span>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className={`${WORKER_SCHEDULE_CARD_CLASS} mt-5`}>
        <div className="flex flex-col gap-3 border-b border-[#E5E7EB] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-1">
            <button
              type="button"
              aria-label="Month calendar view"
              aria-pressed={layout === "month"}
              onClick={() => setLayout("month")}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition ${
                layout === "month"
                  ? "bg-white text-[color:var(--brand-primary)] shadow-sm"
                  : "text-[#64748B] hover:text-[#334155]"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="List schedule view"
              aria-pressed={layout === "list"}
              onClick={() => setLayout("list")}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition ${
                layout === "list"
                  ? "bg-white text-[color:var(--brand-primary)] shadow-sm"
                  : "text-[#64748B] hover:text-[#334155]"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative inline-flex min-w-[180px] items-center">
              <span className="sr-only">Select month</span>
              <select
                value={monthKey}
                onChange={(event) => setMonthKey(event.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-[#E5E7EB] bg-white py-2 pl-3 pr-9 text-[14px] font-medium text-[#012352] outline-none focus:border-[color:var(--brand-primary)]"
                style={WORKER_SCHEDULE_SUBTITLE_STYLE}
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-[#64748B]" />
            </label>
            <button
              type="button"
              onClick={handleExport}
              disabled={events.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#374151] transition hover:bg-[#F8FAFC] disabled:opacity-50"
              style={WORKER_SECTION_TITLE_STYLE}
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-16 text-center text-[14px] text-[#64748B]">Loading schedule…</div>
        ) : layout === "month" ? (
          <MonthGrid days={calendarDays} monthLabel={monthLabel} />
        ) : (
          <ListAgenda days={listDays} empty={!listDays.length} />
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#E5E7EB] px-4 py-3">
          <LegendDot color={WORK_THEMES[0].legend} label="Work Shift" />
          <LegendDot color={WORK_THEMES[1].legend} label="Work Shift" />
          <LegendDot color={WORK_THEMES[2].legend} label="Work Shift" />
          <LegendDot color={WORK_THEMES[3].legend} label="Work Shift" />
          <LegendDot color={PTO_THEME.legend} label="PTO" />
          <LegendDot color={HOLIDAY_THEME.legend} label="Holiday" />
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-[#64748B]">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}

function MonthGrid({ days, monthLabel }: { days: DayCell[]; monthLabel: string }) {
  return (
    <div className="overflow-x-auto p-3 sm:p-4">
      <p className="sr-only">{monthLabel} calendar</p>
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 gap-px rounded-t-lg bg-[#E5E7EB]">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="bg-[#F8FAFC] px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px rounded-b-lg border border-t-0 border-[#E5E7EB] bg-[#E5E7EB]">
          {days.map((day) => (
            <div
              key={day.date}
              className={`min-h-[104px] bg-white p-2 ${day.inMonth ? "" : "bg-[#FCFCFD]"}`}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span
                  className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-semibold ${
                    day.isToday
                      ? "bg-[color:var(--brand-primary)] text-white"
                      : day.inMonth
                        ? "text-[#111827]"
                        : "text-[#CBD5E1]"
                  }`}
                >
                  {day.dayNumber}
                </span>
              </div>
              <div className="space-y-1">
                {day.events.slice(0, 3).map((event) => {
                  const theme = themeForEvent(event);
                  return (
                    <div
                      key={event.id}
                      title={`${event.timeRange} · ${event.label}`}
                      className="truncate rounded-md border px-1.5 py-1 text-[10px] font-semibold leading-4"
                      style={{
                        backgroundColor: theme.bg,
                        color: theme.text,
                        borderColor: theme.border,
                      }}
                    >
                      {event.kind === "work" ? event.timeRange : event.label}
                    </div>
                  );
                })}
                {day.events.length > 3 ? (
                  <p className="px-1 text-[10px] font-medium text-[#64748B]">
                    +{day.events.length - 3} more
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListAgenda({
  days,
  empty,
}: {
  days: Array<{ date: string; primary: string; weekday: string; events: WorkerScheduleEvent[] }>;
  empty: boolean;
}) {
  if (empty) {
    return (
      <div className="px-4 py-16 text-center text-[14px] text-[#64748B]">
        There is nothing scheduled this month.
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#E5E7EB]">
      {days.map((day) => (
        <div
          key={day.date}
          className="grid gap-3 px-4 py-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start"
        >
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#111827]">{day.primary}</p>
            <p className="text-[12px] text-[#6B7280]">{day.weekday}</p>
          </div>
          <div className="space-y-2">
            {day.events.map((event) => {
              const theme = themeForEvent(event);
              return (
                <div
                  key={event.id}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-full border px-4 py-2.5"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  }}
                >
                  <span className="min-w-0 truncate text-[13px] font-semibold">
                    {event.kind === "holiday" || event.kind === "pto"
                      ? event.label
                      : event.timeRange}
                  </span>
                  <span className="shrink-0 text-[12px] font-medium opacity-90">
                    {event.kind === "work" ? event.label || "Working Hours" : event.kind === "pto" ? "PTO" : "Holiday"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
