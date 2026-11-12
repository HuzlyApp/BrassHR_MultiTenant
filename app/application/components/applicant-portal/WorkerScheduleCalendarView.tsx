"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  List,
  Palmtree,
  Plane,
  TreePine,
} from "lucide-react";
import {
  addEasternDays,
  easternDateString,
  easternTimeString,
  getEasternParts,
  startOfEasternDay,
} from "@/lib/datetime/eastern";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { getFirstName } from "./worker-dashboard-utils";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SCHEDULE_SUBTITLE_CLASS,
  WORKER_SCHEDULE_SUBTITLE_STYLE,
  WORKER_SCHEDULE_TITLE_CLASS,
  WORKER_SCHEDULE_TITLE_STYLE,
  WORKER_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";
import type {
  WorkerMonthSchedulePayload,
  WorkerScheduleEvent,
  WorkerScheduleEventKind,
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
  dot: string;
};

/** Past / completed work shifts */
const WORKED_THEME: EventTheme = {
  bg: "#FFF7ED",
  text: "#9A3412",
  border: "#FED7AA",
  legend: "#F97316",
  dot: "#F97316",
};

/** Future scheduled work shifts */
const UPCOMING_WORK_THEME: EventTheme = {
  bg: "#F5F3FF",
  text: "#5B21B6",
  border: "#DDD6FE",
  legend: "#8B5CF6",
  dot: "#8B5CF6",
};

/** PTO, vacation, travel, absent, late */
const ABSENCE_THEME: EventTheme = {
  bg: "#EFF6FF",
  text: "#1E40AF",
  border: "#BFDBFE",
  legend: "#3B82F6",
  dot: "#3B82F6",
};

