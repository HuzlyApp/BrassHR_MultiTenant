"use client"



import Image from "next/image"

import { Check } from "lucide-react"

import { useEffect, useMemo } from "react"

import { usePathname } from "next/navigation"

import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider"

import { routeForOnboardingStep } from "@/lib/onboarding/step-routes"

import {

  resolveApplicantEnabledSteps,

  stepIndexFromPathname,

} from "@/lib/onboarding/tenant-step-navigation"

import { useOnboardingTenant } from "@/lib/tenant/use-onboarding-tenant"

import type { OnboardingStepType } from "@/lib/onboarding/types"



interface Props {

  /** Optional override; otherwise derived from pathname + tenant steps. */

  currentStep?: number

  completedThrough?: number

  title?: string

  titleIconSrc?: string

  titleIconAlt?: string

}



export default function OnboardingStepper({

  currentStep: currentStepOverride,

  completedThrough,

  title,

  titleIconSrc,

  titleIconAlt,

}: Props) {

  const { slug, push, replace } = useOnboardingTenant()

  const pathname = usePathname()

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

    () =>

      (enabledSteps ?? []).map((s) =>

        routeForOnboardingStep(s.step_key, s.step_type as OnboardingStepType)

      ),

    [enabledSteps]

  )



  const currentStep = useMemo(() => {

    if (currentStepOverride != null) return currentStepOverride

    if (!enabledSteps?.length) return 1

    return stepIndexFromPathname(pathname || "", enabledSteps)

  }, [currentStepOverride, pathname, enabledSteps])



  const maxAllowedStep = onboarding?.maxAllowedStepIndex ?? currentStep



  const progressByStepId = useMemo(() => {

    const m = new Map<string, string>()

    for (const p of onboarding?.progress?.steps ?? []) {

      m.set(p.onboarding_step_id, p.status)

    }

    return m

  }, [onboarding?.progress?.steps])



  useEffect(() => {

    if (!enabledSteps?.length || onboarding?.loading || !slug) return

    const earnedThrough = completedThrough ?? 0

    if (currentStep > maxAllowedStep && earnedThrough < currentStep - 1) {

      const targetPath = stepRoutes[Math.max(0, maxAllowedStep - 1)] ?? stepRoutes[0]

      if (!targetPath || pathname?.includes(targetPath.split("?")[0])) return

      replace(targetPath)

    }

  }, [

    enabledSteps,

    onboarding?.loading,

    maxAllowedStep,

    currentStep,

    completedThrough,

    replace,

    stepRoutes,

    slug,

    pathname,

  ])



  if (!enabledSteps?.length) {

    return onboarding?.loading ? (

      <div className="h-16 w-full animate-pulse rounded-lg bg-slate-100" />

    ) : null

  }



  const progress =

    currentStep === stepLabels.length

      ? ((stepLabels.length - 2) / Math.max(stepLabels.length - 1, 1)) * 100

      : ((currentStep - 1) / Math.max(stepLabels.length - 1, 1)) * 100



  return (

    <>

      <div className="w-full border-b border-slate-200 pb-6">

        <div className="relative mx-auto mt-2 w-full max-w-3xl px-2">

          <div className="absolute left-10 right-10 top-3 h-[2px] bg-[#f1f5f9]" />



          <div

            className="absolute left-10 top-3 h-[2px] bg-[#1db4a3] transition-all"

            style={{ width: `${progress}%` }}

          />



          <div className="relative flex justify-between">

            {stepLabels.map((step, index) => {

              const stepNumber = index + 1

              const configStep = enabledSteps[index]

              const dbCompleted =

                configStep &&

                (progressByStepId.get(configStep.id) === "completed" ||

                  progressByStepId.get(configStep.id) === "skipped")

              const completed =

                dbCompleted || stepNumber <= (completedThrough ?? currentStep - 1)

              const active = stepNumber === currentStep

              const maxAccessibleStep = Math.min(completedThrough ?? currentStep, maxAllowedStep)

              const isClickable = stepNumber <= maxAccessibleStep



              return (

                <button

                  key={`${configStep.id}-${step}`}

                  type="button"

                  onClick={() => {

                    if (!isClickable) return

                    push(stepRoutes[index])

                  }}

                  disabled={!isClickable}

                  className={`group flex w-24 flex-col items-center rounded-lg px-1.5 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1db4a3]/40 ${

                    isClickable ? "cursor-pointer" : "cursor-not-allowed"

                  }`}

                  aria-label={`${isClickable ? "Go to" : "Locked"} ${step.replace("\n", " ")}`}

                  title={`${isClickable ? "Go to" : "Locked"} ${step.replace("\n", " ")}`}

                >

                  <div

                    className={`

                      z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full text-sm font-semibold transition-colors

                      ${

                        completed

                          ? "bg-[#1db4a3] text-white outline outline-[4px] outline-white"

                          : active

                            ? "bg-white border-[3px] border-[#1db4a3] outline outline-[4px] outline-white"

                            : "bg-white border-[3px] border-[#f1f5f9] outline outline-[4px] outline-white"

                      }

                    `}

                  >

                    {completed ? (

                      <Check size={14} strokeWidth={3} />

                    ) : active ? (

                      <span className="h-2.5 w-2.5 rounded-full bg-[#1db4a3]" />

                    ) : (

                      <span className="h-2.5 w-2.5 rounded-full bg-[#e2e8f0]" />

                    )}

                  </div>



                  <span

                    className={`mt-3 whitespace-pre-line text-[12px] leading-tight

                      ${

                        active || completed

                          ? "text-[#1db4a3] font-medium"

                          : "text-gray-400"

                      }

                    ${isClickable ? "group-hover:text-[#1db4a3] group-hover:underline" : ""}`}

                  >

                    {step}

                  </span>

                </button>

              )

            })}

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

          <div className="text-[24px] font-semibold leading-8 text-slate-800">

            {title}

          </div>

        </div>

      ) : null}

    </>

  )

}


