"use client"

import Image from "next/image"
import { AlertCircle, Check, Minus } from "lucide-react"
import { useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider"
import { routeForApplicantStep } from "@/lib/onboarding/resolve-applicant-step-route"
import {
  deriveStepIndicatorState,
  furthestProgressStepIndex,
  isStepIndicatorAccessible,
  type StepIndicatorState,
} from "@/lib/onboarding/step-indicator-status"
import {
  resolveApplicantEnabledSteps,
  stepIndexFromPathname,
} from "@/lib/onboarding/tenant-step-navigation"
import { useOnboardingTenant } from "@/lib/tenant/use-onboarding-tenant"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { brandingToCssVars } from "@/lib/tenant/tenant-branding"
import type { OnboardingStepStatus } from "@/lib/onboarding/types"

interface Props {
  /** Optional override; otherwise derived from pathname + tenant steps. */
  currentStep?: number
  completedThrough?: number
  title?: string
  titleIconSrc?: string
  titleIconAlt?: string
}

function StepIcon({ state }: { state: StepIndicatorState }) {
  if (state === "completed") {
    return <Check size={14} strokeWidth={3} />
  }
  if (state === "skipped") {
    return <Minus size={14} strokeWidth={3} />
  }
  if (state === "required_missing") {
    return <AlertCircle size={14} strokeWidth={2.5} />
  }
  if (state === "current") {
    return <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-primary)]" />
  }
  return <span className="h-2.5 w-2.5 rounded-full bg-[#e2e8f0]" />
}

function stepCircleClass(state: StepIndicatorState): string {
  const base =
    "z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full text-sm font-semibold transition-colors outline outline-[4px] outline-white"

  switch (state) {
    case "completed":
      return `${base} bg-[color:var(--brand-primary)] text-white`
    case "skipped":
      return `${base} border-2 border-dashed border-slate-400 bg-slate-100 text-slate-500`
    case "required_missing":
      return `${base} border-[3px] border-amber-500 bg-amber-50 text-amber-600`
    case "current":
      return `${base} bg-white border-[3px] border-[color:var(--brand-primary)]`
    case "incomplete":
      return `${base} bg-white border-[3px] border-amber-300 text-amber-600`
    default:
      return `${base} bg-white border-[3px] border-[#f1f5f9] text-[#e2e8f0]`
  }
}

