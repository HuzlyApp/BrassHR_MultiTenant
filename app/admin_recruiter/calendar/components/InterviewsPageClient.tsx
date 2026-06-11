"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { AdminInterviewItem } from "@/app/api/admin/applicant-appointments/route";
import { formatInterviewDate, formatInterviewTimeRange } from "@/lib/interviews/format";
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
];

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
  return date.toISOString().slice(0, 10);
}

function TabButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3.5 py-2 text-left text-sm transition ${
        active
          ? "border border-[color:var(--brand-primary,#bc8b41)] text-[color:var(--brand-primary,#bc8b41)]"
          : "text-[#1F2937] hover:bg-[#F8FAFC]"
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold ${
          active
            ? "bg-[color:var(--brand-primary,#bc8b41)] text-white"
            : "bg-[#F4F4F4] text-[color:var(--brand-primary,#bc8b41)]"
        }`}
      >
        {count}
      </span>
      {label}
    </button>
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
  const todayKey = formatDateKey(new Date());
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const eventsByDay = useMemo(() => {
    const map = new Map<string, AdminInterviewItem[]>();
    interviews.forEach((item) => {
      const key = formatDateKey(new Date(item.startsAt));
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    });
    return map;
  }, [interviews]);

  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
      <div className="grid grid-cols-7 border-b border-[#E5E7EB] bg-white">
        {weekDays.map((day) => {
          const key = formatDateKey(day);
          const isToday = key === todayKey;
          const count = eventsByDay.get(key)?.length ?? 0;
          return (
            <div
              key={key}
              className={`border-r border-[#E5E7EB] px-2 py-3 text-center last:border-r-0 ${
                isToday ? "border-b-2 border-b-[color:var(--brand-primary,#bc8b41)]" : ""
              }`}
            >
              <p className="text-[10px] uppercase text-[#64748B]">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </p>
              <p
                className={`mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isToday ? "bg-[color:var(--brand-primary,#bc8b41)] text-white" : "text-[#1F2937]"
                }`}
              >
                {day.getDate()}
              </p>
              {count > 0 ? (
                <p className="mt-1 text-[10px] font-semibold text-[#D97706]">{count}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="relative max-h-[560px] overflow-y-auto">
        {HOUR_LABELS.map((label, index) => {
          const hour = index < 4 ? 8 + index : index === 4 ? 12 : index - 3 + 12;
          const rowMinutes = hour * 60;
          const showNowLine =
            weekDays.some((day) => formatDateKey(day) === todayKey) &&
            Math.abs(nowMinutes - rowMinutes) < 30;

          return (
            <div
              key={label}
              className="relative grid min-h-[56px] border-b border-[#E5E7EB]"
              style={{ gridTemplateColumns: "93px repeat(7, minmax(0, 1fr))" }}
            >
              <div className="border-r border-[#E5E7EB] px-3 py-4 text-right text-[10px] text-[#64748B]">
                {label}
              </div>
              {weekDays.map((day) => {
                const key = formatDateKey(day);
                const dayEvents = (eventsByDay.get(key) ?? []).filter((event) => {
                  const start = new Date(event.startsAt);
                  return start.getHours() === hour;
                });
                return (
                  <div key={`${label}-${key}`} className="relative border-r border-[#E5E7EB] p-1 last:border-r-0">
                    {showNowLine && key === todayKey ? (
                      <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 flex items-center">
                        <div className="h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-[color:var(--brand-primary,#bc8b41)]" />
                        <div className="h-px flex-1 bg-[color:var(--brand-primary,#bc8b41)]" />
                      </div>
                    ) : null}
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        className="mb-1 rounded border border-[#E2E8F0] border-r-4 border-r-[#012352] bg-[#F8FAFC] px-2 py-1.5"
                      >
                        <p className="truncate text-[11px] font-semibold text-[#1F2937]">{event.title}</p>
                        <p className="truncate text-[10px] text-[#64748B]">{event.applicantName}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function InterviewsPageClient() {
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
  const [anchorDate] = useState(() => new Date());

  const loadInterviews = useCallback(async (activeTab: TabId) => {
    setLoading(true);
    setError(null);
    try {
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
  }, []);

  useEffect(() => {
    void loadInterviews(tab);
  }, [tab, loadInterviews]);

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

  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-5">
        <h1 className="text-[30px] font-semibold leading-9 text-black">Interviews</h1>
        <p className="mt-1 text-base text-[#374151]">Manage applicant interviews</p>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        <div className="flex min-h-[640px] overflow-hidden rounded-xl border border-[#E5E7EB]">
          <aside className="w-[234px] shrink-0 border-r border-[#E5E7EB] p-3">
            <div className="space-y-1 pt-2">
              <TabButton
                active={tab === "upcoming"}
                count={counts.upcoming}
                label="Upcoming"
                onClick={() => setTab("upcoming")}
              />
              <TabButton
                active={tab === "recent"}
                count={counts.recent}
                label="Recent"
                onClick={() => setTab("recent")}
              />
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col p-5">
            {hasInterviews ? (
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#1F2937]">{monthTitle}</p>
                <div className="flex items-center gap-2 text-xs text-[#64748B]">
                  <span className={viewMode === "calendar" ? "text-[#1F2937]" : ""}>Calendar View</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={viewMode === "list"}
                    onClick={() => setViewMode((v) => (v === "list" ? "calendar" : "list"))}
                    className={`relative h-5 w-8 rounded-full transition ${
                      viewMode === "list" ? "bg-[color:var(--brand-primary,#bc8b41)]" : "bg-[#CBD5E1]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                        viewMode === "list" ? "left-3.5" : "left-0.5"
                      }`}
                    />
                  </button>
                  <span className={viewMode === "list" ? "text-[#1F2937]" : ""}>List View</span>
                </div>
              </div>
            ) : null}

            {loading ? (
              <p className="py-16 text-center text-sm text-[#64748B]">Loading interviews…</p>
            ) : error ? (
              <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>
            ) : !hasInterviews ? (
              <EmptyState onSchedule={() => setScheduleOpen(true)} />
            ) : viewMode === "list" ? (
              <InterviewListView interviews={interviews} />
            ) : (
              <InterviewCalendarView interviews={interviews} anchorDate={anchorDate} />
            )}

            {hasInterviews ? (
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
      </div>

      <ScheduleInterviewModal
        open={scheduleOpen}
        applicants={applicants}
        submitting={submitting}
        error={scheduleError}
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
    </main>
  );
}
