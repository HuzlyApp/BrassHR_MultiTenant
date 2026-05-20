"use client";

import { Check } from "lucide-react";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };

export const TENANT_ONBOARDING_STEPPER_ITEMS = [
  "Select Goals",
  "Business Information",
  "Customize Branding",
  "Setting up Brass Domain",
] as const;

export type TenantOnboardingStepperPhase =
  | "goals"
  | "business"
  | "branding-logo"
  | "branding-colors"
  | "domain"
  | "setup"
  | "done";

const STEPPER_WIDTH = 620;
const STEP_WIDTH = 155;
const LINE_TOP = 7;
const ICON_SIZE = 16;
const LINE_INSET = STEP_WIDTH / 2;
const TRACK_LINE = "#e8edf4";
const PENDING_TEXT = "#94a3b8";
const ACTIVE_TEXT = "#0f172a";

type TenantOnboardingStepperProps = {
  phase: TenantOnboardingStepperPhase;
  className?: string;
};

function getStepperConfig(phase: TenantOnboardingStepperPhase) {
  switch (phase) {
    case "goals":
      return {
        completedStepIndex: -1,
        activeStepIndex: 0,
        connectorProgress: [0.45, 0, 0] as const,
      };
    case "business":
      return {
        completedStepIndex: 0,
        activeStepIndex: 1,
        connectorProgress: [1, 0.45, 0] as const,
      };
    case "branding-logo":
      return {
        completedStepIndex: 1,
        activeStepIndex: 2,
        connectorProgress: [1, 1, 0.25] as const,
      };
    case "branding-colors":
      return {
        completedStepIndex: 1,
        activeStepIndex: 2,
        connectorProgress: [1, 1, 0.65] as const,
      };
    case "domain":
      return {
        completedStepIndex: 2,
        activeStepIndex: 3,
        connectorProgress: [1, 1, 0.5] as const,
      };
    case "setup":
      return {
        completedStepIndex: 3,
        activeStepIndex: 3,
        connectorProgress: [1, 1, 1] as const,
      };
    case "done":
      return {
        completedStepIndex: 3,
        activeStepIndex: 4,
        connectorProgress: [1, 1, 1] as const,
      };
  }
}

function getGoldFillPercent(connectorProgress: readonly [number, number, number]) {
  const [first, second, third] = connectorProgress;
  return ((first + second + third) / 3) * 100;
}

type StepIconProps = {
  isCompleted: boolean;
  isActive: boolean;
  isPending: boolean;
  showCheckOnActive: boolean;
};

function StepIcon({ isCompleted, isActive, isPending, showCheckOnActive }: StepIconProps) {
  const gold = "var(--brand-primary, #BC8B41)";

  return (
    <span
      className="relative z-10 flex items-center justify-center rounded-full border bg-white"
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderColor: isPending ? TRACK_LINE : gold,
        backgroundColor: isPending ? "#ffffff" : gold,
        color: "#ffffff",
      }}
    >
      {isCompleted && !isActive ? <Check className="h-[10px] w-[10px]" strokeWidth={2.5} /> : null}
      {isActive && showCheckOnActive ? <Check className="h-[10px] w-[10px]" strokeWidth={2.5} /> : null}
      {isActive && !showCheckOnActive ? <span className="h-[6px] w-[6px] rounded-full bg-white" /> : null}
      {isPending ? <span className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: TRACK_LINE }} /> : null}
    </span>
  );
}

export default function TenantOnboardingStepper({ phase, className = "" }: TenantOnboardingStepperProps) {
  const { completedStepIndex, activeStepIndex, connectorProgress } = getStepperConfig(phase);
  const goldFillPercent = getGoldFillPercent(connectorProgress);
  const trackWidthExpr = `calc(100% - ${STEP_WIDTH}px)`;
  const gold = "var(--brand-primary, #BC8B41)";

  return (
    <div className={`mt-[24px] w-full max-w-full ${className}`.trim()} style={{ maxWidth: STEPPER_WIDTH }}>
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
            backgroundColor: gold,
          }}
          aria-hidden
        />

        <div className="relative flex w-full items-start justify-between">
          {TENANT_ONBOARDING_STEPPER_ITEMS.map((item, index) => {
            const isCompleted = index <= completedStepIndex;
            const isActive = index === activeStepIndex;
            const isPending = index > activeStepIndex;

            return (
              <div
                key={item}
                className="relative z-10 flex flex-col items-center px-1"
                style={{ width: STEP_WIDTH }}
              >
                <StepIcon
                  isCompleted={isCompleted}
                  isActive={isActive}
                  isPending={isPending}
                  showCheckOnActive={phase === "goals" && index === 0}
                />
                <span
                  className="mt-[10px] w-full text-center text-[10px] font-normal leading-[12px] tracking-normal"
                  style={{
                    ...interStyle,
                    color: isPending ? PENDING_TEXT : ACTIVE_TEXT,
                    fontWeight: isActive ? 600 : 400,
                  }}
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

export function tenantOnboardingStepToPhase(
  step:
    | "goals"
    | "business"
    | "company_logo"
    | "branding"
    | "domain"
    | "onboarding"
    | "preview"
    | "admin"
    | "done"
): TenantOnboardingStepperPhase {
  if (step === "goals") return "goals";
  if (step === "business") return "business";
  if (step === "company_logo") return "branding-logo";
  if (step === "branding") return "branding-colors";
  if (step === "domain") return "domain";
  if (step === "done") return "done";
  return "setup";
}
