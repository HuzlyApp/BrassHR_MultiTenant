"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatSlotLabel } from "@/lib/interviews/format";

type ApplicantOption = {
  id: string;
  name: string;
  status: string;
};

type ScheduleInterviewModalProps = {
  open: boolean;
  applicants: ApplicantOption[];
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    workerId: string;
    startsAt: string;
    endsAt: string;
    meetingType: "online";
  }) => void;
  /** When set, hides applicant dropdown and schedules for this worker only. */
  fixedWorkerId?: string;
  fixedApplicantName?: string;
};

const SLOT_MINUTES = 30;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 18;

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

function buildDaySlots(day: Date): { startsAt: Date; endsAt: Date }[] {
  const slots: { startsAt: Date; endsAt: Date }[] = [];
  const base = startOfDay(day);
  for (let hour = DAY_START_HOUR; hour < DAY_END_HOUR; hour++) {
    for (const minute of [0, 30]) {
      const startsAt = new Date(base);
      startsAt.setHours(hour, minute, 0, 0);
      const endsAt = new Date(startsAt.getTime() + SLOT_MINUTES * 60 * 1000);
      if (startsAt.getTime() > Date.now()) slots.push({ startsAt, endsAt });
    }
  }
  return slots;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ScheduleInterviewModal({
  open,
  applicants,
  submitting,
  error,
  onClose,
  onSubmit,
  fixedWorkerId,
  fixedApplicantName,
}: ScheduleInterviewModalProps) {
  const [workerId, setWorkerId] = useState("");
  const [weekAnchor, setWeekAnchor] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [pendingSlot, setPendingSlot] = useState<{ startsAt: Date; endsAt: Date } | null>(null);
  const [applicantOpen, setApplicantOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = startOfDay(new Date());
    setWeekAnchor(today);
    setSelectedDay(today);
    setPendingSlot(null);
    setApplicantOpen(false);
    setWorkerId(fixedWorkerId ?? applicants[0]?.id ?? "");
  }, [open, applicants, fixedWorkerId]);

  const resolvedWorkerId = fixedWorkerId ?? workerId;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const weekDays = useMemo(() => {
    const start = getWeekStart(weekAnchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekAnchor]);

  const timeSlots = useMemo(() => buildDaySlots(selectedDay), [selectedDay]);
  const monthLabel = selectedDay.toLocaleDateString("en-US", { month: "long" });
  const timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 min-[500px]:px-4 min-[500px]:py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-interview-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl min-[500px]:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ECF1F9] px-4 pb-2 pt-4 min-[500px]:px-6 min-[500px]:pt-5">
          <h2 id="schedule-interview-title" className="text-xl font-semibold text-[#1F2937] min-[500px]:text-2xl">
            Schedule Interview
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#E5E7EB] bg-black text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 min-[500px]:px-5 min-[500px]:py-5">
          {fixedWorkerId ? (
            <div className="mb-5 rounded-lg border border-[#ECF1F9] bg-[#F8FAFC] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Applicant</p>
              <p className="mt-1 text-sm font-semibold text-[#1F2937]">{fixedApplicantName ?? "Applicant"}</p>
            </div>
          ) : (
            <label className="mb-5 block">
              <span className="mb-1.5 block text-sm font-semibold text-[#1F2937]">Applicant</span>
              <div className="relative">
                <select
                  value={workerId}
                  onMouseDown={() => setApplicantOpen(true)}
                  onFocus={() => setApplicantOpen(true)}
                  onBlur={() => setApplicantOpen(false)}
                  onChange={(e) => {
                    setWorkerId(e.target.value);
                    setApplicantOpen(false);
                  }}
                  className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-[#CBD5E1] bg-white px-3 pr-11 text-sm text-[#1F2937] outline-none focus:border-[color:var(--brand-primary,#bc8b41)]"
                >
                  <option value="">Select applicant</option>
                  {applicants.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.status})
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" aria-hidden>
                  <ChevronDownIcon
                    className={`size-4 text-[#64748B] transition-transform duration-200 ${applicantOpen ? "rotate-180" : ""}`}
                  />
                </span>
              </div>
            </label>
          )}

          <p className="mb-4 text-center text-base font-semibold text-[#4B5563] min-[500px]:mb-5 min-[500px]:text-lg">
            Select Date &amp; Time
          </p>

          <div className="mb-4 min-[500px]:mb-5">
            <p className="mb-3 text-center text-sm font-semibold text-[#1F2937] min-[500px]:text-base">{monthLabel}</p>
            <div className="flex items-center gap-1 min-[500px]:gap-3">
              <button
                type="button"
                onClick={() => setWeekAnchor((d) => addDays(d, -7))}
                className="shrink-0 cursor-pointer rounded p-1 text-[#64748B] hover:bg-[#F8FAFC]"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden min-[500px]:justify-center min-[500px]:gap-4 sm:gap-6">
                {weekDays.map((day) => {
                  const isSelected = startOfDay(day).getTime() === startOfDay(selectedDay).getTime();
                  const isPast = startOfDay(day).getTime() < startOfDay(new Date()).getTime();
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={isPast}
                      onClick={() => {
                        setSelectedDay(startOfDay(day));
                        setPendingSlot(null);
                      }}
                      className="flex min-w-[44px] shrink-0 cursor-pointer flex-col items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40 min-[500px]:gap-2"
                    >
                      <span className={`text-xs min-[500px]:text-sm ${isPast ? "text-[#94A3B8]" : "text-[#1F2937]"}`}>
                        {WEEKDAY_LABELS[day.getDay()]}
                      </span>
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm min-[500px]:h-9 min-[500px]:w-9 ${
                          isSelected
                            ? "bg-[color:var(--brand-primary,#bc8b41)] text-white"
                            : "text-[#0F172A]"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setWeekAnchor((d) => addDays(d, 7))}
                className="shrink-0 cursor-pointer rounded p-1 text-[#64748B] hover:bg-[#F8FAFC]"
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-[#ECF1F9] px-3 py-2.5 text-xs text-[#475569] min-[500px]:px-4 min-[500px]:py-3 min-[500px]:text-sm">
            <span>{timezoneLabel}</span>
          </div>

          <div className="space-y-2.5 min-[500px]:space-y-3">
            {timeSlots.length === 0 ? (
              <p className="py-4 text-center text-sm text-[#64748B]">No available times for this day.</p>
            ) : (
              timeSlots.map((slot) => {
                const isPending =
                  pendingSlot?.startsAt.getTime() === slot.startsAt.getTime();
                const label = formatSlotLabel(slot.startsAt.toISOString(), slot.endsAt.toISOString());

                if (isPending) {
                  return (
                    <div key={slot.startsAt.toISOString()} className="flex flex-col gap-2 min-[500px]:flex-row min-[500px]:gap-4">
                      <div className="flex flex-1 items-center justify-center rounded-lg border border-[color:var(--brand-primary,#bc8b41)] px-4 py-3 text-sm font-semibold text-[color:var(--brand-primary,#bc8b41)]">
                        {slot.startsAt.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </div>
                      <button
                        type="button"
                        disabled={submitting || !resolvedWorkerId}
                        onClick={() =>
                          onSubmit({
                            workerId: resolvedWorkerId,
                            startsAt: slot.startsAt.toISOString(),
                            endsAt: slot.endsAt.toISOString(),
                            meetingType: "online",
                          })
                        }
                        className="flex w-full cursor-pointer items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 min-[500px]:flex-1"
                        style={{ backgroundColor: "var(--brand-primary, #bc8b41)" }}
                      >
                        {submitting ? "Scheduling…" : "Confirm"}
                      </button>
                    </div>
                  );
                }

                return (
                  <button
                    key={slot.startsAt.toISOString()}
                    type="button"
                    onClick={() => setPendingSlot(slot)}
                    className="flex w-full cursor-pointer items-center justify-center rounded-lg border border-[#ECF1F9] px-4 py-3.5 text-sm text-[#374151] transition hover:border-[color:var(--brand-primary,#bc8b41)] min-[500px]:py-4"
                  >
                    {label}
                  </button>
                );
              })
            )}
          </div>

          {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
