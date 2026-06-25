"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import { SchedulingSubNav } from "@/app/admin_recruiter/scheduling/SchedulingSubNav";
import type { ShiftCalendarEvent, ShiftCalendarFilterOptions, ShiftCalendarStatus } from "@/lib/shifts/types";

type ViewMode = "month" | "week";

type CalendarEvent = ShiftCalendarEvent & {
  startDateObj: Date;
  endDateObj: Date;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_LABELS = [
  "8:00 AM",
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "Noon",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
] as const;
const HOUR_SLOTS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;

const STATUS_LABELS: Record<ShiftCalendarStatus, string> = {
  pending: "Unassigned",
  confirmed: "Accepted",
  active: "Assigned",
  cancelled: "Cancelled",
};

const EMPTY_FILTER_OPTIONS: ShiftCalendarFilterOptions = {
  workers: [],
  jobRoles: [],
  facilities: [],
  statuses: [],
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekStart(date: Date): Date {
  const d = startOfDay(date);
  return addDays(d, -d.getDay());
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

function formatHourRange(startHour: number, endHour: number): string {
  const fmt = (hour: number) => {
    const h = hour % 12 || 12;
    const suffix = hour >= 12 ? "PM" : "AM";
    return `${h}:00 ${suffix}`;
  };
  return `${fmt(startHour)} - ${fmt(endHour)}`;
}

function shiftMatchesHour(event: CalendarEvent, hour: number): boolean {
  return event.startHour <= hour && hour < event.endHour;
}

function MiniMonthCalendar({
  anchorDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: {
  anchorDate: Date;
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const gridStart = addDays(startOfDay(monthStart), -monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayKey = formatDateKey(new Date());
  const selectedKey = formatDateKey(anchorDate);
  const monthTitle = anchorDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F8FAFC]"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-xs font-semibold text-[#111827]">{monthTitle}</p>
        <button
          type="button"
          onClick={onNextMonth}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F8FAFC]"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-[#94A3B8]">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label.slice(0, 1)}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const key = formatDateKey(day);
          const inMonth = day.getMonth() === anchorDate.getMonth();
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(day)}
              className={`h-7 rounded text-[11px] font-medium ${
                isSelected
                  ? "bg-[color:var(--brand-primary)] text-white"
                  : isToday
                    ? "bg-[#FEF3C7] text-[#92400E]"
                    : inMonth
                      ? "text-[#111827] hover:bg-[#F8FAFC]"
                      : "text-[#CBD5E1] hover:bg-[#F8FAFC]"
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-3">
      <p className="mb-2 text-sm font-semibold text-[#111827]">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#374151]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[#D1D5DB] text-[color:var(--brand-primary)] focus:ring-[color:var(--brand-primary)]"
      />
      <span>{label}</span>
    </label>
  );
}

function ShiftMonthGrid({
  anchorDate,
  eventsByDay,
}: {
  anchorDate: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
}) {
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  const gridStart = addDays(startOfDay(monthStart), -monthStart.getDay());
  const gridEnd = addDays(startOfDay(monthEnd), 6 - monthEnd.getDay());
  const totalDays =
    Math.round((gridEnd.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const days = Array.from({ length: totalDays }, (_, i) => addDays(gridStart, i));
  const todayKey = formatDateKey(new Date());

  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
      <div className="grid grid-cols-7 border-b border-[#E5E7EB] bg-[#F8FAFC]">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-2 py-2 text-center text-xs font-semibold text-[#64748B]">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = formatDateKey(day);
          const inMonth = day.getMonth() === anchorDate.getMonth();
          const isToday = key === todayKey;
          const dayEvents = eventsByDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={`min-h-[120px] border-b border-r border-[#E5E7EB] p-1.5 ${
                inMonth ? "bg-white" : "bg-[#FAFBFC]"
              }`}
            >
              <div
                className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isToday ? "bg-[color:var(--brand-primary)] text-white" : "text-[#64748B]"
                }`}
              >
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={`${event.id}-${key}`}
                    className="rounded border border-[#86EFAC] bg-[#DCFCE7] px-1.5 py-1"
                    title={`${event.workerName} • ${event.jobRole}`}
                  >
                    <p className="truncate text-[10px] font-semibold text-[#166534]">
                      {formatHourRange(event.startHour, event.endHour)}
                    </p>
                    <p className="truncate text-[10px] text-[#15803D]">
                      {event.facility || "Worksite"} — {event.workerName === "Open shift" ? "Open Shift" : event.title}
                    </p>
                  </div>
                ))}
                {dayEvents.length > 3 ? (
                  <p className="text-[10px] font-medium text-[#64748B]">+{dayEvents.length - 3} more</p>
                ) : null}
                {inMonth && dayEvents.length === 0 ? (
                  <button
                    type="button"
                    className="mt-1 w-full rounded border border-dashed border-[#CBD5E1] px-1 py-1 text-[10px] text-[#94A3B8]"
                    disabled
                  >
                    + Add a shift
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShiftWeekCalendar({
  anchorDate,
  eventsByDay,
}: {
  anchorDate: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
}) {
  const weekStart = getWeekStart(anchorDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayKey = formatDateKey(new Date());
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayInWeek = weekDays.some((day) => formatDateKey(day) === todayKey);

  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
      <div
        className="grid border-b border-[#E5E7EB] bg-white"
        style={{ gridTemplateColumns: "93px repeat(7, minmax(0, 1fr))" }}
      >
        <div className="border-r border-[#E5E7EB] bg-white" aria-hidden />
        {weekDays.map((day) => {
          const key = formatDateKey(day);
          const isToday = key === todayKey;
          const count = eventsByDay.get(key)?.length ?? 0;
          return (
            <div
              key={key}
              className="flex flex-col items-center border-r border-[#E5E7EB] px-2 py-3 last:border-r-0"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#64748B]">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </p>
              <span
                className={`mt-1 inline-flex h-6 items-center justify-center rounded px-2 py-1 text-xs font-semibold leading-none ${
                  isToday ? "bg-[color:var(--brand-primary)] text-white" : "text-[#1F2937]"
                }`}
              >
                {day.getDate()}
              </span>
              <span
                className={`mt-2 block h-0.5 w-full rounded-full ${
                  isToday ? "bg-[color:var(--brand-primary)]" : "bg-transparent"
                }`}
                aria-hidden
              />
              {count > 0 ? (
                <p className="mt-1 text-[10px] font-semibold leading-none text-[color:var(--brand-primary)]">
                  {count}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="schedule-calendar-scroll relative max-h-[560px] overflow-y-auto">
        {HOUR_LABELS.map((label, index) => {
          const hour = HOUR_SLOTS[index];
          const rowMinutes = hour * 60;
          const showNowLine = todayInWeek && Math.abs(nowMinutes - rowMinutes) < 30;

          return (
            <div
              key={label}
              className="relative grid min-h-[56px] border-b border-[#E5E7EB] bg-white"
              style={{ gridTemplateColumns: "93px repeat(7, minmax(0, 1fr))" }}
            >
              <div className="relative border-r border-[#E5E7EB] bg-white px-3 py-4 text-right text-[11px] text-[#64748B]">
                {label}
              </div>
              {weekDays.map((day) => {
                const key = formatDateKey(day);
                const cellEvents = (eventsByDay.get(key) ?? []).filter((event) => shiftMatchesHour(event, hour));
                return (
                  <div
                    key={`${key}-${hour}`}
                    className="relative border-r border-[#E5E7EB] bg-white p-1.5 last:border-r-0"
                  >
                    {cellEvents.map((event) => (
                      <div
                        key={`${event.id}-${hour}`}
                        className="mb-1 flex overflow-hidden rounded border border-[#E5E7EB] bg-[#F3F4F6]"
                        title={`${event.workerName} • ${event.jobRole}`}
                      >
                        <div className="min-w-0 flex-1 px-2.5 py-2">
                          <p className="truncate text-xs font-semibold text-[#111827]">{event.title}</p>
                          <p className="mt-0.5 truncate text-[10px] leading-snug text-[#6B7280]">
                            {event.facility} — {event.workerName === "Open shift" ? "Open Shift" : event.workerName}
                          </p>
                        </div>
                        <div className="w-1 shrink-0 bg-[#012352]" aria-hidden />
                      </div>
                    ))}
                  </div>
                );
              })}
              {showNowLine ? (
                <div
                  className="pointer-events-none absolute z-10 flex items-center"
                  style={{ left: "93px", right: 0, top: "50%", transform: "translateY(-50%)" }}
                >
                  <div className="h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-[color:var(--brand-primary)]" />
                  <div className="h-px flex-1 bg-[color:var(--brand-primary)]" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SchedulePageClient() {
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filterOptions, setFilterOptions] = useState<ShiftCalendarFilterOptions>(EMPTY_FILTER_OPTIONS);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ShiftCalendarStatus>>(new Set());
  const [rolesInitialized, setRolesInitialized] = useState(false);
  const [statusesInitialized, setStatusesInitialized] = useState(false);

  const visibleRange = useMemo(() => {
    if (viewMode === "week") {
      const start = getWeekStart(anchorDate);
      return { start, end: addDays(start, 6) };
    }
    const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
    return {
      start: addDays(startOfDay(monthStart), -monthStart.getDay()),
      end: addDays(startOfDay(monthEnd), 6 - monthEnd.getDay()),
    };
  }, [anchorDate, viewMode]);

  const loadCalendarData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        start: formatDateKey(visibleRange.start),
        end: formatDateKey(visibleRange.end),
      });
      const res = await fetch(`/api/admin/shift-calendar?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = (await res.json()) as {
        events?: ShiftCalendarEvent[];
        filterOptions?: ShiftCalendarFilterOptions;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load schedule.");

      const mapped = (json.events ?? []).map((event) => ({
        ...event,
        startDateObj: parseDateKey(event.startDate),
        endDateObj: parseDateKey(event.endDate),
      }));
      setEvents(mapped);
      const options = json.filterOptions ?? EMPTY_FILTER_OPTIONS;
      setFilterOptions(options);

      if (!rolesInitialized && options.jobRoles.length > 0) {
        setSelectedRoles(new Set(options.jobRoles));
        setRolesInitialized(true);
      }
      if (!statusesInitialized && options.statuses.length > 0) {
        setSelectedStatuses(new Set(options.statuses));
        setStatusesInitialized(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [rolesInitialized, statusesInitialized, visibleRange.end, visibleRange.start]);

  useEffect(() => {
    void loadCalendarData();
  }, [loadCalendarData]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (selectedRoles.size > 0 && event.jobRole && !selectedRoles.has(event.jobRole)) return false;
      if (selectedStatuses.size > 0 && !selectedStatuses.has(event.status)) return false;
      return true;
    });
  }, [events, selectedRoles, selectedStatuses]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((event) => {
      let cursor = startOfDay(event.startDateObj);
      const end = startOfDay(event.endDateObj);
      while (cursor <= end) {
        const key = formatDateKey(cursor);
        const list = map.get(key) ?? [];
        list.push(event);
        map.set(key, list);
        cursor = addDays(cursor, 1);
      }
    });
    map.forEach((list) => list.sort((a, b) => a.startHour - b.startHour));
    return map;
  }, [filteredEvents]);

  const monthTitle = anchorDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const allRolesSelected =
    filterOptions.jobRoles.length > 0 && selectedRoles.size === filterOptions.jobRoles.length;
  const allStatusesSelected =
    filterOptions.statuses.length > 0 && selectedStatuses.size === filterOptions.statuses.length;

  function toggleAllRoles(checked: boolean) {
    setSelectedRoles(checked ? new Set(filterOptions.jobRoles) : new Set());
  }

  function toggleRole(role: string, checked: boolean) {
    setSelectedRoles((current) => {
      const next = new Set(current);
      if (checked) next.add(role);
      else next.delete(role);
      return next;
    });
  }

  function toggleAllStatuses(checked: boolean) {
    setSelectedStatuses(checked ? new Set(filterOptions.statuses) : new Set());
  }

  function toggleStatus(status: ShiftCalendarStatus, checked: boolean) {
    setSelectedStatuses((current) => {
      const next = new Set(current);
      if (checked) next.add(status);
      else next.delete(status);
      return next;
    });
  }

  function shiftMonth(delta: number) {
    setAnchorDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function shiftWeek(delta: number) {
    setAnchorDate((current) => addDays(current, delta));
  }

  return (
    <div className="px-5 pb-8 pt-5 lg:px-8">
      <SchedulingSubNav />

      <div className="flex min-h-[640px] flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white lg:flex-row">
        <aside className="w-full shrink-0 border-b border-[#E5E7EB] p-4 lg:w-[248px] lg:border-b-0 lg:border-r">
          <div className="space-y-3">
            <MiniMonthCalendar
              anchorDate={anchorDate}
              onSelectDate={setAnchorDate}
              onPrevMonth={() => shiftMonth(-1)}
              onNextMonth={() => shiftMonth(1)}
            />

            <FilterCard title="Positions">
              <FilterCheckbox label="All" checked={allRolesSelected} onChange={toggleAllRoles} />
              {filterOptions.jobRoles.map((role) => (
                <FilterCheckbox
                  key={role}
                  label={role}
                  checked={selectedRoles.has(role)}
                  onChange={(checked) => toggleRole(role, checked)}
                />
              ))}
            </FilterCard>

            <FilterCard title="Shift Status">
              <FilterCheckbox label="All" checked={allStatusesSelected} onChange={toggleAllStatuses} />
              {filterOptions.statuses.map((status) => (
                <FilterCheckbox
                  key={status}
                  label={STATUS_LABELS[status]}
                  checked={selectedStatuses.has(status)}
                  onChange={(checked) => toggleStatus(status, checked)}
                />
              ))}
            </FilterCard>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {viewMode === "week" ? (
                <button
                  type="button"
                  onClick={() => shiftWeek(-7)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#111827]"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#111827]"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <p className="text-base font-bold text-[#111827]">{monthTitle}</p>
              {viewMode === "week" ? (
                <button
                  type="button"
                  onClick={() => shiftWeek(7)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#111827]"
                  aria-label="Next week"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#111827]"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              <span className={viewMode === "week" ? "font-medium text-[#111827]" : ""}>Calendar View</span>
              <button
                type="button"
                role="switch"
                aria-checked={viewMode === "week"}
                onClick={() => setViewMode((mode) => (mode === "month" ? "week" : "month"))}
                className={`relative h-5 w-9 rounded-full transition ${
                  viewMode === "week" ? "bg-[color:var(--brand-primary)]" : "bg-[#CBD5E1]"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                    viewMode === "week" ? "left-0.5" : "left-4"
                  }`}
                />
              </button>
              <span className={viewMode === "month" ? "font-medium text-[#111827]" : ""}>Month View</span>
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <DashboardPageLoader label="Loading schedule..." className="min-h-[420px]" />
          ) : viewMode === "month" ? (
            <ShiftMonthGrid anchorDate={anchorDate} eventsByDay={eventsByDay} />
          ) : (
            <ShiftWeekCalendar anchorDate={anchorDate} eventsByDay={eventsByDay} />
          )}
        </section>
      </div>
    </div>
  );
}
