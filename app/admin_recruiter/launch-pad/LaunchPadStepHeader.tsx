"use client";

import Image from "next/image";
import {
  LAUNCH_PAD_STEPS,
  interStyle,
  type LaunchPadStepId,
} from "./constants";
import { countCompletedSteps, type LaunchPadProgress } from "./progress";

export function LaunchPadStepHeader({
  stepId,
  progress,
  onBack,
}: {
  stepId: LaunchPadStepId;
  progress: LaunchPadProgress;
  onBack: () => void;
}) {
  const step = LAUNCH_PAD_STEPS.find((item) => item.id === stepId)!;
  const done = countCompletedSteps(progress);
  const total = LAUNCH_PAD_STEPS.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="flex w-full flex-col gap-[12px]">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-[15px] w-fit items-center gap-1.5 text-[10px] font-semibold leading-[15px] text-[#012352]"
        style={interStyle}
      >
        <Image
          src="/icons/braas-HR/launch-pad/back-arrow.svg"
          alt=""
          width={12}
          height={12}
          className="size-3"
        />
        Back to Launch Pad
      </button>

      <div className="flex w-full items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[24px] font-semibold leading-8 text-black" style={interStyle}>
            {step.pageTitle}
          </h1>
          <p className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
            {step.description}
          </p>
        </div>

        <div className="flex w-[202px] shrink-0 flex-col gap-1 pt-2">
          <div className="flex items-center justify-end gap-1 text-[12px] leading-4" style={interStyle}>
            <span className="font-normal text-[#6B7280]">Steps</span>
            <span className="font-semibold text-black">{step.number}</span>
            <span className="font-normal text-[#6B7280]">of</span>
            <span className="font-semibold text-black">{total}</span>
            <span className="font-normal text-[#6B7280]">•</span>
            <span className="font-normal text-[#6B7280]">{step.progressLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
              <div
                className="h-full rounded-full bg-[#012352] transition-[width] duration-300"
                style={{ width: `${Math.max(pct, Math.round((step.number / total) * 100))}%` }}
              />
            </div>
            <span
              className="inline-flex h-[23px] items-center rounded-md bg-[#F3F4F6] px-2 text-[10px] font-semibold leading-[15px] text-[#374151]"
              style={interStyle}
            >
              {done} of {total} Done
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LaunchPadStepActions({
  onSkip,
  onBack,
  onContinue,
  continueLabel = "Save & Continue",
  continueDisabled = false,
  saving = false,
}: {
  onSkip: () => void;
  onBack: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  saving?: boolean;
}) {
  return (
    <div className="flex w-full items-center justify-between px-5 py-[15px]">
      <button
        type="button"
        onClick={onSkip}
        className="text-[12px] font-semibold leading-4 text-[#012352]"
        style={interStyle}
      >
        Skip for now
      </button>
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-[#012352] bg-white px-3.5 text-[14px] font-semibold leading-5 text-[#012352]"
          style={interStyle}
        >
          Back
        </button>
        <button
          type="button"
          disabled={continueDisabled || saving}
          onClick={onContinue}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#012352] px-3.5 text-[14px] font-semibold leading-5 text-white disabled:opacity-60"
          style={interStyle}
        >
          {saving ? "Saving..." : continueLabel}
        </button>
      </div>
    </div>
  );
}
