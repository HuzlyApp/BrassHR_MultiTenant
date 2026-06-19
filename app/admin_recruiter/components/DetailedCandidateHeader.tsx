"use client";

import { Mail } from "lucide-react";
import CandidateAvatarIcon from "./CandidateAvatarIcon";

const CANDIDATE_DETAIL_ICON = "/icons/candidate-detail-icon.svg";

type DetailedCandidateHeaderProps = {
  name: string;
  role: string;
  status?: string;
  loading?: boolean;
  profilePhotoUrl?: string | null;
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
  onMessageClick,
  messageDisabled = false,
}: DetailedCandidateHeaderProps) {
  const displayName = loading ? "Loading..." : name.trim() || "Applicant";
  const displayRole = loading ? "—" : role.trim() || "—";
  const displayStatus = status?.trim();

  return (
    <div className="sticky top-0 z-20 mb-4 bg-zinc-50/95 backdrop-blur-sm py-1">
      <div className="mx-auto flex h-[92px] w-full max-w-[1300px] items-center justify-between rounded-md border border-[#D1D5DB] bg-white px-5">
        <div className="flex items-center gap-2">
          <CandidateAvatarIcon photoUrl={profilePhotoUrl} name={displayName} />
          <div>
            <div className="font-[Inter,sans-serif] text-[20px] font-semibold leading-[28px] text-[#111827]">
              {displayName}
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              <img
                src={CANDIDATE_DETAIL_ICON}
                alt=""
                width={14}
                height={14}
                className="h-[14px] w-[14px] shrink-0"
                aria-hidden
              />
              <span className="font-[Inter,sans-serif] text-[10px] font-normal leading-[15px] text-[#4B5563]">
                {displayRole}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {displayStatus ? (
            <span className="inline-flex h-8 items-center justify-center rounded-md border border-[#D1D5DB] bg-white px-3 text-center text-xs font-semibold leading-4 text-[#111827]">
              {displayStatus}
            </span>
          ) : null}
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
        </div>
      </div>
    </div>
  );
}
