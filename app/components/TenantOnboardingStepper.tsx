"use client";

import { AlertCircle, Check } from "lucide-react";
import type { TenantStepIndicatorState } from "@/lib/tenant/tenant-onboarding-stepper-status";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };

export const TENANT_ONBOARDING_STEPPER_ITEMS = [
  "Select Goals",
  "Business Information",
  "Customize Branding",
  "Invite Team Members",
] as const;

export type TenantOnboardingStepperPhase =
  | "goals"
  | "business"
  | "branding-logo"
  | "branding-colors"
  | "domain"
  | "setup"
  | "done";

const LINE_TOP = 7;
const ICON_SIZE = 16;
const GOLD = "var(--brand-primary, #BC8B41)";
const TRACK_LINE = "#e8edf4";
const PENDING_TEXT = "#94a3b8";
const ACTIVE_TEXT = "#0f172a";
const WARNING_TEXT = "#b45309";

type TenantOnboardingStepperProps = {
  phase: TenantOnboardingStepperPhase;
  stepStates?: TenantStepIndicatorState[];
  className?: string;
};

function getStepperConfig(phase: TenantOnboardingStepperPhase) {
  switch (phase) {
    case "goals":
      return {
        activeStepIndex: 0,
        connectorProgress: [0.45, 0, 0] as const,
      };
    case "business":
      return {
        activeStepIndex: 1,
        connectorProgress: [1, 0.45, 0] as const,
      };
    case "branding-logo":
      return {
        activeStepIndex: 2,
        connectorProgress: [1, 1, 0.25] as const,
      };
    case "branding-colors":
      return {
        activeStepIndex: 2,
        connectorProgress: [1, 1, 0.65] as const,
      };
    case "domain":
      return {
        activeStepIndex: 3,
        connectorProgress: [1, 1, 0.5] as const,
      };
    case "setup":
      return {
        activeStepIndex: 3,
        connectorProgress: [1, 1, 1] as const,
      };
    case "done":
      return {
        activeStepIndex: 4,
        connectorProgress: [1, 1, 1] as const,
      };
  }
}

function StepIcon({ state }: { state: TenantStepIndicatorState }) {
  if (state === "skipped") {
    return (
      <span
        className="relative z-10 shrink-0 rounded-full border-[2px] border-amber-500 bg-amber-50 text-amber-600"
        style={{ width: ICON_SIZE, height: ICON_SIZE }}
      >
        <AlertCircle
          className="absolute left-1/2 top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2"
          strokeWidth={2.5}
        />
      </span>
    );
  }

  const isCompleted = state === "completed";
  const isCurrent = state === "current";
  const isPending = state === "not_started";

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
      {isCurrent ? <span className="h-[6px] w-[6px] rounded-full bg-white" /> : null}
      {isPending ? (
        <span className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: TRACK_LINE }} />
      ) : null}
    </span>
  );
}

function stepLabelClass(state: TenantStepIndicatorState): string {
  if (state === "completed" || state === "current") {
    return "font-normal";
  }
  if (state === "skipped") {
    return "font-normal";
  }
  return "font-normal";
}

type ConnectorSegmentProps = {
  progress: number;
};

function ConnectorSegment({ progress }: ConnectorSegmentProps) {
  const fill = Math.min(100, Math.max(0, progress * 100));

  return (
    <div
      className="pointer-events-none absolute z-0 h-[2px]"
      style={{
        top: LINE_TOP,
        left: "50%",
        width: "100%",
      }}
      aria-hidden
    >
      <div className="absolute inset-0" style={{ backgroundColor: TRACK_LINE }} />
      <div
        className="absolute inset-y-0 left-0 transition-all duration-300"
        style={{
          width: `${fill}%`,
          backgroundColor: GOLD,
        }}
      />
    </div>
  );
}

function legacyStepState(index: number, activeStepIndex: number): TenantStepIndicatorState {
  if (index > activeStepIndex) return "not_started";
  if (index === activeStepIndex) return "current";
  return "completed";
}

export default function TenantOnboardingStepper({
  phase,
  stepStates,
  className = "",
}: TenantOnboardingStepperProps) {
  const { activeStepIndex, connectorProgress } = getStepperConfig(phase);

  const resolvedStates: TenantStepIndicatorState[] =
    stepStates ??
    TENANT_ONBOARDING_STEPPER_ITEMS.map((_, index) => legacyStepState(index, activeStepIndex));

  return (
    <div className={`mt-[24px] w-full ${className}`.trim()}>
      <div className="grid w-full grid-cols-4">
        {TENANT_ONBOARDING_STEPPER_ITEMS.map((item, index) => {
          const state = resolvedStates[index] ?? "not_started";

          return (
            <div key={item} className="relative flex min-w-0 flex-col items-center">
              {index < TENANT_ONBOARDING_STEPPER_ITEMS.length - 1 ? (
                <ConnectorSegment progress={connectorProgress[index] ?? 0} />
              ) : null}

              <StepIcon state={state} />
              <span
                className={`mt-[10px] w-full px-1 text-center text-[10px] leading-[12px] tracking-normal ${stepLabelClass(state)}`}
                style={{
                  ...interStyle,
                  color:
                    state === "not_started"
                      ? PENDING_TEXT
                      : state === "skipped"
                        ? WARNING_TEXT
                        : ACTIVE_TEXT,
                  fontWeight: state === "current" ? 600 : 400,
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
