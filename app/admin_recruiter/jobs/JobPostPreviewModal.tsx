"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import type { JobRequisitionInput } from "@/lib/jobs/types";
import { boldJobDescriptionSectionTitles, sanitizeJobDescriptionHtml } from "@/lib/jobs/generate-job-description/sanitize-html";
import {
  ensureJobDescriptionBulletLists,
  stripJobDescriptionBenefitsSection,
} from "@/lib/jobs/job-description-html";
import {
  formatPaySummary,
  JOB_FORM_OUTLINE_BUTTON_CLASS,
  JOB_FORM_PRIMARY_BUTTON_CLASS,
  type JobFormUiState,
} from "./job-form-shared";
import {
  JOB_POSTING_DESCRIPTION_CSS,
  JOB_POSTING_FIELD_LABEL_CLASS,
  JOB_POSTING_FIELD_VALUE_CLASS,
  JOB_POSTING_METADATA_CLASS,
  JOB_POSTING_PAGE_TITLE_CLASS,
} from "./job-posting-typography";
import { JobDescriptionHtml } from "./JobDescriptionEditor";
import { JobPostPreviewIcon } from "./JobPostPreviewIcon";

function formatPreviewDescriptionHtml(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return ensureJobDescriptionBulletLists(
    boldJobDescriptionSectionTitles(
      stripJobDescriptionBenefitsSection(sanitizeJobDescriptionHtml(trimmed))
    )
  );
}

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
  const isMsp = job.sourceType === "MSP";
  const title =
    (isMsp
      ? job.sourceJobTitle?.trim() || job.publicTitle?.trim()
      : job.publicTitle?.trim()) || "Untitled job";
  const location = job.location?.trim() || "Location not set";
  const locationType = ui.jobLocationType?.trim() || "";
  const locationLine = [locationType, location].filter(Boolean).join(" · ");
  const descriptionHtml = useMemo(
    () => formatPreviewDescriptionHtml(job.publicDescription ?? ""),
    [job.publicDescription]
  );
  const compensationLabel = [ui.compensationType, ui.currency].filter(Boolean).join(", ");
  const paySummary = formatPaySummary(job, ui);
  const showCompensation = Boolean(compensationLabel || (paySummary !== "—" && paySummary));
  const mspPay =
    job.suggestedPayRate != null
      ? `$${job.suggestedPayRate}${ui.compensationType ? ` ${ui.compensationType}` : ""}`
      : "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/40" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-[201] flex max-h-[min(92dvh,100dvh)] w-full flex-col overflow-hidden rounded-t-2xl border border-[#E5E7EB] bg-white shadow-xl outline-none min-[700px]:inset-x-auto min-[700px]:bottom-auto min-[700px]:left-1/2 min-[700px]:top-1/2 min-[700px]:max-h-[92dvh] min-[700px]:w-[min(720px,calc(100vw-48px))] min-[700px]:-translate-x-1/2 min-[700px]:-translate-y-1/2 min-[700px]:rounded-2xl"
          style={brandVars}
        >
          <div className="relative flex items-start gap-2.5 px-3 pb-2 pt-4 pr-12 min-[700px]:gap-3 min-[700px]:px-5 min-[700px]:pb-3 min-[700px]:pt-5 min-[700px]:pr-14">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)] text-[color:var(--brand-primary)] min-[700px]:h-11 min-[700px]:w-11">
              <JobPostPreviewIcon className="h-5 w-5 min-[700px]:h-6 min-[700px]:w-6" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <Dialog.Title className="text-sm font-semibold text-[#1D2739]">
                Job post preview
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm leading-5 text-[#64748B]">
                The live post people view may look slightly different.
              </Dialog.Description>
            </div>
            <Dialog.Close
              type="button"
              className="absolute right-3 top-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#1D2739] text-white transition hover:opacity-90 min-[700px]:right-4 min-[700px]:top-4"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-1 min-[700px]:px-5">
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 min-[700px]:p-5">
              <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] pb-4">
                <div className="min-w-0 flex-1">
                  <h3 className={JOB_POSTING_PAGE_TITLE_CLASS}>
                    {title}
                  </h3>
                  {companyName ? (
                    <p className={`mt-1 ${JOB_POSTING_FIELD_VALUE_CLASS}`}>{companyName}</p>
                  ) : null}
                  <p className={`mt-0.5 ${JOB_POSTING_METADATA_CLASS}`}>{locationLine}</p>
                </div>
                <button
                  type="button"
                  className={`${JOB_FORM_PRIMARY_BUTTON_CLASS} h-9 shrink-0 px-3 min-[700px]:h-10 min-[700px]:px-5`}
                  style={brandStyle}
                >
                  Apply Now
                </button>
              </div>

              {isMsp && (mspPay || job.billRate != null) ? (
                <div className="mt-4 grid gap-3 border-b border-[#E5E7EB] pb-4 min-[700px]:grid-cols-2 min-[700px]:gap-4">
                  {job.billRate != null ? (
                    <div>
                      <p className={JOB_POSTING_FIELD_LABEL_CLASS}>Bill Rate</p>
                      <p className={`mt-1 ${JOB_POSTING_FIELD_VALUE_CLASS}`}>${job.billRate}</p>
                    </div>
                  ) : null}
                  {mspPay ? (
                    <div
                      className={
                        job.billRate != null
                          ? "min-[700px]:border-l min-[700px]:border-[#E5E7EB] min-[700px]:pl-4"
                          : ""
                      }
                    >
                      <p className={JOB_POSTING_FIELD_LABEL_CLASS}>Pay Rate</p>
                      <p className={`mt-1 ${JOB_POSTING_FIELD_VALUE_CLASS}`}>{mspPay}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!isMsp && showCompensation ? (
                <div className="mt-4 grid gap-3 border-b border-[#E5E7EB] pb-4 min-[700px]:grid-cols-2 min-[700px]:gap-4">
                  <div>
                    <p className={JOB_POSTING_FIELD_LABEL_CLASS}>Compensation</p>
                    <p className={`mt-1 ${JOB_POSTING_FIELD_VALUE_CLASS}`}>
                      {compensationLabel || "—"}
                    </p>
                  </div>
                  <div className="min-[700px]:border-l min-[700px]:border-[#E5E7EB] min-[700px]:pl-4">
                    <p className={JOB_POSTING_FIELD_LABEL_CLASS}>
                      {ui.showPayBy?.trim() || "Exact amount"}:
                    </p>
                    <p className={`mt-1 ${JOB_POSTING_FIELD_VALUE_CLASS}`}>
                      {paySummary !== "—" ? paySummary : "—"}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 max-h-[min(280px,40dvh)] overflow-y-auto pr-1 min-[700px]:max-h-[280px]">
                <style>{JOB_POSTING_DESCRIPTION_CSS.replaceAll(".job-posting-description", ".job-preview-description")}</style>
                <JobDescriptionHtml
                  html={descriptionHtml}
                  className="job-preview-description mt-0"
                  emptyLabel="No description added yet."
                />
                {ui.selectedBenefits.length ? (
                  <section className="job-preview-description mt-6">
                    <h3 className="m-0 text-sm font-semibold leading-6 text-[#1D2739]">Benefits</h3>
                    <ul className="mt-1 list-outside list-disc space-y-1 pl-5 text-sm leading-6 text-[#667085]">
                      {ui.selectedBenefits.map((benefit) => (
                        <li key={benefit}>{benefit}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex justify-center border-t border-[#F1F5F9] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] min-[700px]:border-t-0 min-[700px]:px-5 min-[700px]:py-5 min-[700px]:pb-5">
            <Dialog.Close
              type="button"
              className={`${JOB_FORM_OUTLINE_BUTTON_CLASS} w-full px-6 min-[700px]:w-auto`}
            >
              Close Preview
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
