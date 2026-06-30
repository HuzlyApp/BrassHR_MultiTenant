"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { AdminInterviewItem } from "@/app/api/admin/applicant-appointments/route";
import { formatInterviewDate, formatInterviewTimeRange } from "@/lib/interviews/format";
import { localDateString } from "@/lib/interviews/schedule-fields";
import { InterviewSuccessModal } from "./InterviewSuccessModal";
import { ScheduleInterviewModal } from "./ScheduleInterviewModal";

type TabId = "upcoming" | "recent";
type ViewMode = "list" | "calendar";

type ApplicantOption = {
  id: string;
  name: string;
  status: string;
};

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

/** Local wall-clock hour for each row (must stay in sync with HOUR_LABELS). */
const HOUR_SLOTS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;

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

function isDateInWeek(date: Date, weekStart: Date): boolean {
  const day = startOfDay(date);
  const weekEnd = addDays(weekStart, 6);
  return day >= weekStart && day <= weekEnd;
}

function getDefaultCalendarAnchor(interviews: AdminInterviewItem[]): Date {
  const now = new Date();
  if (interviews.length === 0) return now;

  const weekStart = getWeekStart(now);
  const hasInterviewThisWeek = interviews.some((item) =>
    isDateInWeek(new Date(item.startsAt), weekStart)
  );

  if (hasInterviewThisWeek) return now;

  const earliest = [...interviews].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )[0];
  return new Date(earliest.startsAt);
}

function interviewMatchesHourSlot(startsAt: string, slotHour: number): boolean {
  const start = new Date(startsAt);
  return start.getHours() === slotHour;
}

function TabButton({
  active,
  count,
  label,
  loading,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex w-full items-center gap-2 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium transition disabled:cursor-wait disabled:opacity-70 ${
        active
          ? "border border-[color:var(--brand-primary,#bc8b41)] bg-white text-[color:var(--brand-primary,#bc8b41)]"
          : "border border-transparent text-[#1F2937] hover:bg-[#F8FAFC]"
      }`}
    >
      <span
        className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full p-0.5 text-[10px] font-semibold leading-none ${
          loading
            ? "animate-pulse bg-[#E5E7EB] text-transparent"
            : active
              ? "bg-[color:var(--brand-primary,#bc8b41)] text-white"
              : "bg-[#F4F4F4] text-[color:var(--brand-primary,#bc8b41)]"
        }`}
        aria-hidden
      >
        {count}
      </span>
      <span>{label}</span>
    </button>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#E5E7EB] ${className}`} aria-hidden />;
}

