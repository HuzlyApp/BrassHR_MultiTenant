"use client";

import type { ReactNode } from "react";
import { Building2, Clock, MapPin } from "lucide-react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";

export function jobOpenStatusBadge(status: string | null | undefined): {
  label: string;
  className: string;
} {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "published" || normalized === "open" || normalized === "active") {
    return { label: "Active", className: "bg-[#DCFCE7] text-[#166534]" };
  }
  if (normalized === "closed") {
    return { label: "Closed", className: "bg-[#FEE2E2] text-[#B91C1C]" };
  }
  if (normalized === "draft") {
    return { label: "Draft", className: "bg-[#F1F5F9] text-[#64748B]" };
  }
  if (normalized === "archived") {
    return { label: "Archived", className: "bg-[#E2E8F0] text-[#475569]" };
  }
  return { label: status?.trim() || "—", className: "bg-[#F1F5F9] text-[#64748B]" };
}

export function formatJobPostedOn(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type ApplicationsJobHeaderCardProps = {
  titleSlot: ReactNode;
  status: string | null | undefined;
  companyName: string;
  jobIdLabel: string;
  postedOn: string;
  jobType: string;
  location: string;
};

export function ApplicationsJobHeaderCard({
  titleSlot,
  status,
  companyName,
  jobIdLabel,
  postedOn,
  jobType,
  location,
}: ApplicationsJobHeaderCardProps) {
  const badge = jobOpenStatusBadge(status);

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-[#E5E7EB] bg-white p-4 sm:flex-row sm:items-start sm:p-5">
      <div
        className="flex size-16 shrink-0 flex-col items-center justify-center gap-2 rounded-xl bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)] p-0.5 aspect-square"
        aria-hidden
      >
        <BrandedSvgIcon
          src="/streamline_nurse-hat.svg"
          className="h-9 w-9"
          color="var(--brand-primary)"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {titleSlot}
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold leading-4 ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        {companyName && companyName !== "—" ? (
          <p className="mt-1.5 inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm leading-5 text-[#64748B]">
            <Building2
              className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand-primary)]"
              aria-hidden
            />
            <span className="truncate">{companyName}</span>
          </p>
        ) : null}

        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-sm leading-5 text-[#64748B]">
          <span className="whitespace-nowrap">
            Job ID: <span className="font-medium text-[#475569]">{jobIdLabel}</span>
          </span>
          <span className="hidden text-[#CBD5E1] sm:inline" aria-hidden>
            |
          </span>
          <span className="whitespace-nowrap">
            Posted on: <span className="font-medium text-[#475569]">{postedOn}</span>
          </span>
          {jobType && jobType !== "—" ? (
            <>
              <span className="hidden text-[#CBD5E1] sm:inline" aria-hidden>
                |
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock
                  className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand-primary)]"
                  aria-hidden
                />
                <span className="font-medium text-[#475569]">{jobType}</span>
              </span>
            </>
          ) : null}
          <span className="hidden text-[#CBD5E1] sm:inline" aria-hidden>
            |
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin
              className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand-primary)]"
              aria-hidden
            />
            <span className="break-words font-medium text-[#475569]">{location}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
