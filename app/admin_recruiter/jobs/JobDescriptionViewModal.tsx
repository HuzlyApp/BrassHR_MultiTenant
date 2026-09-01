"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { formatStoredJobDescriptionHtml } from "@/lib/jobs/job-description-html";
import { JOB_FORM_OUTLINE_BUTTON_CLASS } from "./job-form-shared";
import { JobDescriptionHtml } from "./JobDescriptionEditor";
import { JobPostPreviewIcon } from "./JobPostPreviewIcon";
import { JOB_POSTING_DESCRIPTION_CSS } from "./job-posting-typography";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html: string;
  brandVars?: CSSProperties;
};

/** Read-only job description viewer for the create-job review screen. */
export function JobDescriptionViewModal({ open, onOpenChange, html, brandVars }: Props) {
  const content = useMemo(() => formatStoredJobDescriptionHtml(html), [html]);

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
                Job Description
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm leading-5 text-[#64748B]">
                Full description for this job post.
              </Dialog.Description>
            </div>
            <Dialog.Close
              type="button"
              className="absolute right-3 top-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#1D2739] text-white transition hover:opacity-90 min-[700px]:right-4 min-[700px]:top-4"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-1 min-[700px]:px-5">
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 min-[700px]:p-5">
              <div className="max-h-[min(420px,55dvh)] overflow-y-auto pr-1 min-[700px]:max-h-[480px]">
                <style>{JOB_POSTING_DESCRIPTION_CSS.replaceAll(".job-posting-description", ".job-description-view")}</style>
                <JobDescriptionHtml
                  html={content}
                  className="job-description-view mt-0"
                  emptyLabel="No description added yet."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center border-t border-[#F1F5F9] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] min-[700px]:border-t-0 min-[700px]:px-5 min-[700px]:py-5 min-[700px]:pb-5">
            <Dialog.Close
              type="button"
              className={`${JOB_FORM_OUTLINE_BUTTON_CLASS} w-full px-6 min-[700px]:w-auto`}
            >
              Close
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