function InterviewsLoadingSkeleton({ viewMode, monthTitle }: { viewMode: ViewMode; monthTitle: string }) {
  if (viewMode === "calendar") {
    return (
      <div className="flex flex-1 flex-col" role="status" aria-live="polite" aria-busy="true" aria-label="Loading interviews">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-base font-bold text-[#111827]">{monthTitle}</p>
          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <span className="font-medium text-[#111827]">Calendar View</span>
            <SkeletonBlock className="h-5 w-9 rounded-full" />
            <span>List View</span>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
          <div
            className="grid border-b border-[#E5E7EB] bg-white"
            style={{ gridTemplateColumns: "93px repeat(7, minmax(0, 1fr))" }}
          >
            <div className="border-r border-[#E5E7EB]" aria-hidden />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center border-r border-[#E5E7EB] px-2 py-3 last:border-r-0">
                <SkeletonBlock className="h-3 w-6" />
                <SkeletonBlock className="mt-1 h-6 w-8 rounded px-2 py-1" />
                <SkeletonBlock className="mt-2 h-0.5 w-full" />
              </div>
            ))}
          </div>
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="grid min-h-[56px] border-b border-[#E5E7EB]"
                style={{ gridTemplateColumns: "93px repeat(7, minmax(0, 1fr))" }}
              >
                <div className="border-r border-[#E5E7EB] px-3 py-4">
                  <SkeletonBlock className="ml-auto h-3 w-10" />
                </div>
                {Array.from({ length: 7 }).map((_, j) => (
                  <div key={j} className="border-r border-[#E5E7EB] p-1 last:border-r-0">
                    {i === 1 && j === 3 ? <SkeletonBlock className="h-10 w-full rounded" /> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col" role="status" aria-live="polite" aria-busy="true" aria-label="Loading interviews">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#1F2937]">{monthTitle}</p>
        <div className="flex items-center gap-2 text-xs text-[#64748B]">
          <span>Calendar View</span>
          <SkeletonBlock className="h-5 w-8 rounded-full" />
          <span className="text-[#1F2937]">List View</span>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex min-h-[96px] border-b border-[#E5E7EB] last:border-b-0">
            <div className="flex w-[120px] shrink-0 items-center justify-center border-r border-[#E5E7EB] px-2">
              <div className="flex flex-col items-center gap-1">
                <SkeletonBlock className="h-3 w-8" />
                <SkeletonBlock className="h-6 w-12 rounded px-2 py-1" />
              </div>
            </div>
            <div className="flex flex-1 items-center justify-between gap-4 px-6 py-4">
              <div className="flex flex-1 flex-col gap-2">
                <SkeletonBlock className="h-4 w-40 sm:w-52" />
                <SkeletonBlock className="h-3 w-56 sm:w-72" />
              </div>
              <SkeletonBlock className="hidden h-4 w-24 shrink-0 sm:block" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onSchedule }: { onSchedule: () => void }) {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-4 py-16 text-center">
      <h3 className="text-lg font-semibold text-black">No Interview found</h3>
      <p className="mt-3 text-sm text-[#6B7280]">Currently there are no interview scheduled</p>
      <p className="mt-1 text-sm text-[color:var(--brand-primary,#bc8b41)]">Learn more about interviews</p>
      <button
        type="button"
        onClick={onSchedule}
        className="mt-8 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
        style={{ backgroundColor: "var(--brand-primary, #bc8b41)" }}
      >
        <Plus className="h-4 w-4" />
        Schedule Interview
      </button>
    </div>
  );
}

function InterviewListView({ interviews }: { interviews: AdminInterviewItem[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, AdminInterviewItem[]>();
    interviews.forEach((item) => {
      const key = formatInterviewDate(item.startsAt);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    });
    return Array.from(map.entries());
  }, [interviews]);

  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
      {grouped.map(([dateLabel, items]) => (
        <div key={dateLabel}>
          {items.map((item) => (
            <div
              key={item.id}
              className="flex min-h-[96px] border-b border-[#E5E7EB] last:border-b-0"
            >
              <div className="flex w-[120px] shrink-0 items-center justify-center border-r border-[#E5E7EB] bg-white px-2 text-center">
                <div>
                  <p className="text-[10px] uppercase text-[#64748B]">{dateLabel.split(" ")[0]}</p>
                  <p className="text-sm font-semibold text-[#1F2937]">
                    {new Date(item.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>
              <div className="flex flex-1 items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="text-sm font-semibold text-[#1F2937]">{item.title}</p>
                  <p className="mt-1 text-xs text-[#64748B]">{item.description}</p>
                </div>
                <p className="shrink-0 text-xs font-semibold text-[#1F2937]">
                  {formatInterviewTimeRange(item.startsAt, item.endsAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function InterviewCalendarView({
  interviews,
  anchorDate,
}: {
  interviews: AdminInterviewItem[];
  anchorDate: Date;
}) {
  const weekStart = getWeekStart(anchorDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayKey = localDateString(new Date());
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayInWeek = weekDays.some((day) => localDateString(day) === todayKey);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, AdminInterviewItem[]>();
    interviews.forEach((item) => {
      const key = localDateString(new Date(item.startsAt));
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    });
    return map;
  }, [interviews]);

  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
      <div
        className="grid border-b border-[#E5E7EB] bg-white"
        style={{ gridTemplateColumns: "93px repeat(7, minmax(0, 1fr))" }}
      >
        <div className="border-r border-[#E5E7EB] bg-white" aria-hidden />
        {weekDays.map((day) => {
          const key = localDateString(day);
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
                  isToday
                    ? "bg-[color:var(--brand-primary,#bc8b41)] text-white"
                    : "text-[#1F2937]"
                }`}
              >
                {day.getDate()}
              </span>
              <span
                className={`mt-2 block h-0.5 w-full rounded-full ${
                  isToday ? "bg-[color:var(--brand-primary,#bc8b41)]" : "bg-transparent"
                }`}
                aria-hidden
              />
              {count > 0 ? (
                <p className="mt-1 text-[10px] font-semibold leading-none text-[color:var(--brand-primary,#bc8b41)]">
                  {count}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="relative max-h-[560px] overflow-y-auto">
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
                const key = localDateString(day);
                const dayEvents = (eventsByDay.get(key) ?? []).filter((event) =>
                  interviewMatchesHourSlot(event.startsAt, hour)
                );
                return (
                  <div
                    key={`${label}-${key}`}
                    className="relative border-r border-[#E5E7EB] bg-white p-1.5 last:border-r-0"
                  >
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        className="mb-1 flex overflow-hidden rounded border border-[#E5E7EB] bg-[#F3F4F6]"
                      >
                        <div className="min-w-0 flex-1 px-2.5 py-2">
                          <p className="truncate text-xs font-semibold text-[#111827]">{event.title}</p>
                          <p className="mt-0.5 truncate text-[10px] leading-snug text-[#6B7280]">
                            {event.description || `Interview with ${event.applicantName}`}
                          </p>
                        </div>
                        <div
                          className="w-1 shrink-0 bg-[#012352]"
                          aria-hidden
                        />
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
                  <div className="h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-[color:var(--brand-primary,#bc8b41)]" />
                  <div className="h-px flex-1 bg-[color:var(--brand-primary,#bc8b41)]" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type InterviewsPageClientProps = {
  /** When set, shows only this candidate's interviews and hides applicant dropdown in schedule modal. */
  workerId?: string;
  candidateName?: string;
  candidateStatus?: string;
  /** Renders without page header / outer card wrapper (for candidate Activities tab). */
  embedded?: boolean;
};

export default function InterviewsPageClient({
  workerId,
  candidateName,
  candidateStatus = "approved",
  embedded = false,
}: InterviewsPageClientProps = {}) {
  const [tab, setTab] = useState<TabId>("upcoming");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [interviews, setInterviews] = useState<AdminInterviewItem[]>([]);
  const [applicants, setApplicants] = useState<ApplicantOption[]>([]);
  const [counts, setCounts] = useState({ upcoming: 0, recent: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [calendarWeekAnchor, setCalendarWeekAnchor] = useState<Date | null>(null);

  const loadInterviews = useCallback(async (activeTab: TabId) => {
    setLoading(true);
    setError(null);
    try {
      if (workerId) {
        const [upcomingRes, recentRes] = await Promise.all([
          fetch("/api/admin/applicant-appointments?tab=upcoming", { credentials: "include" }),
          fetch("/api/admin/applicant-appointments?tab=recent", { credentials: "include" }),
        ]);
        const upcomingData = (await upcomingRes.json().catch(() => ({}))) as {
          error?: string;
          interviews?: AdminInterviewItem[];
          applicants?: ApplicantOption[];
        };
        const recentData = (await recentRes.json().catch(() => ({}))) as {
          error?: string;
          interviews?: AdminInterviewItem[];
        };
        if (!upcomingRes.ok) {
          throw new Error(upcomingData.error || "Failed to load upcoming interviews");
        }
        if (!recentRes.ok) {
          throw new Error(recentData.error || "Failed to load recent interviews");
        }
        const upcoming = (upcomingData.interviews ?? []).filter((item) => item.workerId === workerId);
        const recent = (recentData.interviews ?? []).filter((item) => item.workerId === workerId);
        setCounts({ upcoming: upcoming.length, recent: recent.length });
        setInterviews(activeTab === "upcoming" ? upcoming : recent);
        if (!embedded) setApplicants(upcomingData.applicants ?? []);
        return;
      }

      const res = await fetch(`/api/admin/applicant-appointments?tab=${activeTab}`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        interviews?: AdminInterviewItem[];
        applicants?: ApplicantOption[];
        counts?: { upcoming: number; recent: number };
      };
      if (!res.ok) throw new Error(data.error || "Failed to load interviews");
      setInterviews(data.interviews ?? []);
      setApplicants(data.applicants ?? []);
      setCounts(data.counts ?? { upcoming: 0, recent: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load interviews");
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  }, [workerId, embedded]);

  useEffect(() => {
    void loadInterviews(tab);
  }, [tab, loadInterviews]);

  useEffect(() => {
    setCalendarWeekAnchor(getDefaultCalendarAnchor(interviews));
  }, [interviews]);

  const anchorDate = calendarWeekAnchor ?? new Date();

  function shiftCalendarWeek(deltaDays: number) {
    setCalendarWeekAnchor((prev) => addDays(prev ?? new Date(), deltaDays));
  }

  async function handleSchedule(payload: {
    workerId: string;
    startsAt: string;
    endsAt: string;
    meetingType: "online";
  }) {
    setSubmitting(true);
    setScheduleError(null);
    try {
      const res = await fetch("/api/admin/applicant-appointments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to schedule interview");
      setScheduleOpen(false);
      setSuccessOpen(true);
      setTab("upcoming");
      await loadInterviews("upcoming");
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Failed to schedule interview");
    } finally {
      setSubmitting(false);
    }
  }

  const hasInterviews = interviews.length > 0;
  const monthTitle = anchorDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const modalApplicants = useMemo(() => {
    if (workerId && candidateName) {
      return [{ id: workerId, name: candidateName, status: candidateStatus }];
    }
    return applicants;
  }, [workerId, candidateName, candidateStatus, applicants]);

  const panel = (
    <div
      className={`flex overflow-hidden ${
        embedded ? "min-h-[520px]" : "min-h-[640px] rounded-xl border border-[#E5E7EB]"
      }`}
    >
      <aside className="w-[234px] shrink-0 border-r border-[#E5E7EB] p-3">
        <div className="space-y-1 pt-2">
          <TabButton
            active={tab === "upcoming"}
            count={counts.upcoming}
            label="Upcoming"
            loading={loading}
            onClick={() => setTab("upcoming")}
          />
          <TabButton
            active={tab === "recent"}
            count={counts.recent}
            label="Recent"
            loading={loading}
            onClick={() => setTab("recent")}
          />
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col p-5">
        {loading ? (
          <InterviewsLoadingSkeleton viewMode={viewMode} monthTitle={monthTitle} />
        ) : error ? (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>
        ) : !hasInterviews ? (
          <EmptyState onSchedule={() => setScheduleOpen(true)} />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {viewMode === "calendar" ? (
                  <button
                    type="button"
                    onClick={() => shiftCalendarWeek(-7)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#111827]"
                    aria-label="Previous week"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                ) : null}
                <p className="text-base font-bold text-[#111827]">{monthTitle}</p>
                {viewMode === "calendar" ? (
                  <button
                    type="button"
                    onClick={() => shiftCalendarWeek(7)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#111827]"
                    aria-label="Next week"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-xs text-[#64748B]">
                <span className={viewMode === "calendar" ? "font-medium text-[#111827]" : ""}>
                  Calendar View
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={viewMode === "calendar"}
                  onClick={() => setViewMode((v) => (v === "list" ? "calendar" : "list"))}
                  className={`relative h-5 w-9 rounded-full transition ${
                    viewMode === "calendar"
                      ? "bg-[color:var(--brand-primary,#bc8b41)]"
                      : "bg-[#CBD5E1]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                      viewMode === "calendar" ? "left-0.5" : "left-4"
                    }`}
                  />
                </button>
                <span className={viewMode === "list" ? "font-medium text-[#111827]" : ""}>List View</span>
              </div>
            </div>
            {viewMode === "list" ? (
              <InterviewListView interviews={interviews} />
            ) : (
              <InterviewCalendarView interviews={interviews} anchorDate={anchorDate} />
            )}
          </>
        )}

        {hasInterviews && !loading ? (
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--brand-primary, #bc8b41)" }}
            >
              <Plus className="h-4 w-4" />
              Schedule Interview
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );

  const modals = (
    <>
      <ScheduleInterviewModal
        open={scheduleOpen}
        applicants={modalApplicants}
        submitting={submitting}
        error={scheduleError}
        fixedWorkerId={workerId}
        fixedApplicantName={candidateName}
        onClose={() => {
          setScheduleOpen(false);
          setScheduleError(null);
        }}
        onSubmit={handleSchedule}
      />

      <InterviewSuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        onGoToCalendar={() => {
          setSuccessOpen(false);
          setViewMode("calendar");
          setTab("upcoming");
        }}
      />
    </>
  );

  if (embedded) {
    return (
      <>
        {panel}
        {modals}
      </>
    );
  }

  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-5">
        <h1 className="text-[30px] font-semibold leading-9 text-black">Interviews</h1>
        <p className="mt-1 text-base text-[#374151]">Manage applicant interviews</p>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        {panel}
      </div>

      {modals}
    </main>
  );
}
