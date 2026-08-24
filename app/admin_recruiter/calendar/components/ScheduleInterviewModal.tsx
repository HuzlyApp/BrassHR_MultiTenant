"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatSlotLabel } from "@/lib/interviews/format";
import { COMMON_INTERVIEW_TIMEZONES } from "@/lib/interviews/ics";
import type { InterviewApplicationOption } from "@/app/api/admin/applicant-appointments/applications/route";
import type {
  InterviewMeetingType,
  ScheduleInterviewInterviewer,
  ScheduleInterviewPayload,
} from "@/lib/interviews/schedule-payload";

type ApplicantOption = {
  id: string;
  name: string;
  status: string;
};

type TeamMemberOption = {
  id: string;
  email: string;
  name: string;
};

type ScheduleInterviewModalProps = {
  open: boolean;
  applicants: ApplicantOption[];
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: ScheduleInterviewPayload) => void;
  fixedWorkerId?: string;
  fixedApplicantName?: string;
  fixedJobTitle?: string;
  /** Set when the caller already knows which application the interview belongs to. */
  fixedApplicationId?: string;
  defaultTitle?: string;
};

const SLOT_MINUTES = 30;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 18;

const MEETING_TYPE_OPTIONS: Array<{ value: InterviewMeetingType; label: string }> = [
  { value: "online", label: "Video interview" },
  { value: "phone", label: "Phone interview" },
  { value: "in_person", label: "In-person interview" },
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

function defaultInterviewTitle(applicantName: string): string {
  return applicantName.trim() ? `Interview with ${applicantName.trim()}` : "Interview";
}

export function ScheduleInterviewModal({
  open,
  applicants,
  submitting,
  error,
  onClose,
  onSubmit,
  fixedWorkerId,
  fixedApplicantName,
  fixedJobTitle,
  fixedApplicationId,
  defaultTitle,
}: ScheduleInterviewModalProps) {
  const [workerId, setWorkerId] = useState("");
  const [applications, setApplications] = useState<InterviewApplicationOption[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [jobOpen, setJobOpen] = useState(false);
  const [weekAnchor, setWeekAnchor] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [pendingSlot, setPendingSlot] = useState<{ startsAt: Date; endsAt: Date } | null>(null);
  const [applicantOpen, setApplicantOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingType, setMeetingType] = useState<InterviewMeetingType>("online");
  const [timezone, setTimezone] = useState(() =>
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"
  );
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [candidateNotes, setCandidateNotes] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [selectedInterviewerIds, setSelectedInterviewerIds] = useState<string[]>([]);
  const [titleEdited, setTitleEdited] = useState(false);
  /** Guards the reset below so it runs once per open, never on later field changes. */
  const initializedRef = useRef(false);
  /** Once the recruiter picks an applicant, never auto-select for them again. */
  const applicantTouchedRef = useRef(false);

  const resolvedWorkerId = fixedWorkerId ?? workerId;
  const resolvedApplicantName =
    fixedApplicantName ??
    applicants.find((item) => item.id === resolvedWorkerId)?.name ??
    "Applicant";

  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      applicantTouchedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;

    const today = startOfDay(new Date());
    setWeekAnchor(today);
    setSelectedDay(today);
    setPendingSlot(null);
    setApplicantOpen(false);
    setJobOpen(false);
    setWorkerId(fixedWorkerId ?? applicants[0]?.id ?? "");
    setTitle(defaultTitle ?? "");
    setTitleEdited(Boolean(defaultTitle));
    setMeetingType("online");
    setTimezone(
      typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"
    );
    setMeetingLink("");
    setLocation("");
    setNotes("");
    setCandidateNotes("");
    setSelectedInterviewerIds([]);
  }, [open, applicants, fixedWorkerId, defaultTitle]);

  /** Applicants can load after the modal opens; only fill an untouched, empty selection. */
  useEffect(() => {
    if (!open || fixedWorkerId || workerId || applicantTouchedRef.current) return;
    const firstApplicantId = applicants[0]?.id;
    if (firstApplicantId) setWorkerId(firstApplicantId);
  }, [open, applicants, fixedWorkerId, workerId]);

  /** Load the applicant's open applications so the recruiter can pick the job to interview for. */
  useEffect(() => {
    if (!open || fixedApplicationId) return;
    setApplications([]);
    setApplicationId("");
    if (!resolvedWorkerId) return;

    let cancelled = false;
    setApplicationsLoading(true);
    void fetch(
      `/api/admin/applicant-appointments/applications?workerId=${encodeURIComponent(resolvedWorkerId)}`,
      { credentials: "include" }
    )
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          applications?: InterviewApplicationOption[];
        };
        if (cancelled || !res.ok) return;
        const list = data.applications ?? [];
        setApplications(list);
        setApplicationId(list.length === 1 ? list[0].id : "");
      })
      .finally(() => {
        if (!cancelled) setApplicationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, resolvedWorkerId, fixedApplicationId]);

  /** Keep the title following the chosen applicant until the recruiter types their own. */
  useEffect(() => {
    if (!open || titleEdited) return;
    setTitle(defaultInterviewTitle(resolvedApplicantName));
  }, [open, titleEdited, resolvedApplicantName]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTeamLoading(true);
    void fetch("/api/admin/team-members", { credentials: "include" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          members?: TeamMemberOption[];
        };
        if (!cancelled && res.ok) {
          setTeamMembers(data.members ?? []);
        }
      })
      .finally(() => {
        if (!cancelled) setTeamLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

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

  const selectedInterviewers = useMemo<ScheduleInterviewInterviewer[]>(() => {
    return teamMembers
      .filter((member) => selectedInterviewerIds.includes(member.id))
      .map((member) => ({
        userId: member.id,
        email: member.email,
        name: member.name,
      }));
  }, [selectedInterviewerIds, teamMembers]);

  function toggleInterviewer(id: string) {
    setSelectedInterviewerIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  const showJobPicker = !fixedApplicationId;
  const selectedApplication = applications.find((item) => item.id === applicationId) ?? null;
  const jobSelectionMissing = showJobPicker && applications.length > 1 && !applicationId;
  const canSubmit = Boolean(resolvedWorkerId) && !jobSelectionMissing && !applicationsLoading;

  function handleConfirmSlot() {
    if (!pendingSlot || !canSubmit) return;
    onSubmit({
      workerId: resolvedWorkerId,
      applicationId: fixedApplicationId || applicationId || null,
      jobId: selectedApplication?.jobId ?? null,
      startsAt: pendingSlot.startsAt.toISOString(),
      endsAt: pendingSlot.endsAt.toISOString(),
      timezone,
      title: title.trim() || defaultInterviewTitle(resolvedApplicantName),
      meetingType,
      meetingLink: meetingType === "online" ? meetingLink.trim() || null : null,
      location: meetingType === "in_person" ? location.trim() || null : null,
      notes: notes.trim() || null,
      candidateNotes: candidateNotes.trim() || null,
      interviewers: selectedInterviewers,
    });
  }

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
        className="flex max-h-[92vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl min-[500px]:rounded-[20px]"
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
            <div className="mb-4 rounded-lg border border-[#ECF1F9] bg-[#F8FAFC] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Candidate</p>
              <p className="mt-1 text-sm font-semibold text-[#1F2937]">{resolvedApplicantName}</p>
              {fixedJobTitle ? (
                <p className="mt-1 text-sm text-[#64748B]">{fixedJobTitle}</p>
              ) : null}
            </div>
          ) : (
            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-[#1F2937]">Applicant</span>
              <div className="relative">
                <select
                  value={workerId}
                  onMouseDown={() => setApplicantOpen(true)}
                  onFocus={() => setApplicantOpen(true)}
                  onBlur={() => setApplicantOpen(false)}
                  onChange={(e) => {
                    applicantTouchedRef.current = true;
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

          {showJobPicker ? (
            <div className="mb-4">
              <span className="mb-1.5 block text-sm font-semibold text-[#1F2937]">Job</span>
              {applicationsLoading ? (
                <p className="text-sm text-[#64748B]">Loading applied jobs…</p>
              ) : !resolvedWorkerId ? (
                <p className="text-sm text-[#64748B]">Select an applicant to load their applied jobs.</p>
              ) : applications.length === 0 ? (
                <p className="text-sm text-[#64748B]">
                  This applicant has no open job applications. The interview will be scheduled without a job.
                </p>
              ) : (
                <>
                  <div className="relative">
                    <select
                      value={applicationId}
                      onMouseDown={() => setJobOpen(true)}
                      onFocus={() => setJobOpen(true)}
                      onBlur={() => setJobOpen(false)}
                      onChange={(e) => {
                        setApplicationId(e.target.value);
                        setJobOpen(false);
                      }}
                      className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-[#CBD5E1] bg-white px-3 pr-11 text-sm text-[#1F2937] outline-none focus:border-[color:var(--brand-primary,#bc8b41)]"
                    >
                      {applications.length > 1 ? <option value="">Select job</option> : null}
                      {applications.map((application) => (
                        <option key={application.id} value={application.id}>
                          {application.status
                            ? `${application.jobTitle} (${application.status})`
                            : application.jobTitle}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" aria-hidden>
                      <ChevronDownIcon
                        className={`size-4 text-[#64748B] transition-transform duration-200 ${jobOpen ? "rotate-180" : ""}`}
                      />
                    </span>
                  </div>
                  {jobSelectionMissing ? (
                    <p className="mt-1.5 text-xs text-[#B45309]">
                      This applicant applied to {applications.length} jobs. Select the job this interview is for.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          <div className="mb-4 grid gap-4 min-[500px]:grid-cols-2">
            <label className="block min-[500px]:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-[#1F2937]">Interview title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleEdited(true);
                }}
                className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#1F2937] outline-none focus:border-[color:var(--brand-primary,#bc8b41)]"
                placeholder={defaultInterviewTitle(resolvedApplicantName)}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#1F2937]">Interview type</span>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as InterviewMeetingType)}
                className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#1F2937] outline-none focus:border-[color:var(--brand-primary,#bc8b41)]"
              >
                {MEETING_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#1F2937]">Timezone</span>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#1F2937] outline-none focus:border-[color:var(--brand-primary,#bc8b41)]"
              >
                {!COMMON_INTERVIEW_TIMEZONES.includes(timezone as (typeof COMMON_INTERVIEW_TIMEZONES)[number]) ? (
                  <option value={timezone}>{timezone}</option>
                ) : null}
                {COMMON_INTERVIEW_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-[#1F2937]">Interviewers</span>
            {teamLoading ? (
              <p className="text-sm text-[#64748B]">Loading team members…</p>
            ) : teamMembers.length === 0 ? (
              <p className="text-sm text-[#64748B]">No team members available.</p>
            ) : (
              <div className="max-h-36 space-y-2 overflow-y-auto rounded-lg border border-[#ECF1F9] p-3">
                {teamMembers.map((member) => (
                  <label key={member.id} className="flex cursor-pointer items-center gap-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      checked={selectedInterviewerIds.includes(member.id)}
                      onChange={() => toggleInterviewer(member.id)}
                      className="h-4 w-4 rounded border-[#CBD5E1]"
                    />
                    <span>
                      {member.name}
                      <span className="text-[#64748B]"> · {member.email}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </label>

          {meetingType === "online" ? (
            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-[#1F2937]">Meeting link</span>
              <input
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#1F2937] outline-none focus:border-[color:var(--brand-primary,#bc8b41)]"
                placeholder="https://meet.google.com/..."
              />
            </label>
          ) : meetingType === "in_person" ? (
            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-[#1F2937]">Location</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#1F2937] outline-none focus:border-[color:var(--brand-primary,#bc8b41)]"
                placeholder="Office address or room"
              />
            </label>
          ) : null}

          <div className="mb-4 grid gap-4 min-[500px]:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#1F2937]">Internal notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#1F2937] outline-none focus:border-[color:var(--brand-primary,#bc8b41)]"
                placeholder="Recruiter-only notes"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#1F2937]">Candidate message</span>
              <textarea
                value={candidateNotes}
                onChange={(e) => setCandidateNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#1F2937] outline-none focus:border-[color:var(--brand-primary,#bc8b41)]"
                placeholder="Optional details included in the candidate invitation"
              />
            </label>
          </div>

          <p className="mb-4 text-center text-base font-semibold text-[#4B5563] min-[500px]:text-lg">
            Select date &amp; time
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
            <span>{timezone}</span>
          </div>

          <div className="space-y-2.5 min-[500px]:space-y-3">
            {timeSlots.length === 0 ? (
              <p className="py-4 text-center text-sm text-[#64748B]">No available times for this day.</p>
            ) : (
              timeSlots.map((slot) => {
                const isPending = pendingSlot?.startsAt.getTime() === slot.startsAt.getTime();
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
                        disabled={submitting || !canSubmit}
                        onClick={handleConfirmSlot}
                        className="flex w-full cursor-pointer items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 min-[500px]:flex-1"
                        style={{ backgroundColor: "var(--brand-primary, #bc8b41)" }}
                      >
                        {submitting ? "Scheduling…" : "Schedule interview"}
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
