"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { boldJobDescriptionSectionTitles, sanitizeJobDescriptionHtml } from "@/lib/jobs/generate-job-description/sanitize-html";
import {
  ensureJobDescriptionBulletLists,
  stripJobDescriptionBenefitsSection,
} from "@/lib/jobs/job-description-html";
import { JOB_FORM_OUTLINE_BUTTON_CLASS } from "./job-form-shared";
import { JobDescriptionHtml } from "./JobDescriptionEditor";
import { JobPostPreviewIcon } from "./JobPostPreviewIcon";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html: string;
  brandVars?: CSSProperties;
};

function formatViewDescriptionHtml(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return ensureJobDescriptionBulletLists(
    boldJobDescriptionSectionTitles(
      stripJobDescriptionBenefitsSection(sanitizeJobDescriptionHtml(trimmed))
    )
  );
}

/** Read-only job description viewer for the create-job review screen. */
export function JobDescriptionViewModal({ open, onOpenChange, html, brandVars }: Props) {
  const content = useMemo(() => formatViewDescriptionHtml(html), [html]);

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
                <style>{`
                  .job-description-view.job-description-html > :first-child {
                    margin-top: 0 !important;
                  }
                  .job-description-view.job-description-html h2,
                  .job-description-view.job-description-html h3,
                  .job-description-view.job-description-html h4 {
                    margin-top: 1.5rem;
                    margin-bottom: 0.5rem;
                    font-size: 14px;
                    line-height: 1.5rem;
                    font-weight: 600;
                    color: #1D2739;
                  }
                  .job-description-view.job-description-html h2 strong,
                  .job-description-view.job-description-html h2 b,
                  .job-description-view.job-description-html h3 strong,
                  .job-description-view.job-description-html h3 b,
                  .job-description-view.job-description-html h4 strong,
                  .job-description-view.job-description-html h4 b {
                    font-weight: 600;
                  }
                  .job-description-view.job-description-html p,
                  .job-description-view.job-description-html ul,
                  .job-description-view.job-description-html ol {
                    margin-top: 0;
                    margin-bottom: 0;
                    color: #667085;
                    font-size: 14px;
                    line-height: 1.5rem;
                  }
                  .job-description-view.job-description-html ul {
                    list-style-type: disc;
                    list-style-position: outside;
                    padding-left: 1.25rem;
                    margin-top: 0.25rem;
                  }
                  .job-description-view.job-description-html ol {
                    list-style-type: decimal;
                    list-style-position: outside;
                    padding-left: 1.25rem;
                    margin-top: 0.25rem;
                  }
                  .job-description-view.job-description-html li {
                    display: list-item;
                    margin-top: 0.25rem;
                    margin-bottom: 0.25rem;
                    color: #667085;
                  }
                  .job-description-view.job-description-html p + h2,
                  .job-description-view.job-description-html p + h3,
                  .job-description-view.job-description-html p + h4,
                  .job-description-view.job-description-html ul + h2,
                  .job-description-view.job-description-html ul + h3,
                  .job-description-view.job-description-html ul + h4,
                  .job-description-view.job-description-html ol + h2,
                  .job-description-view.job-description-html ol + h3,
                  .job-description-view.job-description-html ol + h4 {
                    margin-top: 1.5rem;
                  }
                  .job-description-view.job-description-html p:has(> strong:only-child),
                  .job-description-view.job-description-html p:has(> b:only-child) {
                    margin-top: 1.5rem;
                    margin-bottom: 0.5rem;
                    font-size: 14px;
                    line-height: 1.5rem;
                    font-weight: 600;
                    color: #1D2739;
                  }
                  .job-description-view.job-description-html p:has(> strong:only-child) > strong,
                  .job-description-view.job-description-html p:has(> b:only-child) > b {
                    font-weight: 600;
                  }
                  .job-description-view.job-description-html > p:has(> strong:only-child):first-child,
                  .job-description-view.job-description-html > p:has(> b:only-child):first-child {
                    margin-top: 0;
                  }
                `}</style>
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
