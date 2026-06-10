"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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
}: ScheduleInterviewModalProps) {
  const [workerId, setWorkerId] = useState("");
  const [weekAnchor, setWeekAnchor] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [pendingSlot, setPendingSlot] = useState<{ startsAt: Date; endsAt: Date } | null>(null);

  useEffect(() => {
    if (!open) return;
    const today = startOfDay(new Date());
    setWeekAnchor(today);
    setSelectedDay(today);
    setPendingSlot(null);
    setWorkerId(applicants[0]?.id ?? "");
  }, [open, applicants]);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-interview-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[620px] flex-col overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ECF1F9] px-6 pb-2 pt-5">
          <h2 id="schedule-interview-title" className="text-2xl font-semibold text-[#1F2937]">
            Schedule Interview
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-black text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <label className="mb-5 block">
            <span className="mb-1.5 block text-sm font-semibold text-[#1F2937]">Applicant</span>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2.5 text-sm text-[#1F2937]"
            >
              <option value="">Select applicant</option>
              {applicants.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.status})
                </option>
              ))}
            </select>
          </label>

          <p className="mb-5 text-center text-lg font-semibold text-[#4B5563]">Select Date &amp; Time</p>

          <div className="mb-5">
            <p className="mb-3 text-center text-base font-semibold text-[#1F2937]">{monthLabel}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setWeekAnchor((d) => addDays(d, -7))}
                className="rounded p-1 text-[#64748B] hover:bg-[#F8FAFC]"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex gap-4 sm:gap-6">
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
                      className="flex flex-col items-center gap-2 disabled:opacity-40"
                    >
                      <span className={`text-sm ${isPast ? "text-[#94A3B8]" : "text-[#1F2937]"}`}>
                        {WEEKDAY_LABELS[day.getDay()]}
                      </span>
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${
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
                className="rounded p-1 text-[#64748B] hover:bg-[#F8FAFC]"
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-[#ECF1F9] px-4 py-3 text-sm text-[#475569]">
            <span>{timezoneLabel}</span>
          </div>

          <div className="space-y-3">
            {timeSlots.length === 0 ? (
              <p className="py-4 text-center text-sm text-[#64748B]">No available times for this day.</p>
            ) : (
              timeSlots.map((slot) => {
                const isPending =
                  pendingSlot?.startsAt.getTime() === slot.startsAt.getTime();
                const label = formatSlotLabel(slot.startsAt.toISOString(), slot.endsAt.toISOString());

                if (isPending) {
                  return (
                    <div key={slot.startsAt.toISOString()} className="flex gap-4">
                      <div className="flex flex-1 items-center justify-center rounded-lg border border-[color:var(--brand-primary,#bc8b41)] px-4 py-3 text-sm font-semibold text-[color:var(--brand-primary,#bc8b41)]">
                        {slot.startsAt.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </div>
                      <button
                        type="button"
                        disabled={submitting || !workerId}
                        onClick={() =>
                          onSubmit({
                            workerId,
                            startsAt: slot.startsAt.toISOString(),
                            endsAt: slot.endsAt.toISOString(),
                            meetingType: "online",
                          })
                        }
                        className="flex flex-1 items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
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
                    className="flex w-full items-center justify-center rounded-lg border border-[#ECF1F9] px-4 py-4 text-sm text-[#374151] transition hover:border-[color:var(--brand-primary,#bc8b41)]"
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
