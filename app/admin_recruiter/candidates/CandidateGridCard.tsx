"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { CandidateListAvatar } from "@/app/admin_recruiter/components/CandidateListAvatar";
import { candidateStatusBadgeClassName } from "./candidate-status-badge";
import { CANDIDATE_CARD_SURFACE_CLASS } from "./candidate-card-surface";
import type { CandidateRow } from "./types";

const BRAND_ICON = "var(--brand-primary)";

export function candidateProfileHref(workerId: string) {
  return `/admin_recruiter/new/profile/${encodeURIComponent(workerId)}`;
}

type CandidateGridCardProps = {
  candidate: CandidateRow;
  formatDateTime: (iso: string | null) => string;
  onMessage?: (candidate: CandidateRow) => void;
  statusBadgeRounded?: "xl" | "sm";
};

export function CandidateGridCard({
  candidate: c,
  formatDateTime,
  onMessage,
  statusBadgeRounded = "xl",
}: CandidateGridCardProps) {
  const profileHref = candidateProfileHref(c.id);
  const statusRoundClass = statusBadgeRounded === "sm" ? "rounded-sm" : "rounded-xl";

  return (
    <div className={`relative cursor-pointer ${CANDIDATE_CARD_SURFACE_CLASS}`}>
      <Link
        href={profileHref}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`View ${c.name || "candidate"} profile`}
      />
      <div className="relative z-10 pointer-events-none">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <CandidateListAvatar name={c.name || "NA"} photoUrl={c.profilePhotoUrl} />
            <div className="min-w-0">
              <div className="truncate text-sm font-normal text-black">{c.name || "Unnamed"}</div>
              <div className="mt-0.5 text-[10px] text-[#6B7280]">RN #{c.reference}</div>
            </div>
          </div>

          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
            {onMessage ? (
              <button
                type="button"
                onClick={() => onMessage(c)}
                disabled={!c.email?.trim() && !c.phone?.trim()}
                className="flex h-6 w-6 items-center justify-center rounded-md text-[#4e6462] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Message candidate"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            ) : null}
            <Link
              href={`/admin_recruiter/new/attachments/${c.id}`}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#4e6462] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]"
              aria-label="View document"
            >
              <BrandedSvgIcon src="/icons/admin-recruiter/save.svg" className="h-4 w-4" color={BRAND_ICON} />
            </Link>
            <Link
              href={profileHref}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#4e6462] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]"
              aria-label="View profile"
            >
              <BrandedSvgIcon src="/icons/admin-recruiter/eye.svg" className="h-4 w-4" color={BRAND_ICON} />
            </Link>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[#6f8380]">
            <BrandedSvgIcon src="/icons/admin-recruiter/calendar.svg" className="h-4 w-4" color={BRAND_ICON} />
            <span>{formatDateTime(c.createdAt)}</span>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold ${statusRoundClass} ${candidateStatusBadgeClassName(c.status)}`}
          >
            {c.status}
          </span>
        </div>

        <div className="mt-3 space-y-1.5 text-[11px] text-[#4f6462]">
          <div className="flex items-start gap-2.5">
            <BrandedSvgIcon
              src="/icons/admin-recruiter/alternate_email.svg"
              className="h-4 w-4"
              color={BRAND_ICON}
            />
            <span className="truncate text-black">{c.email || "—"}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <BrandedSvgIcon src="/icons/admin-recruiter/phone.svg" className="h-4 w-4" color={BRAND_ICON} />
            <span className="truncate text-black">{c.phone || "—"}</span>
          </div>
          <div className="flex items-start gap-2.5">
            <BrandedSvgIcon
              src="/icons/admin-recruiter/location-marker.svg"
              className="h-4 w-4"
              color={BRAND_ICON}
            />
            <span className="leading-snug text-black">{c.address || "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
