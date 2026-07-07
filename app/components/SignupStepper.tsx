"use client";

import { Check } from "lucide-react";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };

export const SIGNUP_STEPPER_ITEMS = ["Sign Up", "Preparing your trial", "Account is ready"] as const;

export type SignupStepperPhase = "details" | "password" | "preparing" | "ready";

const STEPPER_WIDTH = 670;
const STEP_WIDTH = 103.666664;
const LINE_TOP = 7;
const ICON_SIZE = 16;
const LINE_INSET = STEP_WIDTH / 2;
const GOLD = "#BC8B41";
const TRACK_LINE = "#e8edf4";
const PENDING_TEXT = "#94a3b8";
const ACTIVE_TEXT = "#0f172a";

type SignupStepperProps = {
  phase: SignupStepperPhase;
  className?: string;
};

export function getStepperConfig(phase: SignupStepperPhase) {
  switch (phase) {
    case "details":
      return {
        completedStepIndex: -1,
        activeStepIndex: 0,
        connectorProgress: [0.45, 0] as const,
      };
    case "password":
      return {
        completedStepIndex: -1,
        activeStepIndex: 0,
        connectorProgress: [0.65, 0] as const,
      };
    case "preparing":
      return {
        completedStepIndex: 0,
        activeStepIndex: 1,
        connectorProgress: [1, 0.5] as const,
      };
    case "ready":
      return {
        completedStepIndex: 2,
        activeStepIndex: 3,
        connectorProgress: [1, 1] as const,
      };
  }
}

/** Map signup UI state to the public stepper phase (password stays on Sign Up). */
export function resolveSignupStepperPhase(input: {
  formStep: "details" | "password";
  redirecting: boolean;
}): SignupStepperPhase {
  if (input.redirecting) return "preparing";
  return input.formStep === "password" ? "password" : "details";
}

/** Gold fill as % of the full track (between first and last icon centers). */
function getGoldFillPercent(connectorProgress: readonly [number, number]) {
  const [first, second] = connectorProgress;
  return (first * 0.5 + second * 0.5) * 100;
}

export type SignupStepIconVariant = "completed" | "active" | "pending";

/** Visual state for a single signup stepper node (pure, testable). */
export function getSignupStepIconVariant(
  index: number,
  completedStepIndex: number,
  activeStepIndex: number
): SignupStepIconVariant {
  if (index === activeStepIndex) return "active";
  if (index <= completedStepIndex) return "completed";
  return "pending";
}

type StepIconProps = {
  variant: SignupStepIconVariant;
};

function StepIcon({ variant }: StepIconProps) {
  const isCompleted = variant === "completed";
  const isActive = variant === "active";
  const isPending = variant === "pending";

  return (
    <span
      className="relative z-10 flex items-center justify-center rounded-full border bg-white"
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderColor: isPending ? TRACK_LINE : GOLD,
        backgroundColor: isPending ? "#ffffff" : GOLD,
        color: "#ffffff",
      }}
    >
      {isCompleted ? <Check className="h-[10px] w-[10px]" strokeWidth={2.5} /> : null}
      {isActive ? <span className="h-[6px] w-[6px] rounded-full bg-white" /> : null}
      {isPending ? <span className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: TRACK_LINE }} /> : null}
    </span>
  );
}

export default function SignupStepper({ phase, className = "" }: SignupStepperProps) {
  const { completedStepIndex, activeStepIndex, connectorProgress } = getStepperConfig(phase);
  const goldFillPercent = getGoldFillPercent(connectorProgress);
  const trackWidthExpr = `calc(100% - ${STEP_WIDTH}px)`;

  return (
    <div
      className={`mt-[24px] max-w-full ${className}`.trim()}
      style={{ width: STEPPER_WIDTH }}
    >
      <div className="relative h-[66px] w-full">
        <div
          className="absolute h-[2px]"
          style={{
            top: LINE_TOP,
            left: LINE_INSET,
            width: trackWidthExpr,
            backgroundColor: TRACK_LINE,
          }}
          aria-hidden
        />
        <div
          className="absolute h-[2px]"
          style={{
            top: LINE_TOP,
            left: LINE_INSET,
            width: `calc(${trackWidthExpr} * ${goldFillPercent / 100})`,
            backgroundColor: GOLD,
          }}
          aria-hidden
        />

        <div className="relative flex w-full items-start justify-between">
          {SIGNUP_STEPPER_ITEMS.map((item, index) => {
            const variant = getSignupStepIconVariant(index, completedStepIndex, activeStepIndex);
            const isPending = variant === "pending";

            return (
              <div
                key={item}
                className="relative z-10 flex flex-col items-center"
                style={{ width: STEP_WIDTH }}
              >
                <StepIcon variant={variant} />
                <span
                  className="mt-[12px] w-full text-center text-[12px] font-normal leading-[16px] tracking-normal"
                  style={{ ...interStyle, color: isPending ? PENDING_TEXT : ACTIVE_TEXT }}
                >
                  {item}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
