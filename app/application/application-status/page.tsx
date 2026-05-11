

"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import OnboardingLayout from "@/app/components/OnboardingLayout"

type StatusView = "pending" | "approved"

export default function ApplicationStatusPage() {
  /** Default pending; replace with real status when wired. Browse Shift is disabled. */
  const [statusView] = useState<StatusView>("pending")

  const isApproved = statusView === "approved"

  return (
    <OnboardingLayout
      cardClassName="md:grid-cols-[660px_400px]"
      rightPanelImageSrc="/images/verification-status.jpg"
      rightPanelImageClassName="object-cover object-center grayscale opacity-60"
      rightPanelOverlayClassName="bg-white/65"
      rightPanelContentClassName="p-5"
      rightPanelInnerClassName="max-w-[300px] gap-8"
      logoClassName="h-[72px] w-[240px]"
      taglineClassName="max-w-[300px] text-[15px] leading-8 text-slate-900"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-14">
        <div className="flex flex-1 flex-col gap-9">
          <h1 className="text-[24px] font-semibold leading-8 text-slate-900">
            {isApproved ? "Application Submitted" : "Verification Status"}
          </h1>

          <div className="flex h-[486px] w-full flex-col gap-5">
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Image
                    src={isApproved ? "/icons/approved.svg" : "/icons/pending.svg"}
                    alt={isApproved ? "Approved status" : "Pending status"}
                    width={30}
                    height={30}
                    className="h-[30px] w-[30px]"
                  />
                  <span className="text-[18px] font-semibold leading-7 text-slate-900">
                    {isApproved ? "Approved" : "Pending"}
                  </span>
                </div>

                <span
                  className={`inline-flex min-h-9 items-center rounded-full px-4 text-[14px] font-medium leading-5 text-white ${isApproved ? "bg-[#2ec9b5]" : "bg-[#f59e0b]"
                    }`}
                >
                  {isApproved ? "Approved" : "Pending"}
                </span>
              </div>

              <div className="flex flex-1 flex-col px-4 pb-6 pt-5">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-[20px] font-semibold leading-7 text-slate-900">
                    {isApproved ? "Application Approved" : "Application Submitted"}
                  </h2>
                  <span className="text-[14px] font-normal leading-5 text-slate-500">
                    {isApproved ? "2/24/2026" : "2/12/2025"}
                  </span>
                </div>

                {isApproved ? (
                  <div className="mt-4 max-w-[500px] space-y-5 text-[16px] font-normal leading-6 text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-900">
                        Congratulations!
                      </span>{" "}
                      Your application was approved.
                      <br />
                      You can now claim a shift. Click the button below to browse
                      a shift.
                    </p>
                    <p>
                      We also send you an email about the status on your
                      application and the next step.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 max-w-[500px] space-y-5 text-[16px] font-normal leading-6 text-slate-700">
                    <p>
                      Current status is pending and will provide you updates
                      within 48 hours.
                    </p>
                    <p>
                      You can come back later to check this status. We will also
                      email you regarding the verification updates on your
                      application. Thanks
                    </p>
                  </div>
                )}
              </div>
            </section>

            <div className="flex justify-end">
              {isApproved ? (
                <Link
                  href="/application/employee-agreement"
                  className="inline-flex min-w-[185px] h-11 items-center justify-center gap-2 rounded-lg bg-[#0ea5a4] px-4 py-2.5 text-[16px] font-semibold leading-6 text-white transition hover:bg-[#0c8d8b]"
                >
                  Sign Employee Agreement
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="inline-flex h-11 w-[150px] cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[16px] font-semibold leading-6 text-slate-400 opacity-70"
                >
                  Browse Shift
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}

