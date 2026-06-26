"use client";

import { CandidateListAvatar } from "./CandidateListAvatar";

type MailFolderListRowProps = {
  candidateName: string;
  profilePhotoUrl?: string | null;
  subject: string;
  preview: string;
  timeLabel: string;
  active?: boolean;
  onClick: () => void;
};

export function MailFolderListRow({
  candidateName,
  profilePhotoUrl,
  subject,
  preview,
  timeLabel,
  active = false,
  onClick,
}: MailFolderListRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_6%,white)] ${
        active ? "bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)]" : ""
      }`}
    >
      <CandidateListAvatar name={candidateName} photoUrl={profilePhotoUrl} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="truncate text-sm font-semibold text-[#111827]">{candidateName}</span>
          <span className="shrink-0 text-xs text-[#94A3B8]">{timeLabel}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs font-medium text-[#64748B]">{subject}</span>
        <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6B7280]">{preview}</span>
      </span>
    </button>
  );
}
