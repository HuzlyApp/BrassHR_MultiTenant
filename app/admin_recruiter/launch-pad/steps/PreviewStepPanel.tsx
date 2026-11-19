"use client";

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
  return (
    <div className="flex w-full justify-center py-8">
      <div className="w-full max-w-[620px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex flex-col gap-6 p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[18px] font-semibold leading-7 text-black" style={interStyle}>
              Applicant Preview
            </h2>
            <p className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
              See how your apply page looks with your branding.
            </p>
          </div>

          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-[#D1D5DB] bg-[#FAFAFA] p-8 text-center">
            <p className="text-[14px] font-semibold text-black" style={interStyle}>
              Apply page preview
            </p>
            <p className="mt-2 max-w-sm text-[12px] leading-4 text-[#6B7280]" style={interStyle}>
              Your logo, colors, and domain will appear on the public applicant portal once setup is
              complete.
            </p>
            <a
              href="/jobs"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-lg border border-[#012352] bg-white px-3.5 text-[14px] font-semibold text-[#012352]"
              style={interStyle}
            >
              Open job board
            </a>
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
