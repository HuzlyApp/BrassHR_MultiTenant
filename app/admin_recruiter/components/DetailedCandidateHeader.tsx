"use client";

import { Link2, Loader2, Mail } from "lucide-react";
import CandidateAvatarIcon from "./CandidateAvatarIcon";
import { useResendApplicationStatusLink } from "@/app/admin_recruiter/hooks/useResendApplicationStatusLink";

const CANDIDATE_DETAIL_ICON = "/icons/candidate-detail-icon.svg";

type DetailedCandidateHeaderProps = {
  name: string;
  role: string;
  status?: string;
  loading?: boolean;
  profilePhotoUrl?: string | null;
  workerId?: string | null;
  candidateEmail?: string | null;
  onMessageClick?: () => void;
  messageDisabled?: boolean;
  onResendStatusClick?: () => void;
  resendStatusDisabled?: boolean;
  resendingStatus?: boolean;
};

export default function DetailedCandidateHeader({
  name,
  role,
  status,
  loading = false,
  profilePhotoUrl,
  workerId,
  candidateEmail,
  onMessageClick,
  messageDisabled = false,
  onResendStatusClick,
  resendStatusDisabled,
  resendingStatus,
}: DetailedCandidateHeaderProps) {
  const internalResend = useResendApplicationStatusLink(workerId);
  const showResendStatus = Boolean(workerId?.trim());
  const resendHandler = onResendStatusClick ?? internalResend.resend;
  const resending = resendingStatus ?? internalResend.resending;
  const resendDisabled =
    resendStatusDisabled ??
    (!candidateEmail?.trim() || loading || resending);

  const displayName = loading ? "Loading..." : name.trim() || "Applicant";
  const displayRole = loading ? "—" : role.trim() || "—";
  const displayStatus = status?.trim();

  return (
    <div className="sticky top-0 z-20 mb-4 bg-zinc-50/95 py-1 backdrop-blur-sm">
      <div className="flex min-h-[72px] w-full min-w-0 flex-col gap-2.5 rounded-md border border-[#D1D5DB] bg-white px-3 py-3 sm:h-[92px] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-0">
        <div className="flex min-w-0 items-center gap-2">
          <CandidateAvatarIcon photoUrl={profilePhotoUrl} name={displayName} />
          <div className="min-w-0">
            <div className="truncate font-[Inter,sans-serif] text-base font-semibold leading-6 text-[#111827] sm:text-[20px] sm:leading-[28px]">
              {displayName}
            </div>
            <div className="mt-0.5 flex items-start gap-1">
              <img
                src={CANDIDATE_DETAIL_ICON}
                alt=""
                width={14}
                height={14}
                className="mt-px h-[14px] w-[14px] shrink-0"
                aria-hidden
              />
              <span className="line-clamp-2 font-[Inter,sans-serif] text-[10px] font-normal leading-[15px] text-[#4B5563]">
                {displayRole}
              </span>
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
          {displayStatus ? (
            <span className="inline-flex h-8 max-w-[160px] items-center justify-center truncate rounded-md border border-[#D1D5DB] bg-white px-3 text-center text-[11px] font-semibold leading-4 text-[#111827] sm:max-w-none sm:text-xs">
              {displayStatus}
            </span>
          ) : null}
          {showResendStatus ? (
            <button
              type="button"
              onClick={() => void resendHandler()}
              disabled={resendDisabled}
              title={
                candidateEmail?.trim()
                  ? "Email application status link to applicant"
                  : "Add an email address on the profile to send a status link"
              }
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[#D1D5DB] bg-white px-3 text-center text-[11px] font-semibold leading-4 text-[#374151] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
            >
              {resending ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <span className="hidden sm:inline">Resend status link</span>
              <span className="sm:hidden">Status link</span>
            </button>
          ) : null}
          {onMessageClick ? (
            <button
              type="button"
              onClick={onMessageClick}
              disabled={messageDisabled || loading}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[color:var(--brand-primary)] bg-white px-3 text-center text-[11px] font-semibold leading-4 text-[color:var(--brand-primary)] hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
            >
              <Mail className="h-3.5 w-3.5 shrink-0" />
              Message
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
