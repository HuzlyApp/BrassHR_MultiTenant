"use client";

import Image from "next/image";
import {
  LAUNCH_PAD_STEPS,
  interStyle,
  type LaunchPadStepId,
} from "./constants";
import type { LaunchPadProgress } from "./progress";
import { countCompletedSteps } from "./progress";

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
        <div
          className="h-full rounded-full bg-[#012352] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[14px] font-normal leading-5 text-black" style={interStyle}>
        <span className="text-black">{done}</span>
        <span className="text-[#6B7280]"> of </span>
        <span className="text-black">{total}</span>
        <span className="text-[#6B7280]"> Done</span>
      </p>
    </div>
  );
}

function StepIcon({
  number,
  completed,
}: {
  number: number;
  completed: boolean;
}) {
  if (completed) {
    return (
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#DCFCE7]">
        <Image
          src="/icons/braas-HR/launch-pad/check-circle.svg"
          alt=""
          width={24}
          height={24}
          className="size-6"
        />
      </span>
    );
  }
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE]">
      <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#012352]">
        <span className="text-[12px] font-normal leading-4 text-white" style={interStyle}>
          {number}
        </span>
      </span>
    </span>
  );
}

export function LaunchPadChecklist({
  progress,
  onOpenStep,
}: {
  progress: LaunchPadProgress;
  onOpenStep: (id: LaunchPadStepId) => void;
}) {
  const done = countCompletedSteps(progress);
  const total = LAUNCH_PAD_STEPS.length;

  return (
    <div className="flex w-full flex-col gap-6 p-[30px]">
      <div className="flex w-full flex-col gap-5">
        <div className="flex w-full flex-col gap-1">
          <h1 className="text-[24px] font-semibold leading-8 text-black" style={interStyle}>
            Launch Pad
          </h1>
          <p className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
            Complete all six tasks to activate your dedicated company address. Tasks skipped for now remain unfinished.
          </p>
        </div>

        <div className="flex w-full items-start gap-5 rounded-xl border border-[#E5E7EB] bg-white p-5">
          <ProgressBar done={done} total={total} />
        </div>
      </div>

      <div className="flex w-full flex-col gap-3.5">
        {LAUNCH_PAD_STEPS.map((step) => {
          const completed = progress[step.id];
          return (
            <div
              key={step.id}
              className={`flex w-full items-center justify-between gap-4 overflow-hidden rounded-xl border p-5 ${
                completed
                  ? "border-[#012352] bg-[#FBF8F2]"
                  : "border-[#E5E7EB] bg-white"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <StepIcon number={step.number} completed={completed} />
                <div className="flex min-w-0 flex-col gap-1">
                  <p
                    className="text-[14px] font-semibold leading-5 text-black"
                    style={interStyle}
                  >
                    {step.title}
                  </p>
                  <p
                    className="text-[12px] font-normal leading-4 text-[#6B7280]"
                    style={interStyle}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenStep(step.id)}
                className="inline-flex h-[30px] shrink-0 items-center justify-center rounded-lg border border-[#012352] bg-white px-2.5 text-[10px] font-semibold leading-[15px] text-[#012352]"
                style={interStyle}
              >
                {completed ? "Edit" : "Start"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