function ConnectorSegment({ filled }: { filled: boolean }) {
  return (
    <div
      className="pointer-events-none absolute top-3 z-0 h-[2px] w-full"
      style={{ left: "50%" }}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[#f1f5f9]" />
      <div
        className="absolute inset-y-0 left-0 bg-[color:var(--brand-primary)] transition-all duration-300"
        style={{ width: filled ? "100%" : "0%" }}
      />
    </div>
  )
}

function stepLabelClass(state: StepIndicatorState): string {
  if (state === "completed" || state === "current") {
    return "text-[color:var(--brand-primary)] font-medium"
  }
  if (state === "skipped") {
    return "text-slate-500 font-medium"
  }
  if (state === "required_missing" || state === "incomplete") {
    return "text-amber-700 font-medium"
  }
  return "text-gray-400"
}

export default function OnboardingStepper({
  currentStep: currentStepOverride,
  title,
  titleIconSrc,
  titleIconAlt,
}: Props) {
  const branding = useTenantBranding()
  const { slug, push } = useOnboardingTenant()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString() ? `?${searchParams.toString()}` : ""
  const onboarding = useOnboardingConfigOptional()

  const enabledSteps = useMemo(
    () => resolveApplicantEnabledSteps(onboarding?.config, onboarding?.loading ?? true),
    [onboarding?.config, onboarding?.loading]
  )

  const stepLabels = useMemo(
    () => (enabledSteps ?? []).map((s) => s.title.replace(/ /g, "\n")),
    [enabledSteps]
  )

  const stepRoutes = useMemo(
    () => (enabledSteps ?? []).map((s) => routeForApplicantStep(s, slug)),
    [enabledSteps, slug]
  )

  const currentStep = useMemo(() => {
    if (currentStepOverride != null) return currentStepOverride
    if (!enabledSteps?.length) return 1
    return stepIndexFromPathname(pathname || "", enabledSteps, search)
  }, [currentStepOverride, pathname, enabledSteps, search])

  const maxAllowedStep = onboarding?.maxAllowedStepIndex ?? currentStep

  const progressByStepId = useMemo(() => {
    const m = new Map<string, OnboardingStepStatus>()
    for (const p of onboarding?.progress?.steps ?? []) {
      m.set(p.onboarding_step_id, p.status)
    }
    return m
  }, [onboarding?.progress?.steps])

  const stepStates = useMemo(() => {
    if (!enabledSteps?.length) return [] as StepIndicatorState[]
    return enabledSteps.map((configStep, index) =>
      deriveStepIndicatorState({
        dbStatus: progressByStepId.get(configStep.id) ?? "pending",
        stepNumber: index + 1,
        currentStepNumber: currentStep,
        isRequired: configStep.is_required !== false,
      })
    )
  }, [enabledSteps, progressByStepId, currentStep])

  if (!enabledSteps?.length) {
    return onboarding?.loading ? (
      <div className="h-16 w-full animate-pulse rounded-lg bg-slate-100" />
    ) : (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
        No onboarding steps are configured for this workflow.
      </div>
    )
  }

  const furthestStep = furthestProgressStepIndex(stepStates, currentStep)

  return (
    <>
      <div className="w-full border-b border-slate-200 pb-4 sm:pb-6" style={brandingToCssVars(branding)}>
        <div className="relative mx-auto mt-2 w-full max-w-3xl px-1 sm:px-2">
          <div className="scrollbar-hide -mx-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-2">
            <div
              className="grid w-full min-w-[680px] max-[399px]:min-w-[520px] sm:min-w-0"
              style={{ gridTemplateColumns: `repeat(${stepLabels.length}, minmax(0, 1fr))` }}
            >
            {stepLabels.map((step, index) => {
              const stepNumber = index + 1
              const configStep = enabledSteps[index]!
              const state = stepStates[index] ?? "not_started"
              const isClickable = isStepIndicatorAccessible(state, stepNumber, maxAllowedStep)
              const connectorFilled = furthestStep > index + 1

              return (
                <div key={`${configStep.id}-${step}`} className="relative flex min-w-0 flex-col items-center">
                  {index < stepLabels.length - 1 ? (
                    <ConnectorSegment filled={connectorFilled} />
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      if (!isClickable) return
                      push(stepRoutes[index])
                    }}
                    disabled={!isClickable}
                    className={`group relative z-10 flex w-full max-w-[84px] flex-col items-center rounded-lg px-1 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)]/40 max-[399px]:max-w-[68px] max-[399px]:px-0.5 sm:max-w-24 sm:px-1.5 ${
                      isClickable ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
                    aria-label={`${isClickable ? "Go to" : "Locked"} ${step.replace("\n", " ")}${
                      state === "skipped" ? " (skipped)" : state === "required_missing" ? " (required)" : ""
                    }`}
                    title={`${isClickable ? "Go to" : "Locked"} ${step.replace("\n", " ")}`}
                  >
                    <div className={stepCircleClass(state)}>
                      <StepIcon state={state} />
                    </div>

                    <span
                      className={`mt-2.5 whitespace-pre-line text-[11px] leading-tight max-[399px]:mt-2 max-[399px]:text-[10px] sm:mt-3 sm:text-[12px] ${stepLabelClass(state)} ${
                        isClickable ? "group-hover:text-[color:var(--brand-primary)] group-hover:underline" : ""
                      }`}
                    >
                      {step}
                    </span>
                  </button>
                </div>
              )
            })}
            </div>
          </div>
        </div>
      </div>

      {title ? (
        <div className="mt-8 flex items-center gap-3">
          {titleIconSrc ? (
            <Image
              src={titleIconSrc}
              alt={titleIconAlt ?? ""}
              width={24}
              height={24}
              className="h-6 w-6"
            />
          ) : null}
          <div className="text-[24px] font-semibold leading-8 text-slate-800">{title}</div>
        </div>
      ) : null}
    </>
  )
}
