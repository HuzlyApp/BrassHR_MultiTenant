"use client"

import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { useSearchParams } from "next/navigation"
import OnboardingLayout from "@/app/components/OnboardingLayout"

function VerificationStatusContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get("status")
  const isRejected = status === "rejected"

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
          <h1 className="text-[24px] font-semibold leading-8 text-slate-800">
            Verification Status
          </h1>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <Image
                  src={isRejected ? "/icons/denied.svg" : "/icons/pending-verification.svg"}
                  alt={isRejected ? "Application denied" : "Pending verification"}
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
                <span className="text-xl font-semibold leading-10 text-black">
                  {isRejected ? "Application Denied" : "Pending Verification"}
                </span>
              </div>

              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-[14px] font-medium leading-5 text-white ${isRejected ? "bg-[#fb7185]" : "bg-[#f59e0b]"}`}
              >
                {isRejected ? "Denied" : "Pending"}
              </span>
            </div>

            <div className="space-y-6 p-5 text-[16px] font-normal leading-8 text-slate-700">
              <div className="flex items-start justify-between gap-4">
                <p className="text-black">Status</p>
                <p className="text-slate-500">{isRejected ? "2/24/2026" : "2/12/2025"}</p>
              </div>

              {isRejected ? (
                <>
                  <p>
                    We regret to inform you that as of now your application for
                    healthcare position is currently denied due to lack of
                    information details.
                  </p>
                  <p>Thank you.</p>
                </>
              ) : (
                <>
                  <p>
                    Application was pending because additional requirements
                    needed for the application.
                  </p>

                  <div className="space-y-3">
                    <p>Following additional requirement(s) needed:</p>
                    <p className="font-semibold text-slate-800">
                      1. Latest birth certificate
                    </p>
                  </div>

                  <p>
                    You are given 24 hours to upload and submit the requirements
                    needed.
                  </p>

                  <p>Please only upload the requirement in this page.</p>
                  <p>Thank you.</p>
                </>
              )}
            </div>

            {isRejected ? (
              <div className="space-y-4 border-t border-slate-200 px-4 pb-5 pt-4">
                <p className="text-[16px] font-normal leading-7 text-slate-700">
                  Please contact support for assistance.
                </p>

                <div className="grid grid-cols-3 gap-3">
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

          <div className="mt-auto flex justify-end pt-3">
            {isRejected ? (
              <Link
                href="/"
                className="inline-flex h-11 min-w-[100px] items-center justify-center rounded-lg border border-[#0D9488] px-7 text-[16px] font-semibold leading-8 text-[#0D9488] transition hover:bg-[#f0fffe]"
              >
                Exit
              </Link>
            ) : (
              <Link
                href="/application/upload-form?type=files"
                className="inline-flex h-11 min-w-[273px] items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-6 text-[16px] font-semibold leading-6 text-white transition hover:bg-[#0b7a70]"
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