const HOLIDAY_THEME: EventTheme = {
  bg: "#ECFDF5",
  text: "#047857",
  border: "#A7F3D0",
  legend: "#10B981",
  dot: "#10B981",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function isAbsenceKind(kind: WorkerScheduleEventKind): boolean {
  return kind === "pto" || kind === "vacation" || kind === "travel";
}

function isWorkedShift(event: WorkerScheduleEvent, todayDate: string, nowTime: string): boolean {
  if (event.workDate < todayDate) return true;
  if (event.workDate > todayDate) return false;
  return event.endTime < nowTime;
}

function themeForEvent(
  event: WorkerScheduleEvent,
  todayDate: string,
  nowTime: string
): EventTheme {
  if (event.kind === "holiday") return HOLIDAY_THEME;
  if (isAbsenceKind(event.kind)) return ABSENCE_THEME;
  return isWorkedShift(event, todayDate, nowTime) ? WORKED_THEME : UPCOMING_WORK_THEME;
}

function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = easternDateString(startOfEasternDay(new Date(Date.UTC(year, month - 1, 1, 12))));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = easternDateString(startOfEasternDay(new Date(Date.UTC(year, month - 1, lastDay, 12))));
  return { start, end };
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const cursor = new Date(Date.UTC(y, m - 1 + delta, 1, 12));
  return `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildMonthOptions(reference: Date, span = 24): Array<{ value: string; label: string }> {
  const parts = getEasternParts(reference);
  const options: Array<{ value: string; label: string }> = [];
  for (let offset = -8; offset < span - 8; offset += 1) {
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

function EventGlyph({ kind, color }: { kind: WorkerScheduleEventKind; color: string }) {
  if (kind === "travel") return <Plane className="h-3 w-3 shrink-0" style={{ color }} strokeWidth={2.25} />;
  if (kind === "vacation") return <Palmtree className="h-3 w-3 shrink-0" style={{ color }} strokeWidth={2.25} />;
  if (kind === "holiday") return <TreePine className="h-3 w-3 shrink-0" style={{ color }} strokeWidth={2.25} />;
  if (kind === "pto") return <Palmtree className="h-3 w-3 shrink-0" style={{ color }} strokeWidth={2.25} />;
  return <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />;
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
  const nowTime = easternTimeString(new Date());

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

  useEffect(() => {
    setSelectedDate(null);
  }, [monthKey]);

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

  const activeSelected = selectedDate ?? todayDate;

  return (
    <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} pb-8`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className={WORKER_SCHEDULE_TITLE_CLASS} style={WORKER_SCHEDULE_TITLE_STYLE}>
            Hello {getFirstName(userName)}!
          </h1>
          <p className={WORKER_SCHEDULE_SUBTITLE_CLASS} style={WORKER_SCHEDULE_SUBTITLE_STYLE}>
            Here is your work schedule for this month.
          </p>
        </div>
        <div className="inline-flex min-w-0 max-w-full flex-col gap-1 rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94A3B8]">
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
              aria-label="Calendar view"
              aria-pressed={layout === "month"}
              onClick={() => setLayout("month")}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition ${
                layout === "month"
                  ? "bg-[#012352] text-white shadow-sm"
                  : "text-[#64748B] hover:text-[#334155]"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="List view"
              aria-pressed={layout === "list"}
              onClick={() => setLayout("list")}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition ${
                layout === "list"
                  ? "bg-[#012352] text-white shadow-sm"
                  : "text-[#64748B] hover:text-[#334155]"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMonthKey((current) => shiftMonthKey(current, -1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#374151] transition hover:bg-[#F8FAFC]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setMonthKey((current) => shiftMonthKey(current, 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#374151] transition hover:bg-[#F8FAFC]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

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
          <MonthGrid
            days={calendarDays}
            monthLabel={monthLabel}
            selectedDate={activeSelected}
            onSelectDate={setSelectedDate}
            todayDate={todayDate}
            nowTime={nowTime}
          />
        ) : (
          <ListAgenda
            days={listDays}
            empty={!listDays.length}
            todayDate={todayDate}
            nowTime={nowTime}
          />
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#E5E7EB] px-4 py-3">
          <LegendDot color={WORKED_THEME.legend} label="Worked" />
          <LegendDot color={HOLIDAY_THEME.legend} label="Holiday" />
          <LegendDot color={ABSENCE_THEME.legend} label="PTO / Absent / Late" />
          <LegendDot color={UPCOMING_WORK_THEME.legend} label="Upcoming work" />
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

function EventChip({
  event,
  todayDate,
  nowTime,
}: {
  event: WorkerScheduleEvent;
  todayDate: string;
  nowTime: string;
}) {
  const theme = themeForEvent(event, todayDate, nowTime);
  const isSpecial =
    event.kind === "travel" ||
    event.kind === "vacation" ||
    event.kind === "holiday" ||
    event.kind === "pto";

  return (
    <div
      title={`${event.timeRange} · ${event.label}`}
      className="flex min-w-0 items-start gap-1.5 rounded-lg border px-1.5 py-1.5"
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        borderColor: theme.border,
      }}
    >
      <span className="mt-0.5">
        <EventGlyph kind={event.kind} color={theme.dot} />
      </span>
      <span className="min-w-0 flex-1">
        {isSpecial ? (
          <span className="block truncate text-[10px] font-semibold leading-4">{event.label}</span>
        ) : (
          <>
            <span className="block truncate text-[10px] font-semibold leading-4">{event.timeRange}</span>
            <span className="block truncate text-[9px] font-medium leading-3 opacity-80">
              {event.label || "Working hours"}
            </span>
          </>
        )}
      </span>
    </div>
  );
}

function MonthGrid({
  days,
  monthLabel,
  selectedDate,
  onSelectDate,
  todayDate,
  nowTime,
}: {
  days: DayCell[];
  monthLabel: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  todayDate: string;
  nowTime: string;
}) {
  return (
    <div className="overflow-x-auto p-3 sm:p-4">
      <p className="sr-only">{monthLabel} calendar</p>
      <div className="min-w-[860px]">
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const selected = day.date === selectedDate;
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => onSelectDate(day.date)}
                className={`min-h-[118px] rounded-xl border bg-white p-2 text-left transition ${
                  selected
                    ? "border-[#2563EB] shadow-[0_0_0_1px_#2563EB]"
                    : "border-[#E5E7EB] hover:border-[#CBD5E1]"
                } ${day.inMonth ? "" : "bg-[#FCFCFD]"}`}
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
                  {day.events.slice(0, 3).map((event) => (
                    <EventChip
                      key={event.id}
                      event={event}
                      todayDate={todayDate}
                      nowTime={nowTime}
                    />
                  ))}
                  {day.events.length > 3 ? (
                    <p className="px-1 text-[10px] font-medium text-[#64748B]">
                      +{day.events.length - 3} more
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ListAgenda({
  days,
  empty,
  todayDate,
  nowTime,
}: {
  days: Array<{ date: string; primary: string; weekday: string; events: WorkerScheduleEvent[] }>;
  empty: boolean;
  todayDate: string;
  nowTime: string;
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
              const theme = themeForEvent(event, todayDate, nowTime);
              const isSpecial =
                event.kind === "travel" ||
                event.kind === "vacation" ||
                event.kind === "holiday" ||
                event.kind === "pto";
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
                  <span className="inline-flex min-w-0 items-center gap-2 truncate text-[13px] font-semibold">
                    <EventGlyph kind={event.kind} color={theme.dot} />
                    <span className="truncate">
                      {isSpecial ? event.label : event.timeRange}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] font-medium opacity-90">
                    {event.kind === "work"
                      ? event.label || "Working hours"
                      : event.kind === "pto"
                        ? event.label || "PTO"
                        : event.kind === "travel"
                          ? "Travel"
                          : event.kind === "vacation"
                            ? "Vacation"
                            : "Holiday"}
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
