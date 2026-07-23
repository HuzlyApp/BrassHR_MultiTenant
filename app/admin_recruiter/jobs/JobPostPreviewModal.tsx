"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import type { CSSProperties } from "react";
import type { JobRequisitionInput } from "@/lib/jobs/types";
import {
  formatPaySummary,
  JOB_FORM_OUTLINE_BUTTON_CLASS,
  JOB_FORM_PRIMARY_BUTTON_CLASS,
  type JobFormUiState,
} from "./job-form-shared";
import { JobDescriptionHtml } from "./JobDescriptionEditor";

const JOB_POST_PREVIEW_ICON_SRC = "/job-post-preview-icon.svg";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobRequisitionInput;
  ui: JobFormUiState;
  companyName: string;
  brandStyle: CSSProperties;
  brandVars?: CSSProperties;
};

export function JobPostPreviewModal({
  open,
  onOpenChange,
  job,
  ui,
  companyName,
  brandStyle,
  brandVars,
}: Props) {
  const title = job.publicTitle?.trim() || "Untitled job";
  const location = job.location?.trim() || "Location not set";
  const description = job.publicDescription?.trim() || "";
  const compensationLabel = [ui.compensationType, ui.currency].filter(Boolean).join(", ");
  const paySummary = formatPaySummary(job, ui);
  const showCompensation = Boolean(compensationLabel || (paySummary !== "—" && paySummary));
  const isMsp = job.sourceType === "MSP";
  const mspPay =
    job.suggestedPayRate != null
      ? `$${job.suggestedPayRate}${ui.compensationType ? ` ${ui.compensationType}` : ""}`
      : "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[201] flex max-h-[92dvh] w-[min(720px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl outline-none"
          style={brandVars}
        >
          <div className="relative flex items-start gap-3 px-5 pb-3 pt-5 pr-14">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)]">
              <img
                src={JOB_POST_PREVIEW_ICON_SRC}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6"
                aria-hidden
              />
            </span>
            <div className="min-w-0 pt-0.5">
              <Dialog.Title className="text-lg font-semibold text-[#1D2739]">
                Job post preview
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-[#64748B]">
                The live post people view may look slightly different.
              </Dialog.Description>
            </div>
            <Dialog.Close
              type="button"
              className="absolute right-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#1D2739] text-white transition hover:opacity-90"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-1">
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <div className="flex flex-col gap-4 border-b border-[#E5E7EB] pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-[#1D2739]">{title}</h3>
                  <p className="mt-1 text-sm font-medium text-[#334155]">{companyName}</p>
                  <p className="mt-0.5 text-sm text-[#64748B]">{location}</p>
                </div>
                <button
                  type="button"
                  className={`${JOB_FORM_PRIMARY_BUTTON_CLASS} shrink-0 px-5`}
                  style={brandStyle}
                >
                  Apply Now
                </button>
              </div>

              {isMsp && (mspPay || job.billRate != null) ? (
                <div className="mt-4 grid gap-4 border-b border-[#E5E7EB] pb-4 sm:grid-cols-2">
                  {job.billRate != null ? (
                    <div>
                      <p className="text-sm font-medium text-[#64748B]">Bill Rate</p>
                      <p className="mt-1 text-sm text-[#1D2739]">${job.billRate}</p>
                    </div>
                  ) : null}
                  {mspPay ? (
                    <div className={job.billRate != null ? "sm:border-l sm:border-[#E5E7EB] sm:pl-4" : ""}>
                      <p className="text-sm font-medium text-[#64748B]">Pay Rate</p>
                      <p className="mt-1 text-sm text-[#1D2739]">{mspPay}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!isMsp && showCompensation ? (
                <div className="mt-4 grid gap-4 border-b border-[#E5E7EB] pb-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-[#64748B]">Compensation</p>
                    <p className="mt-1 text-sm text-[#1D2739]">
                      {compensationLabel || "—"}
                    </p>
                  </div>
                  <div className="sm:border-l sm:border-[#E5E7EB] sm:pl-4">
                    <p className="text-sm font-medium text-[#64748B]">
                      {ui.showPayBy ? `${ui.showPayBy}:` : "Range:"}
                    </p>
                    <p className="mt-1 text-sm text-[#1D2739]">
                      {paySummary !== "—" ? paySummary : "—"}
                    </p>
                  </div>
                </div>
              ) : null}

              {ui.selectedBenefits.length ? (
                <div className="mt-4 border-b border-[#E5E7EB] pb-4">
                  <p className="text-sm font-medium text-[#64748B]">Benefits</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ui.selectedBenefits.map((benefit) => (
                      <span
                        key={benefit}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#CBD5E1] bg-white px-3 py-1.5 text-sm text-[#334155]"
                      >
                        <Check className="h-3.5 w-3.5 text-[color:var(--brand-primary)]" />
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 max-h-[280px] overflow-y-auto pr-1">
                <JobDescriptionHtml
                  html={description}
                  className="mt-0"
                  emptyLabel="No description added yet."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center px-5 py-5">
            <Dialog.Close type="button" className={`${JOB_FORM_OUTLINE_BUTTON_CLASS} px-6`}>
              Close Preview
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
