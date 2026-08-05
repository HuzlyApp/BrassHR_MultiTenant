"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { buildJobDescriptionPreviewSections } from "@/lib/jobs/job-description-preview";
import { JobDescriptionHtml } from "./JobDescriptionEditor";
import { JOB_FORM_OUTLINE_BUTTON_CLASS } from "./job-form-shared";

const JOB_DESCRIPTION_PREVIEW_ICON_SRC = "/job-post-preview-icon.svg";

export type JobDescriptionPreviewContent = {
  id: string;
  title: string;
  publicDescription: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  benefits: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobDescriptionPreviewContent | null;
  brandVars?: CSSProperties;
};

function DescriptionSection({
  title,
  html,
  emptyLabel,
  asList = false,
}: {
  title: string;
  html: string;
  emptyLabel: string;
  asList?: boolean;
}) {
  const content = html.trim();
  if (!content) return null;

  return (
    <section className="border-b border-[#E5E7EB] pb-4 last:border-b-0 last:pb-0">
      <h3 className="text-sm font-semibold text-[#1D2739]">{title}</h3>
      <JobDescriptionHtml
        html={content}
        className="mt-2"
        emptyLabel={emptyLabel}
        asList={asList}
      />
    </section>
  );
}

/** Figma — job listing description preview (reuses post preview shell). */
export function JobDescriptionPreviewModal({ open, onOpenChange, job, brandVars }: Props) {
  const sections = useMemo(
    () =>
      job
        ? buildJobDescriptionPreviewSections({
            publicDescription: job.publicDescription,
            responsibilities: job.responsibilities,
            qualifications: job.qualifications,
            benefits: job.benefits,
          })
        : [],
    [job]
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/40" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-[201] flex max-h-[min(92dvh,100dvh)] w-full flex-col overflow-hidden rounded-t-2xl border border-[#E5E7EB] bg-white shadow-xl outline-none min-[700px]:inset-x-auto min-[700px]:bottom-auto min-[700px]:left-1/2 min-[700px]:top-1/2 min-[700px]:max-h-[92dvh] min-[700px]:w-[min(720px,calc(100vw-48px))] min-[700px]:-translate-x-1/2 min-[700px]:-translate-y-1/2 min-[700px]:rounded-2xl"
          style={brandVars}
          aria-describedby={undefined}
        >
          <div className="relative flex items-start gap-2.5 px-3 pb-2 pt-4 pr-12 min-[700px]:gap-3 min-[700px]:px-5 min-[700px]:pb-3 min-[700px]:pt-5 min-[700px]:pr-14">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)] min-[700px]:h-11 min-[700px]:w-11">
              <BrandedSvgIcon
                src={JOB_DESCRIPTION_PREVIEW_ICON_SRC}
                className="h-5 w-5 min-[700px]:h-6 min-[700px]:w-6"
                color="var(--brand-primary)"
              />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <Dialog.Title className="text-base font-semibold text-[#1D2739] min-[700px]:text-lg">
                Job description preview
              </Dialog.Title>
              <p className="mt-0.5 text-xs leading-5 text-[#64748B] min-[700px]:text-sm">
                Preview job descriptions
              </p>
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
              {job?.title ? (
                <p className="mb-4 text-sm font-medium text-[#64748B]">{job.title}</p>
              ) : null}
              <div className="max-h-[min(360px,50dvh)] space-y-4 overflow-y-auto pr-1 min-[700px]:max-h-[360px]">
                {sections.length ? (
                  sections.map((section) => (
                    <DescriptionSection
                      key={section.title}
                      title={section.title}
                      html={section.html}
                      emptyLabel="—"
                      asList={section.asList}
                    />
                  ))
                ) : (
                  <p className="text-sm text-[#64748B]">No description added yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-stretch justify-center gap-2 border-t border-[#F1F5F9] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] min-[700px]:flex-row min-[700px]:items-center min-[700px]:justify-center min-[700px]:gap-3 min-[700px]:border-t-0 min-[700px]:px-5 min-[700px]:py-5 min-[700px]:pb-5">
            <Dialog.Close
              type="button"
              className={`${JOB_FORM_OUTLINE_BUTTON_CLASS} w-full px-6 min-[700px]:w-auto`}
            >
              Close Preview
            </Dialog.Close>
            {job?.id ? (
              <Link
                href={`/admin_recruiter/jobs/${job.id}/edit`}
                className={`${JOB_FORM_OUTLINE_BUTTON_CLASS} inline-flex w-full items-center justify-center gap-2 px-6 min-[700px]:w-auto`}
                onClick={() => onOpenChange(false)}
              >
                <Sparkles className="h-4 w-4 shrink-0 text-[color:var(--brand-secondary)]" aria-hidden />
                Edit Job Description
              </Link>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
