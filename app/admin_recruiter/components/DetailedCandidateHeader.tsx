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

const actionBtnBase =
  "inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border bg-white px-1.5 text-center text-[10px] font-semibold leading-4 disabled:cursor-not-allowed disabled:opacity-50 min-[700px]:h-8 min-[700px]:flex-none min-[700px]:gap-1.5 min-[700px]:px-3 min-[700px]:text-xs";

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
      <div className="flex min-h-[72px] w-full min-w-0 flex-col gap-2.5 rounded-md border border-[#D1D5DB] bg-white px-3 py-3 min-[700px]:h-[92px] min-[700px]:flex-row min-[700px]:items-center min-[700px]:justify-between min-[700px]:gap-3 min-[700px]:px-5 min-[700px]:py-0">
        <div className="flex min-w-0 items-center gap-2">
          <CandidateAvatarIcon photoUrl={profilePhotoUrl} name={displayName} />
          <div className="flex min-w-0 flex-1 items-center gap-2 min-[700px]:block">
            <div className="min-w-0 truncate font-[Inter,sans-serif] text-[14px] font-semibold leading-5 text-[#111827] min-[700px]:text-[20px] min-[700px]:leading-[28px]">
              {displayName}
            </div>
            <div className="flex shrink-0 items-center gap-1 min-[700px]:mt-0.5 min-[700px]:items-start">
              <img
                src={CANDIDATE_DETAIL_ICON}
                alt=""
                width={14}
                height={14}
                className="h-[14px] w-[14px] shrink-0 min-[700px]:mt-px"
                aria-hidden
              />
              <span className="max-w-[7rem] truncate font-[Inter,sans-serif] text-[10px] font-normal leading-[15px] text-[#4B5563] min-[700px]:max-w-none min-[700px]:line-clamp-2 min-[700px]:whitespace-normal">
                {displayRole}
              </span>
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 items-stretch gap-1.5 min-[700px]:w-auto min-[700px]:items-center min-[700px]:justify-end min-[700px]:gap-2">
          {displayStatus ? (
            <span className="inline-flex h-8 min-w-0 flex-1 items-center justify-center truncate rounded-md border border-[#D1D5DB] bg-white px-1.5 text-center text-[10px] font-semibold leading-4 text-[#111827] min-[700px]:max-w-none min-[700px]:flex-none min-[700px]:px-3 min-[700px]:text-xs">
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
              className={`${actionBtnBase} border-[#D1D5DB] text-[#374151] hover:bg-[#F8FAFC]`}
            >
              {resending ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <span className="hidden min-[480px]:inline min-[700px]:hidden">Status link</span>
              <span className="hidden min-[700px]:inline">Resend status link</span>
              <span className="min-[480px]:hidden">Link</span>
            </button>
          ) : null}
          {onMessageClick ? (
            <button
              type="button"
              onClick={onMessageClick}
              disabled={messageDisabled || loading}
              className={`${actionBtnBase} border-[color:var(--brand-primary)] text-[color:var(--brand-primary)] hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]`}
            >
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span>Message</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
