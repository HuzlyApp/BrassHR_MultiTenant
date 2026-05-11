
"use client"

import { useRouter } from "next/navigation"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"

export default function SkillAssessmentIntro() {
    const router = useRouter()

    const proficiencyLevels = [
        {
            level: 1,
            label: "No Experience",
            description: "Theory or observation only during the past 12 months."
        },
        {
            level: 2,
            label: "Limited Experience",
            description:
                "Performed less than 12 times within the past 12 months and may need a review."
        },
        {
            level: 3,
            label: "Experienced",
            description:
                "Performed at least once per month within the past 12 months and may need minimal assistance."
        },
        {
            level: 4,
            label: "Highly Skilled",
            description:
                "Performed on at least a weekly basis over the past 12 months; proficient."
        }
    ]

    return (
        <OnboardingLayout
            cardClassName="md:h-auto md:min-h-[700px]"
            rightPanelImageSrc="/images/skill-bg.jpg"
            rightPanelImageClassName="opacity-60 object-top"
            rightPanelOverlayClassName="bg-white/65"
        >
            <div className="flex h-full flex-col px-10 pb-10 pt-8">
                <OnboardingStepper currentStep={3} completedThrough={2} />

                <div className="flex flex-1 flex-col pt-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[24px] font-semibold leading-8 text-slate-800">
                            Skill Assessment Quiz
                        </h2>
                        <button
                            type="button"
                            onClick={() => router.push("/application/step-3-assessment")}
                            className="cursor-pointer text-[12px] font-medium leading-5 text-[#1db4a3]"
                        >
                            Skip for Now →
                        </button>
                    </div>

                    {/* Description */}
                    <p className="text-[13px] font-normal leading-5 text-slate-600 mb-8">
                        This checklist is meant to serve as a general guideline for our client
                        facilities as to the level of your skills within your nursing specialty.
                        Please use the scale below to describe your experience/expertise in each
                        area listed below.
                    </p>

                    {/* Proficiency Scale */}
                    <p className="text-[14px] font-semibold text-slate-800 mb-4">
                        Proficiency Scale:
                    </p>

                    <div className="flex flex-col divide-y divide-slate-200 border-t border-slate-200">
                        {proficiencyLevels.map(({ level, label, description }) => (
                            <div key={level} className="flex items-start gap-3 py-4 text-[13px]">
                                <span className="font-bold text-slate-800 w-3 shrink-0 pt-0.5">
                                    {level}
                                </span>
                                <span className="text-slate-500 shrink-0 pt-0.5">=</span>
                                <span className="text-[#1db4a3] font-semibold w-40 shrink-0 pt-0.5">
                                    {label}
                                </span>
                                <span className="text-slate-600 leading-5">{description}</span>
                            </div>
                        ))}
                    </div>

                    {/* Buttons */}
                    <div className="mt-auto flex items-center justify-end gap-3 pt-8">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="cursor-pointer rounded-md border border-slate-300 px-5 py-2 text-[12px] font-medium leading-5 text-slate-600 transition hover:bg-slate-50"
                        >
                            Back
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push("/application/step-3-assessment")}
                            className="cursor-pointer rounded-md bg-[#1db4a3] px-6 py-2 text-[12px] font-medium leading-5 text-white transition hover:bg-[#189d8e]"
                        >
                            Start Skill Assessment
                        </button>
                    </div>
                </div>
            </div>
        </OnboardingLayout>
    )
}
