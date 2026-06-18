"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ShiftCalendarEvent, ShiftCalendarFilterOptions, ShiftCalendarStatus } from "@/lib/shifts/types";

type CalendarView = "day" | "week" | "month";

type CalendarEvent = ShiftCalendarEvent & {
  startDateObj: Date;
  endDateObj: Date;
};

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekStart(date: Date): Date {
  const d = startOfDay(date);
  const diff = d.getDay();
  return addDays(d, -diff);
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateHuman(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

function getVisibleRange(anchor: Date, view: CalendarView): { start: Date; end: Date } {
  if (view === "day") return { start: startOfDay(anchor), end: endOfDay(anchor) };
  if (view === "week") {
    const start = getWeekStart(anchor);
    return { start, end: endOfDay(addDays(start, 6)) };
  }
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const gridStart = addDays(startOfDay(monthStart), -monthStart.getDay());
  const gridEnd = endOfDay(addDays(monthEnd, 6 - monthEnd.getDay()));
  return { start: gridStart, end: gridEnd };
}

function statusColor(status: ShiftCalendarStatus): string {
  if (status === "cancelled") return "bg-red-100 text-red-700 border-red-200";
  if (status === "pending") return "bg-amber-100 text-amber-700 border-amber-200";
  if (status === "confirmed") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  return "bg-blue-100 text-blue-700 border-blue-200";
}

function statusPill(status: ShiftCalendarStatus): string {
  return status.slice(0, 1).toUpperCase() + status.slice(1);
}

const EMPTY_FILTER_OPTIONS: ShiftCalendarFilterOptions = {
  workers: [],
  jobRoles: [],
  facilities: [],
  statuses: [],
};

export default function AdminRecruiterCalendarPage() {
  const [view, setView] = useState<CalendarView>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filterOptions, setFilterOptions] = useState<ShiftCalendarFilterOptions>(EMPTY_FILTER_OPTIONS);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const [workerFilter, setWorkerFilter] = useState("all");
  const [jobRoleFilter, setJobRoleFilter] = useState("all");
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const visibleRange = useMemo(() => getVisibleRange(anchorDate, view), [anchorDate, view]);

  const loadCalendarData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const startKey = formatDateKey(visibleRange.start);
    const endKey = formatDateKey(visibleRange.end);

    try {
      const params = new URLSearchParams({ start: startKey, end: endKey });
      const res = await fetch(`/api/admin/shift-calendar?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = (await res.json()) as {
        events?: ShiftCalendarEvent[];
        filterOptions?: ShiftCalendarFilterOptions;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(json.error || "Failed to load shifts.");
      }

      const mapped = (json.events ?? []).map((event) => ({
        ...event,
        startDateObj: parseDateKey(event.startDate),
        endDateObj: parseDateKey(event.endDate),
      }));

      setEvents(mapped);
      setFilterOptions(json.filterOptions ?? EMPTY_FILTER_OPTIONS);
    } catch (err) {
      console.error("[AdminRecruiterCalendar] load failed", err);
      setError(err instanceof Error ? err.message : "Failed to load shifts.");
      setEvents([]);
      setFilterOptions(EMPTY_FILTER_OPTIONS);
    } finally {
      setLoading(false);
    }
  }, [visibleRange.end, visibleRange.start]);

  useEffect(() => {
    void loadCalendarData();
  }, [loadCalendarData]);

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        if (workerFilter !== "all" && event.workerId !== workerFilter) return false;
        if (jobRoleFilter !== "all" && event.jobRole !== jobRoleFilter) return false;
        if (facilityFilter !== "all" && event.facilityId !== facilityFilter) return false;
        if (statusFilter !== "all" && event.status !== statusFilter) return false;
        return true;
      }),
    [events, facilityFilter, jobRoleFilter, statusFilter, workerFilter]
  );

  const dayColumns = useMemo(() => {
    if (view === "day") return [startOfDay(anchorDate)];
    if (view === "week") {
      const weekStart = getWeekStart(anchorDate);
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }
    return [];
  }, [anchorDate, view]);

  const dayEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((event) => {
      let cursor = startOfDay(event.startDateObj);
      const end = startOfDay(event.endDateObj);
      while (cursor <= end) {
        const key = formatDateKey(cursor);
        const current = map.get(key) ?? [];
        current.push(event);
        map.set(key, current);
        cursor = addDays(cursor, 1);
      }
    });
    map.forEach((value) => value.sort((a, b) => a.startHour - b.startHour));
    return map;
  }, [filteredEvents]);

  const monthDays = useMemo(() => {
    if (view !== "month") return [];
    const start = visibleRange.start;
    const totalDays = Math.round((visibleRange.end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Array.from({ length: totalDays }, (_, i) => addDays(start, i));
  }, [view, visibleRange.end, visibleRange.start]);

  function goNext() {
    if (view === "day") setAnchorDate((d) => addDays(d, 1));
    else if (view === "week") setAnchorDate((d) => addDays(d, 7));
    else setAnchorDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  function goPrev() {
    if (view === "day") setAnchorDate((d) => addDays(d, -1));
    else if (view === "week") setAnchorDate((d) => addDays(d, -7));
    else setAnchorDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  return (
    <main className="p-4 sm:p-6">
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">Shift calendar</h1>
            <p className="text-sm text-[#64748B]">Google Calendar-style shift scheduling for recruiter admins.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAnchorDate(new Date())} className="rounded-md border border-[#CBD5E1] px-3 py-1.5 text-sm">
              Today
            </button>
            <button type="button" onClick={goPrev} className="rounded-md border border-[#CBD5E1] px-3 py-1.5 text-sm">
              Prev
            </button>
            <button type="button" onClick={goNext} className="rounded-md border border-[#CBD5E1] px-3 py-1.5 text-sm">
              Next
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-[#334155]">
            {formatDateHuman(visibleRange.start)} - {formatDateHuman(visibleRange.end)}
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-[#F1F5F9] p-1">
            {(["day", "week", "month"] as CalendarView[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-md px-3 py-1.5 text-sm ${view === mode ? "bg-white text-[#0F172A] shadow" : "text-[#64748B]"}`}
              >
                {mode[0].toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select value={workerFilter} onChange={(e) => setWorkerFilter(e.target.value)} className="rounded-md border border-[#CBD5E1] px-2 py-2 text-sm">
            <option value="all">All workers</option>
            {filterOptions.workers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select value={jobRoleFilter} onChange={(e) => setJobRoleFilter(e.target.value)} className="rounded-md border border-[#CBD5E1] px-2 py-2 text-sm">
            <option value="all">All job roles</option>
            {filterOptions.jobRoles.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)} className="rounded-md border border-[#CBD5E1] px-2 py-2 text-sm">
            <option value="all">All facilities</option>
            {filterOptions.facilities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-[#CBD5E1] px-2 py-2 text-sm">
            <option value="all">All statuses</option>
            {filterOptions.statuses.map((item) => (
              <option key={item} value={item}>
                {statusPill(item)}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {loading ? <p className="mb-4 text-sm text-[#64748B]">Loading shifts...</p> : null}

        {!loading && !error && filteredEvents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#CBD5E1] p-8 text-center text-sm text-[#64748B]">
            No shifts found for this date range and filters.
          </div>
        ) : null}

        {(view === "day" || view === "week") && !loading && filteredEvents.length > 0 ? (
          <div className="overflow-auto rounded-lg border border-[#E2E8F0]">
            <div className="grid min-w-[900px]" style={{ gridTemplateColumns: `80px repeat(${dayColumns.length}, minmax(180px,1fr))` }}>
              <div className="sticky left-0 top-0 z-20 border-r border-[#E2E8F0] bg-white p-2 text-xs font-semibold text-[#64748B]">Time</div>
              {dayColumns.map((day) => {
                const isToday = formatDateKey(day) === formatDateKey(new Date());
                return (
                  <div
                    key={formatDateKey(day)}
                    className={`border-r border-[#E2E8F0] p-2 text-center text-xs font-semibold ${isToday ? "bg-blue-50 text-blue-700" : "bg-white text-[#475569]"}`}
                  >
                    {WEEKDAY_LABELS[day.getDay()]} {day.getDate()}
                  </div>
                );
              })}

              {HOUR_LABELS.map((hourLabel, hour) => (
                <div key={hourLabel} className="contents">
                  <div className="sticky left-0 z-10 border-r border-t border-[#E2E8F0] bg-white p-2 text-xs text-[#64748B]">{hourLabel}</div>
                  {dayColumns.map((day) => {
                    const key = formatDateKey(day);
                    const cellEvents = (dayEventsByDate.get(key) ?? []).filter((event) => event.startHour === hour);
                    return (
                      <div key={`${key}-${hour}`} className="min-h-12 border-r border-t border-[#E2E8F0] p-1">
                        {cellEvents.slice(0, 2).map((event) => (
                          <button
                            key={`${event.id}-${hour}`}
                            type="button"
                            onClick={() => setSelectedEvent(event)}
                            title={`${event.workerName} • ${event.jobRole} • ${event.facility} • ${statusPill(event.status)}`}
                            className={`mb-1 w-full rounded border px-2 py-1 text-left text-[11px] ${statusColor(event.status)}`}
                          >
                            <div className="truncate font-semibold">{event.title}</div>
                            <div className="truncate">{event.workerName}</div>
                          </button>
                        ))}
                        {cellEvents.length > 2 ? <p className="text-[10px] text-[#64748B]">+{cellEvents.length - 2} more</p> : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {view === "month" && !loading && filteredEvents.length > 0 ? (
          <div className="overflow-auto rounded-lg border border-[#E2E8F0]">
            <div className="grid min-w-[900px] grid-cols-7">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="border-b border-r border-[#E2E8F0] bg-[#F8FAFC] p-2 text-xs font-semibold text-[#475569]">
                  {label}
                </div>
              ))}
              {monthDays.map((day) => {
                const key = formatDateKey(day);
                const cellEvents = dayEventsByDate.get(key) ?? [];
                const isToday = key === formatDateKey(new Date());
                const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
                return (
                  <div key={key} className={`min-h-28 border-b border-r border-[#E2E8F0] p-1 ${isCurrentMonth ? "bg-white" : "bg-[#F8FAFC]"}`}>
                    <div className={`mb-1 inline-block rounded px-1.5 py-0.5 text-xs ${isToday ? "bg-blue-600 text-white" : "text-[#64748B]"}`}>{day.getDate()}</div>
                    <div className="space-y-1">
                      {cellEvents.slice(0, 3).map((event) => (
                        <button
                          key={`${event.id}-${key}`}
                          type="button"
                          onClick={() => setSelectedEvent(event)}
                          title={`${event.workerName} • ${event.jobRole} • ${event.facility} • ${statusPill(event.status)}`}
                          className={`w-full rounded border px-1.5 py-0.5 text-left text-[10px] ${statusColor(event.status)}`}
                        >
                          <span className="truncate block font-medium">{event.title}</span>
                        </button>
                      ))}
                      {cellEvents.length > 3 ? <p className="text-[10px] text-[#64748B]">+{cellEvents.length - 3} more</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {selectedEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#0F172A]">Shift details</h2>
              <button type="button" onClick={() => setSelectedEvent(null)} className="text-sm text-[#64748B]">
                Close
              </button>
            </div>
            <div className="space-y-2 text-sm text-[#334155]">
              <p>
                <span className="font-semibold">Title:</span> {selectedEvent.title}
              </p>
              <p>
                <span className="font-semibold">Worker:</span> {selectedEvent.workerName}
              </p>
              <p>
                <span className="font-semibold">Role:</span> {selectedEvent.jobRole}
              </p>
              <p>
                <span className="font-semibold">Facility:</span> {selectedEvent.facility}
              </p>
              <p>
                <span className="font-semibold">Date:</span> {formatDateHuman(selectedEvent.startDateObj)} -{" "}
                {formatDateHuman(selectedEvent.endDateObj)}
              </p>
              <p>
                <span className="font-semibold">Time slot:</span> {String(selectedEvent.startHour).padStart(2, "0")}:00 -{" "}
                {String(selectedEvent.endHour).padStart(2, "0")}:00
              </p>
              <p>
                <span className="font-semibold">Status:</span> {statusPill(selectedEvent.status)}
              </p>
              <p className="text-xs text-[#64748B]">Shift ID: {selectedEvent.shiftId}</p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
