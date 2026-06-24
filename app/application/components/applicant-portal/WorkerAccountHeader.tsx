"use client";

import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { WorkerProfilePhotoUpload } from "./WorkerProfilePhotoUpload";
import type { WorkerAccountProfile } from "./worker-account-types";
import { workerAccountTabHref } from "./worker-account-types";
import { WORKER_BTN_LINK } from "./worker-portal-buttons";
import { WORKER_SCHEDULE_CARD_CLASS } from "./worker-schedule-typography";

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
  onProfilePhotoUpdated?: (url: string | null) => void;
};

export function WorkerAccountHeader({
  profile,
  loading = false,
  onProfilePhotoUpdated,
}: WorkerAccountHeaderProps) {
  const displayName = loading ? "Loading..." : profile.displayName || "Worker";
  const role = loading ? "—" : profile.jobRole.trim() || "Worker";

  return (
    <section className={`${WORKER_SCHEDULE_CARD_CLASS} px-6 py-6`}>
      <div className="flex flex-col gap-8 xl:flex-row xl:items-stretch xl:gap-0">
        {/* Profile */}
        <div className="flex min-w-0 flex-1 gap-5 xl:pr-8">
          <WorkerProfilePhotoUpload
            variant="avatar"
            displayName={displayName}
            photoUrl={profile.profilePhotoUrl}
            onPhotoUpdated={onProfilePhotoUpdated}
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-[Inter,sans-serif] text-[24px] font-semibold leading-8 text-[#111827]">
              {displayName}
            </h1>
            <p className="mt-1 font-[Inter,sans-serif] text-[14px] leading-5 text-[#6B7280]">{role}</p>
            <span
              className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(profile.statusLabel)}`}
            >
              {statusLabel(profile.statusLabel)}
            </span>
            <ul className="mt-5 space-y-3">
              <li className="flex items-center gap-3 text-sm leading-5 text-[#374151]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Mail className="h-4 w-4 text-[#9CA3AF]" aria-hidden />
                </span>
                <span className="min-w-0 truncate">{profile.email || "—"}</span>
              </li>
              <li className="flex items-center gap-3 text-sm leading-5 text-[#374151]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Phone className="h-4 w-4 text-[#9CA3AF]" aria-hidden />
                </span>
                <span>{profile.phone || "—"}</span>
              </li>
              <li className="flex items-start gap-3 text-sm leading-5 text-[#374151]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center pt-0.5">
                  <MapPin className="h-4 w-4 text-[#9CA3AF]" aria-hidden />
                </span>
                <span className="min-w-0">{profile.fullAddress}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Employment details */}
        <div className="min-w-0 flex-1 border-[#E5E7EB] xl:border-x xl:px-8">
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
                className="flex items-center justify-between gap-6 border-b border-[#F3F4F6] pb-3 last:border-b-0 last:pb-0"
              >
                <dt className="shrink-0 text-sm text-[#6B7280]">{label}</dt>
                <dd className="text-right text-sm font-medium text-[#111827]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Profile completion */}
        <div className="flex min-w-0 flex-1 flex-col xl:pl-8">
          <div className="flex h-full flex-col rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-5">
            <p className="text-sm font-semibold text-[#111827]">Profile Completion</p>
            <p className="mt-1 text-sm text-[#6B7280]">{profile.profileCompletionPercent}% Complete</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
              <div
                className="h-full rounded-full bg-[#00B546]"
                style={{ width: `${profile.profileCompletionPercent}%` }}
              />
            </div>
            <Link href={workerAccountTabHref("personal")} className={`mt-5 ${WORKER_BTN_LINK}`}>
              Update Profile
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
