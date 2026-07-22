"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { FileText, X } from "lucide-react";
import type { CSSProperties } from "react";
import type { JobRequisitionInput } from "@/lib/jobs/types";
import type { JobFormUiState } from "./job-form-shared";
import { JOB_FORM_OUTLINE_BUTTON_CLASS, JOB_FORM_PRIMARY_BUTTON_CLASS } from "./job-form-shared";
import { JobDescriptionHtml } from "./JobDescriptionEditor";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobRequisitionInput;
  ui: JobFormUiState;
  companyName: string;
  brandStyle: CSSProperties;
};

export function JobPostPreviewModal({
  open,
  onOpenChange,
  job,
  ui,
  companyName,
  brandStyle,
}: Props) {
  const title = job.publicTitle?.trim() || "Untitled job";
  const location = job.location?.trim() || "Location not set";
  const description = job.publicDescription?.trim() || "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[201] flex max-h-[92dvh] w-[min(720px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl outline-none">
          <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F8FAFC] text-[#64748B]">
                <FileText className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <Dialog.Title className="text-lg font-semibold text-[#1D2739]">
                  Job post preview
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-[#64748B]">
                  The live post people view may look slightly different.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close
              type="button"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#1D2739]"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <div className="flex flex-col gap-4 border-b border-[#E5E7EB] pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-[#1D2739]">{title}</h3>
                  <p className="mt-1 text-sm font-medium text-[#334155]">{companyName}</p>
                  <p className="mt-0.5 text-sm text-[#64748B]">{location}</p>
                  {ui.jobLocationType ? (
                    <p className="mt-0.5 text-xs text-[#94A3B8]">{ui.jobLocationType}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`${JOB_FORM_PRIMARY_BUTTON_CLASS} shrink-0 px-4`}
                  style={brandStyle}
                >
                  Apply Now
                </button>
              </div>

              <JobDescriptionHtml
                html={description}
                className="mt-4"
                emptyLabel="No description added yet."
              />

              {job.qualifications?.trim() ? (
                <div className="mt-5">
                  <h4 className="text-sm font-semibold text-[#1D2739]">Qualifications</h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#334155]">{job.qualifications}</p>
                </div>
              ) : null}

              {job.responsibilities?.trim() ? (
                <div className="mt-5">
                  <h4 className="text-sm font-semibold text-[#1D2739]">Key Responsibilities</h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#334155]">{job.responsibilities}</p>
                </div>
              ) : null}

              {ui.selectedBenefits.length ? (
                <div className="mt-5">
                  <h4 className="text-sm font-semibold text-[#1D2739]">Benefits</h4>
                  <p className="mt-1 text-sm text-[#334155]">{ui.selectedBenefits.join(", ")}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-[#E5E7EB] px-5 py-4">
            <Dialog.Close type="button" className={`${JOB_FORM_OUTLINE_BUTTON_CLASS} w-full`}>
              Close Preview
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
