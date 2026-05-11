
"use client"

import Image from "next/image"
import { Check } from "lucide-react"

export default function DocumentReceivedPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#27c8c0_0%,#16a79a_100%)] flex items-center justify-center p-6 md:p-12">
      <div className="w-full max-w-[840px] w-[840px] h-[500px] overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_rgba(0,0,0,0.18)]">
        <div className="flex h-full w-full">
          {/* Left side layout */}
          <div className="w-[510px] h-[500px] flex flex-col items-center justify-center pt-[56px] pr-[40px] pb-[40px] pl-[40px] text-center">
            <div className="flex flex-col items-center gap-[36px] mt-auto mb-auto">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#28c7bf] text-white shadow-sm flex-none">
                <Check className="h-8 w-8" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-[32px] font-semibold text-slate-900 tracking-[-0.03em]">
                  Document Received
                </h1>
                <p className="mt-4 text-[16px] leading-[26px] text-slate-600 max-w-[340px] mx-auto">
                  We’ll contact you within 1–3 business days
                  and please check your email for the
                  latest update.
                </p>
              </div>
            </div>
          </div>

          {/* Right side layout */}
          <div className="relative hidden md:flex w-[330px] h-[500px] p-[20px] flex flex-col gap-[24px] items-center justify-center overflow-hidden bg-white">
            <Image
              src="/images/verification-status.jpg"
              alt="Nurse background"
              fill
              className="object-cover bg-white/65 grayscale opacity-60"
              priority
            />
            <div className="absolute inset-0 bg-white/65" />
            <div className="relative flex flex-col items-center justify-center gap-[24px] text-center w-full">
              <div className="relative h-16 w-44">
                <Image
                  src="/images/new-logo-nexus.svg"
                  alt="Nexus MedPro Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div className="flex w-full items-center justify-center gap-3">
                <div className="h-px flex-1 bg-slate-300/70" />
                <Image
                  src="/icons/circle-star-icon.svg"
                  alt="Star icon"
                  width={24}
                  height={24}
                  className="object-contain"
                />
                <div className="h-px flex-1 bg-slate-300/70" />
              </div>
              <p className="max-w-[240px] text-[14px] leading-6 text-slate-700">
                Nexus MedPro Staffing – Connecting Healthcare professionals with service providers
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}







