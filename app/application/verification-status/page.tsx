"use client"

import type { CSSProperties } from "react"
import { applicationPath } from "@/lib/tenant/with-tenant"
import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { useSearchParams } from "next/navigation"
import {
  APPLICANT_ACTION_ROW,
  APPLICANT_BTN_PRIMARY,
  APPLICANT_SHELL_TALL_CLASS,
  APPLICANT_TITLE_CLASS,
} from "@/app/application/applicant-onboarding-responsive"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import ApplicantRecruiterNotes from "@/app/application/components/ApplicantRecruiterNotes"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { brandingToCssVars } from "@/lib/tenant/tenant-branding"

function VerificationStatusContent() {
  const branding = useTenantBranding()
  const searchParams = useSearchParams()
  const status = searchParams.get("status")
  const isRejected = status === "rejected"
  const contentStyle = brandingToCssVars(branding) as CSSProperties
  const primaryBtnStyle = { backgroundColor: branding.primaryHex } as CSSProperties

  return (
    <OnboardingLayout
      cardClassName="md:grid-cols-[660px_400px]"
      rightPanelImageClassName="object-cover object-center grayscale opacity-60"
      rightPanelOverlayClassName="bg-white/65"
      rightPanelContentClassName="p-5"
      rightPanelInnerClassName="max-w-[300px] gap-8"
      logoClassName="h-[72px] w-[240px]"
      taglineClassName="max-w-[300px] text-[15px] leading-8 text-slate-900"
    >
      <div className={APPLICANT_SHELL_TALL_CLASS} style={contentStyle}>
        <div className="flex flex-1 flex-col gap-6 sm:gap-9">
          <h1 className={APPLICANT_TITLE_CLASS}>Verification Status</h1>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2.5 sm:px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <Image
                  src={isRejected ? "/icons/denied.svg" : "/icons/pending-verification.svg"}
                  alt={isRejected ? "Application denied" : "Pending verification"}
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0"
                />
                <span className="truncate text-base font-semibold leading-7 text-black sm:text-xl sm:leading-10">
                  {isRejected ? "Application Denied" : "Pending Verification"}
                </span>
              </div>

              <span
                className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[13px] font-medium leading-5 text-white sm:px-3 sm:text-[14px] ${isRejected ? "bg-[#fb7185]" : "bg-[#f59e0b]"}`}
              >
                {isRejected ? "Denied" : "Pending"}
              </span>
            </div>

            <div className="space-y-4 p-4 text-sm font-normal leading-6 text-slate-700 sm:space-y-6 sm:p-5 sm:text-[16px] sm:leading-8">
              <ApplicantRecruiterNotes
                title={isRejected ? "Message from recruiter" : "What you need to do"}
                emptyMessage={
                  isRejected
                    ? "Your application was not approved. Please contact support if you need help."
                    : "Your application is being reviewed. Your recruiter will add instructions here when needed."
                }
              />
            </div>

            {isRejected ? (
              <div className="space-y-4 border-t border-slate-200 px-4 pb-5 pt-4">
                <p className="text-[16px] font-normal leading-7 text-slate-700">
                  Please contact support for assistance.
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <Image
                      src="/icons/phone.svg"
                      alt="Call support"
                      width={24}
                      height={24}
                      className="h-6 w-6"
                    />
                    <span className="text-[16px] font-normal leading-6 text-slate-700">
                      Call
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Image
                      src="/icons/chat.svg"
                      alt="Chat support"
                      width={24}
                      height={24}
                      className="h-6 w-6"
                    />
                    <span className="text-[16px] font-normal leading-6 text-slate-700">
                      Chat
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Image
                      src="/icons/support-icon.svg"
                      alt="Support email"
                      width={24}
                      height={24}
                      className="h-6 w-6"
                    />
                    <span className="text-[16px] font-normal leading-6 text-slate-700">
                      support@huzly.com
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <div className={APPLICANT_ACTION_ROW}>
            {isRejected ? (
              <Link
                href="/"
                className={`${APPLICANT_BTN_PRIMARY} col-span-2 border border-[color:var(--brand-primary)] bg-white text-[color:var(--brand-primary)] hover:bg-[color:var(--brand-primary)]/5 sm:col-span-1 sm:col-start-2`}
              >
                Exit
              </Link>
            ) : (
              <Link
                href={applicationPath("/application/upload-form?type=files")}
                className={`${APPLICANT_BTN_PRIMARY} col-span-2 inline-flex items-center justify-center gap-2 sm:col-span-1 sm:col-start-2`}
                style={primaryBtnStyle}
              >
                Upload Requirements
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}

export default function VerificationStatusPage() {
  return (
    <Suspense fallback={null}>
      <VerificationStatusContent />
    </Suspense>
  )
}
