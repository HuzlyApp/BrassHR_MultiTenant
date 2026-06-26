"use client";

import { Loader2 } from "lucide-react";
import BrandedDeleteIcon from "./BrandedDeleteIcon";
import { CandidateListAvatar } from "./CandidateListAvatar";

const deleteButtonClass =
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md p-1 transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_10%,white)] disabled:cursor-not-allowed disabled:opacity-40";

type MailDraftListRowProps = {
  candidateName: string;
  profilePhotoUrl?: string | null;
  subject: string;
  preview: string;
  timeLabel: string;
  deleting?: boolean;
  onOpen: () => void;
  onDelete: () => void;
};

export function MailDraftListRow({
  candidateName,
  profilePhotoUrl,
  subject,
  preview,
  timeLabel,
  deleting = false,
  onOpen,
  onDelete,
}: MailDraftListRowProps) {
  return (
    <div className="flex items-stretch border-b border-[#E5E7EB] last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        disabled={deleting}
        className="flex min-w-0 flex-1 items-start gap-3 px-5 py-4 text-left transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_6%,white)] disabled:opacity-60"
      >
        <CandidateListAvatar name={candidateName} photoUrl={profilePhotoUrl} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="truncate text-sm font-semibold text-[#111827]">{candidateName}</span>
            <span className="shrink-0 text-xs text-[#94A3B8]">{timeLabel}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-[#64748B]">
            {subject.trim() || "No subject"}
          </span>
          <span className="mt-1 line-clamp-2 text-xs text-[#6B7280]">
            {preview.trim() || "No message yet"}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center px-3 sm:px-4">
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className={`${deleteButtonClass} h-10 w-10`}
          aria-label={`Delete draft for ${candidateName}`}
          title="Delete draft"
        >
          {deleting ? (
            <Loader2 className="h-5 w-5 animate-spin text-(--brand-primary)" />
          ) : (
            <BrandedDeleteIcon className="h-6 w-6" />
          )}
        </button>
      </div>
    </div>
  );
}
