"use client";

import { useEffect } from "react";
import { CalendarClock, Eye, X } from "lucide-react";
import type { AdminInterviewItem } from "@/app/api/admin/applicant-appointments/route";
import { formatInterviewDate, formatInterviewTimeRange } from "@/lib/interviews/format";

const MEETING_TYPE_LABEL: Record<AdminInterviewItem["meetingType"], string> = {
  online: "Video interview",
  phone: "Phone interview",
  in_person: "In-person interview",
};

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  const display = value?.trim() || "—";
  return (
    <div className="border-b border-[#F1F5F9] py-3 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-[#64748B]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-[#0F172A]">{display}</dd>
    </div>
  );
}

type InterviewDetailSidebarProps = {
  interview: AdminInterviewItem | null;
  open: boolean;
  onClose: () => void;
  onReschedule: (interview: AdminInterviewItem) => void;
};

export function InterviewDetailSidebar({
  interview,
  open,
  onClose,
  onReschedule,
}: InterviewDetailSidebarProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !interview) return null;

  const canReschedule = interview.status !== "cancelled" && interview.status !== "completed";
  const timeLabel = formatInterviewTimeRange(interview.startsAt, interview.endsAt);
  const dateLabel = formatInterviewDate(interview.startsAt);
  const interviewerNames =
    interview.interviewers.length > 0
      ? interview.interviewers.map((item) => item.name).join(", ")
      : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close interview details"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="interview-detail-title"
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Interview</p>
            <h2
              id="interview-detail-title"
              className="mt-1 break-words text-lg font-semibold text-[#0F172A]"
            >
              {interview.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] text-[#64748B] transition hover:bg-[#F8FAFC]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2">
          <dl>
            <DetailRow label="Applicant" value={interview.applicantName} />
            <DetailRow label="Email" value={interview.applicantEmail} />
            <DetailRow label="Job" value={interview.jobTitle} />
            <DetailRow label="Date" value={dateLabel} />
            <DetailRow label="Time" value={timeLabel} />
            <DetailRow label="Timezone" value={interview.timezone} />
            <DetailRow label="Status" value={interview.status} />
            <DetailRow label="Meeting type" value={MEETING_TYPE_LABEL[interview.meetingType]} />
            <DetailRow
              label={interview.meetingType === "in_person" ? "Location" : "Meeting link"}
              value={
                interview.meetingType === "in_person" ? interview.location : interview.meetingLink
              }
            />
            <DetailRow label="Interviewers" value={interviewerNames} />
            <DetailRow label="Description" value={interview.description} />
            <DetailRow label="Internal notes" value={interview.notes} />
          </dl>
        </div>

        <div className="border-t border-[#E5E7EB] px-5 py-4">
          {canReschedule ? (
            <button
              type="button"
              onClick={() => onReschedule(interview)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
              style={{ backgroundColor: "var(--brand-primary, #bc8b41)" }}
            >
              <CalendarClock className="h-4 w-4" aria-hidden />
              Reschedule
            </button>
          ) : (
            <p className="text-center text-sm text-[#64748B]">
              This interview cannot be rescheduled.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

export function InterviewListActionButtons({
  interview,
  onView,
  onReschedule,
}: {
  interview: AdminInterviewItem;
  onView: (interview: AdminInterviewItem) => void;
  onReschedule: (interview: AdminInterviewItem) => void;
}) {
  const canReschedule = interview.status !== "cancelled" && interview.status !== "completed";

  return (
    <div className="inline-flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => onView(interview)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] text-[#475569] transition hover:bg-[#F8FAFC]"
        aria-label="View interview"
        title="View"
      >
        <Eye className="h-4 w-4" aria-hidden />
      </button>
      {canReschedule ? (
        <button
          type="button"
          onClick={() => onReschedule(interview)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--brand-primary,#bc8b41)] text-[color:var(--brand-primary,#bc8b41)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary,#bc8b41)_8%,white)]"
          aria-label="Reschedule interview"
          title="Reschedule"
        >
          <CalendarClock className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
