"use client";

import Image from "next/image";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };

/** Figma Tenant Onboarding — New: Steper labels */
export const SIGNUP_STEPPER_ITEMS = [
  "Personal Info",
  "Company Info",
  "Account Created",
] as const;

export type SignupStepperPhase =
  | "details"
  | "password"
  | "personal"
  | "company"
  | "preparing"
  | "ready";

const ICON_SIZE = 16;
const GOLD = "#BC8B41";
const TRACK_LINE = "#E5E7EB";
const PENDING_TEXT = "#6B7280";
const ACTIVE_TEXT = "#BC8B41";

type SignupStepperProps = {
  phase: SignupStepperPhase;
  className?: string;
};

export function getStepperConfig(phase: SignupStepperPhase) {
  switch (phase) {
    case "details":
    case "password":
    case "personal":
      return {
        completedStepIndex: -1,
        activeStepIndex: 0,
        /** Segment fills between steps 0→1 and 1→2 */
        connectorFilled: [false, false] as const,
      };
    case "company":
      return {
        completedStepIndex: 0,
        activeStepIndex: 1,
        connectorFilled: [true, false] as const,
      };
    case "preparing":
      return {
        completedStepIndex: 1,
        activeStepIndex: 2,
        connectorFilled: [true, true] as const,
      };
    case "ready":
      return {
        completedStepIndex: 2,
        activeStepIndex: 3,
        connectorFilled: [true, true] as const,
      };
  }
}

/** Map signup UI state to the public stepper phase. */
export function resolveSignupStepperPhase(input: {
  formStep: "details" | "password" | "personal" | "company";
  redirecting: boolean;
}): SignupStepperPhase {
  if (input.redirecting) return "preparing";
  if (input.formStep === "company") return "company";
  if (input.formStep === "personal") return "personal";
  return input.formStep === "password" ? "password" : "details";
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
  const src =
    variant === "completed"
      ? "/icons/braas-HR/tenant-onboarding/stepper-completed.svg"
      : variant === "active"
        ? "/icons/braas-HR/tenant-onboarding/stepper-active.svg"
        : "/icons/braas-HR/tenant-onboarding/stepper-pending.svg";

  return (
    <Image
      src={src}
      alt=""
      width={ICON_SIZE}
      height={ICON_SIZE}
      className="relative z-10 shrink-0"
      aria-hidden
    />
  );
}

type ProgressLineProps = {
  filled: boolean;
};

function ProgressLine({ filled }: ProgressLineProps) {
  return (
    <div className="h-[2px] min-w-0 flex-1" aria-hidden>
      <div
        className="h-full w-full"
        style={{ backgroundColor: filled ? GOLD : TRACK_LINE }}
      />
    </div>
  );
}

export default function SignupStepper({ phase, className = "" }: SignupStepperProps) {
  const { completedStepIndex, activeStepIndex, connectorFilled } = getStepperConfig(phase);

  return (
    <div className={`mt-[24px] w-full ${className}`.trim()} role="list" aria-label="Signup progress">
      <div className="flex w-full items-start">
        {SIGNUP_STEPPER_ITEMS.map((item, index) => {
          const variant = getSignupStepIconVariant(index, completedStepIndex, activeStepIndex);
          const isPending = variant === "pending";
          const isFirst = index === 0;
          const isLast = index === SIGNUP_STEPPER_ITEMS.length - 1;
          const leftFilled = index > 0 ? connectorFilled[index - 1] : false;
          const rightFilled = !isLast ? connectorFilled[index] : false;

          return (
            <div
              key={item}
              role="listitem"
              className="flex min-w-0 flex-1 flex-col items-center gap-[10px]"
              aria-current={variant === "active" ? "step" : undefined}
            >
              <div className="flex h-4 w-full items-center">
                {isFirst ? <div className="min-w-0 flex-1" aria-hidden /> : <ProgressLine filled={Boolean(leftFilled)} />}
                <div className="flex shrink-0 items-center justify-center">
                  <StepIcon variant={variant} />
                </div>
                {isLast ? <div className="min-w-0 flex-1" aria-hidden /> : <ProgressLine filled={Boolean(rightFilled)} />}
              </div>
              <span
                className="w-full px-1 text-center text-[12px] font-normal leading-[16px] tracking-normal"
                style={{
                  ...interStyle,
                  color: isPending ? PENDING_TEXT : ACTIVE_TEXT,
                }}
              >
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
