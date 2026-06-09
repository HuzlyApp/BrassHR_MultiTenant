"use client";

import { Mail, MoreVertical, RefreshCw } from "lucide-react";
import CandidateAvatarIcon from "./CandidateAvatarIcon";

type DetailedCandidateHeaderProps = {
  name: string;
  role: string;
  loading?: boolean;
  onMessageClick?: () => void;
  messageDisabled?: boolean;
  onResendStatusClick?: () => void;
  resendStatusDisabled?: boolean;
  resendingStatus?: boolean;
};

export default function DetailedCandidateHeader({
  name,
  role,
  loading = false,
  onMessageClick,
  messageDisabled = false,
  onResendStatusClick,
  resendStatusDisabled = false,
  resendingStatus = false,
}: DetailedCandidateHeaderProps) {
  const displayName = loading ? "Loading..." : name.trim() || "Applicant";
  const displayRole = loading ? "—" : role.trim() || "—";

  return (
    <div className="sticky top-0 z-20 mb-4 bg-zinc-50/95 backdrop-blur-sm py-1">
      <div className="mx-auto flex h-[92px] w-full max-w-[1300px] items-center justify-between rounded-md border border-[#D1D5DB] bg-white px-5">
        <div className="flex items-center gap-3">
          <CandidateAvatarIcon />
          <div>
            <div className="text-base font-semibold leading-6 text-[color:var(--brand-primary)]">
              {displayName}
            </div>
            <div className="mt-0.5 text-xs font-normal leading-4 text-[#4B5563]">
              {displayRole}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onMessageClick ? (
            <button
              type="button"
              onClick={onMessageClick}
              disabled={messageDisabled || loading}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[color:var(--brand-primary)] bg-white px-3 text-center text-xs font-semibold leading-4 text-[color:var(--brand-primary)] hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mail className="h-3.5 w-3.5" />
              Message
            </button>
          ) : null}
          {onResendStatusClick ? (
            <button
              type="button"
              onClick={onResendStatusClick}
              disabled={resendStatusDisabled || resendingStatus || loading}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] px-3 text-center text-xs font-semibold leading-4 text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${resendingStatus ? "animate-spin" : ""}`} />
              {resendingStatus ? "Sending..." : "Resend Status"}
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-md border border-[#D1D5DB] bg-white px-3 text-center text-xs font-semibold leading-4 text-[#111827] hover:bg-[#F9FAFB]"
          >
            New Applicant
          </button>
          <button
            type="button"
            aria-label="More options"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-[#6B7280] hover:bg-[#F3F4F6]"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
