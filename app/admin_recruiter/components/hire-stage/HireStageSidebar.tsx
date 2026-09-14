"use client";

import { CalendarDays, FolderKanban, Users } from "lucide-react";
import { CandidateListAvatar } from "@/app/admin_recruiter/components/CandidateListAvatar";
import type { HireStageLifecycle } from "@/lib/onboarding/hire-stage-groups";

export type HireStageSidebarProfile = {
  name: string;
  role: string;
  statusLabel: string | null;
  photoUrl: string | null;
  workType: string | null;
  department: string | null;
  location: string | null;
  source: string | null;
  dateApplied: string | null;
};

export function HireStageSidebar({
  lifecycle,
  profile,
  templateName,
  progressPercent,
  progressLabel,
  lastUpdated,
  showProceedToPostHire,
  onProceedToPostHire,
  proceedDisabledReason,
}: {
  lifecycle: HireStageLifecycle;
  profile: HireStageSidebarProfile;
  templateName: string | null;
  progressPercent: number;
  progressLabel: string;
  lastUpdated: string | null;
  showProceedToPostHire?: boolean;
  onProceedToPostHire?: () => void;
  proceedDisabledReason?: string | null;
}) {
  const phaseLabel = lifecycle === "pre_hire" ? "Pre-hire" : "Post-hire";
  const clamped = Math.max(0, Math.min(100, progressPercent));

  return (
    <aside className="flex w-full flex-col gap-4 lg:w-[300px] lg:shrink-0">
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--brand-secondary)]">Candidate Profile</h2>
          <CandidateListAvatar name={profile.name || "NA"} photoUrl={profile.photoUrl} />
        </div>
        <div className="mt-3">
          <p className="text-base font-semibold leading-snug text-[var(--brand-secondary)]">
            {profile.name || "—"}
          </p>
          <p className="mt-0.5 text-xs text-[#64748B]">{profile.role || "—"}</p>
        </div>
        <dl className="mt-4 space-y-2.5 text-xs">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[#64748B]">Work Type</dt>
            <dd>
              {profile.workType ? (
                <span className="inline-flex rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-medium text-[#047857]">
                  {profile.workType}
                </span>
              ) : (
                <span className="text-[#94A3B8]">—</span>
              )}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[#64748B]">Department</dt>
            <dd className="text-right font-medium text-[var(--brand-secondary)]">
              {profile.department || "—"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[#64748B]">Location</dt>
            <dd className="text-right font-medium text-[var(--brand-secondary)]">{profile.location || "—"}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[#64748B]">Source</dt>
            <dd className="text-right font-medium text-[var(--brand-secondary)]">{profile.source || "—"}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[#64748B]">Date Applied</dt>
            <dd className="text-right font-medium text-[var(--brand-secondary)]">
              {profile.dateApplied || "—"}
            </dd>
          </div>
        </dl>
        {profile.statusLabel ? (
          <div className="mt-4">
            <span className="inline-flex rounded-full bg-[#DBEAFE] px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8]">
              {profile.statusLabel}
            </span>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[#64748B]">
              <Users className="h-3.5 w-3.5 text-[color:var(--brand-primary)]" />
              Phase
            </span>
            <span className="font-semibold text-[var(--brand-secondary)]">{phaseLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[#64748B]">
              <FolderKanban className="h-3.5 w-3.5 text-[color:var(--brand-primary)]" />
              Template
            </span>
            <span className="max-w-[160px] truncate text-right font-semibold text-[var(--brand-secondary)]">
              {templateName || "—"}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--brand-secondary)]">{clamped}% Completed</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
            <div
              className="h-full rounded-full bg-[#22C55E] transition-[width] duration-300"
              style={{ width: `${clamped}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[#64748B]">{progressLabel}</p>
          {lastUpdated ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
              <CalendarDays className="h-3 w-3" />
              Last Updated: {lastUpdated}
            </p>
          ) : null}
        </div>
      </section>

      {showProceedToPostHire ? (
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--brand-secondary)]">Ready to move forward?</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-[#64748B]">
            Start the pre-boarding process and prepare everything for new hire needs before day
            one.
          </p>
          <button
            type="button"
            onClick={onProceedToPostHire}
            disabled={Boolean(proceedDisabledReason)}
            title={proceedDisabledReason || undefined}
            className="mt-4 inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            Proceed to Post-hire process →
          </button>
          {proceedDisabledReason ? (
            <p className="mt-2 text-[11px] text-[#B45309]">{proceedDisabledReason}</p>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
}
