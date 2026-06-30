"use client";

import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { WorkerProfilePhotoUpload } from "./WorkerProfilePhotoUpload";
import type { WorkerAccountProfile, WorkerAccountTab } from "./worker-account-types";
import { workerAccountTabHref } from "./worker-account-types";
import { WORKER_BTN_LINK } from "./worker-portal-buttons";
import { WORKER_SCHEDULE_CARD_CLASS } from "./worker-schedule-typography";

function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

function WorkerProfileAvatar({
  displayName,
  photoUrl,
}: {
  displayName: string;
  photoUrl: string | null;
}) {
  return (
    <div className="flex w-[96px] shrink-0 flex-col items-center">
      <div className="flex h-[96px] w-[96px] items-center justify-center overflow-hidden rounded-full bg-[#E5E7EB] text-[28px] font-semibold text-[#4B5563]">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          profileInitials(displayName)
        )}
      </div>
    </div>
  );
}

function statusTone(status: string): string {
  const value = status.trim().toLowerCase();
  if (value === "approved" || value === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-[#E5E7EB] bg-[#F8FAFC] text-[#64748B]";
}

function statusLabel(status: string): string {
  const value = status.trim().toLowerCase();
  if (value === "approved") return "Active";
  if (!value) return "Active";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type WorkerAccountHeaderProps = {
  profile: WorkerAccountProfile;
  loading?: boolean;
  readOnly?: boolean;
  tabHref?: (tab: WorkerAccountTab) => string;
  onProfilePhotoUpdated?: (url: string | null) => void;
};

export function WorkerAccountHeader({
  profile,
  loading = false,
  readOnly = false,
  tabHref = workerAccountTabHref,
  onProfilePhotoUpdated,
}: WorkerAccountHeaderProps) {
  const displayName = loading ? "Loading..." : profile.displayName || "Worker";
  const role = loading ? "—" : profile.jobRole.trim() || "Worker";
  const completionPercent = Math.min(100, Math.max(0, profile.profileCompletionPercent));
  const isComplete = completionPercent >= 100;
  const progressBarColor =
    completionPercent >= 100 ? "#00B546" : completionPercent >= 50 ? "#F59E0B" : "#EF4444";

  return (
    <section className={`${WORKER_SCHEDULE_CARD_CLASS} px-4 py-5 sm:px-6 sm:py-6`}>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch xl:gap-0">
        {/* Profile */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-5 xl:pr-8">
          {readOnly ? (
            <WorkerProfileAvatar displayName={displayName} photoUrl={profile.profilePhotoUrl} />
          ) : (
            <WorkerProfilePhotoUpload
              variant="avatar"
              displayName={displayName}
              photoUrl={profile.profilePhotoUrl}
              onPhotoUpdated={onProfilePhotoUpdated}
            />
          )}
          <div className="min-w-0 w-full flex-1 text-center sm:text-left">
            <h1 className="font-[Inter,sans-serif] text-[20px] font-semibold leading-7 text-[#111827] sm:text-[24px] sm:leading-8">
              {displayName}
            </h1>
            <p className="mt-1 font-[Inter,sans-serif] text-[14px] leading-5 text-[#6B7280]">{role}</p>
            <span
              className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(profile.statusLabel)}`}
            >
              {statusLabel(profile.statusLabel)}
            </span>
            <ul className="mt-5 space-y-3">
              <li className="flex items-center justify-center gap-3 text-sm leading-5 text-[#374151] sm:justify-start">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Mail className="h-4 w-4 text-[#9CA3AF]" aria-hidden />
                </span>
                <span className="min-w-0 break-all sm:truncate">{profile.email || "—"}</span>
              </li>
              <li className="flex items-center justify-center gap-3 text-sm leading-5 text-[#374151] sm:justify-start">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Phone className="h-4 w-4 text-[#9CA3AF]" aria-hidden />
                </span>
                <span className="min-w-0">{profile.phone || "—"}</span>
              </li>
              <li className="flex items-start justify-center gap-3 text-sm leading-5 text-[#374151] sm:justify-start">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center pt-0.5">
                  <MapPin className="h-4 w-4 text-[#9CA3AF]" aria-hidden />
                </span>
                <span className="min-w-0 break-words text-left">{profile.fullAddress}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Employment details */}
        <div className="min-w-0 flex-1 border-t border-[#E5E7EB] pt-6 xl:border-x xl:border-t-0 xl:px-8 xl:pt-0">
          <dl className="space-y-4">
            {[
              ["Employee ID", profile.employeeId],
              ["Hire Date", profile.hireDateLabel],
              ["Employment Type", profile.employmentType],
              ["Department", profile.department],
              [
                "Supervisor",
                profile.supervisorName ? (
                  <span className="text-[#3B82F6]">{profile.supervisorName}</span>
                ) : (
                  "—"
                ),
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="flex flex-col gap-0.5 border-b border-[#F3F4F6] pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <dt className="shrink-0 text-sm text-[#6B7280]">{label}</dt>
                <dd className="text-sm font-medium text-[#111827] sm:text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Profile completion */}
        <div className="flex min-w-0 flex-1 flex-col border-t border-[#E5E7EB] pt-6 xl:border-t-0 xl:pl-8 xl:pt-0">
          <div className="flex h-full flex-col rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4 sm:p-5">
            <p className="text-sm font-semibold text-[#111827]">Profile Completion</p>
            <p className="mt-1 text-sm text-[#6B7280]">
              {isComplete ? "100% Complete" : `${completionPercent}% Complete`}
            </p>
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-[#E5E7EB]"
              role="progressbar"
              aria-valuenow={completionPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Profile completion"
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${completionPercent}%`, backgroundColor: progressBarColor }}
              />
            </div>
            {!readOnly ? (
              <Link href={tabHref("personal")} className={`mt-5 ${WORKER_BTN_LINK}`}>
                {isComplete ? "Update Profile" : "Complete Profile"}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
