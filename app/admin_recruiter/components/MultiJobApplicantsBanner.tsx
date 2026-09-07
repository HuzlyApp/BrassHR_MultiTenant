"use client";

import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";

type MultiJobApplicantsBannerProps = {
  count: number;
  onViewAll?: () => void;
};

export function MultiJobApplicantsBanner({ count, onViewAll }: MultiJobApplicantsBannerProps) {
  if (count <= 0) return null;

  const applicantLabel = count === 1 ? "applicant has" : "applicants have";

  return (
    <div
      className="mt-4 flex w-full flex-col gap-4 rounded-lg border bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      style={{ borderColor: "var(--brand-primary)" }}
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <BrandedSvgIcon
          src="/multi-jobs-icon.svg"
          className="h-8 w-8 shrink-0"
          color="var(--brand-primary)"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-[color:var(--brand-secondary)]">
            {count} {applicantLabel} applied to multiple jobs
          </p>
          <p className="mt-0.5 text-xs leading-4 text-[#64748B]">
            Candidates with 2 or more job applications are highlighted for easy identification.
          </p>
        </div>
      </div>

      {onViewAll ? (
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--brand-primary)] bg-white px-4 text-xs font-semibold leading-4 text-[color:var(--brand-primary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]"
        >
          View All Multi-Job Applicants
        </button>
      ) : null}
    </div>
  );
}
