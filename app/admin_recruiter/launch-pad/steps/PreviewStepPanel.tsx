"use client";

import { useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { withTenant } from "@/lib/tenant/with-tenant";
import { interStyle } from "../constants";
import { LaunchPadStepActions } from "../LaunchPadStepHeader";

export function PreviewStepPanel({
  onBack,
  onSkip,
  onComplete,
}: {
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const searchParams = useSearchParams();
  const { organization } = useAccountData();
  const tenantParam = searchParams.get("tenant") || organization?.subdomain || organization?.id || null;
  const jobsHref = withTenant("/jobs", tenantParam);
  const companyLabel = organization?.name?.trim() || "Your company";

  return (
    <div className="flex w-full justify-center py-8">
      <div className="w-full max-w-[1104px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[18px] font-semibold leading-7 text-black" style={interStyle}>
                Applicant Preview
              </h2>
              <p className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
                Live preview of your public apply portal with current branding.
              </p>
            </div>
            <a
              href={jobsHref}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--brand-secondary,#012352)] px-3 text-[13px] font-semibold text-[color:var(--brand-secondary,#012352)] sm:mt-0"
              style={interStyle}
            >
              Open full job board
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#FAFAFA]">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-white px-4 py-2.5">
              <p className="truncate text-[13px] font-semibold text-[#0F172A]" style={interStyle}>
                {companyLabel} · Open Positions
              </p>
              <span className="text-[11px] text-[#6B7280]" style={interStyle}>
                Live apply portal
              </span>
            </div>
            <iframe
              title="Public apply page preview"
              src={jobsHref}
              className="h-[min(620px,70vh)] w-full border-0 bg-white"
            />
          </div>
        </div>

        <div className="border-t border-[#E5E7EB]">
          <LaunchPadStepActions
            onSkip={onSkip}
            onBack={onBack}
            onContinue={onComplete}
            continueLabel="Mark as Done"
          />
        </div>
      </div>
    </div>
  );
}
