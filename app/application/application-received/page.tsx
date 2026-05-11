"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"

export default function ApplicationReceivedPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-r from-[#0CC8B0] to-[#0AAE9E] flex items-center justify-center p-6 md:p-12">
      <div className="w-full max-w-[900px] bg-white rounded-2xl shadow-2xl flex overflow-hidden">
        <div className="flex-1 p-8 md:p-10 flex flex-col justify-center">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2">Application Received</h1>
          <p className="text-sm text-gray-600 mb-8 max-w-[420px]">
            We’ll contact you within 1–3 business days. Thanks for completing your application.
          </p>

          <div>
            <button
              type="button"
              onClick={() => router.push("/admin_recruiter/dashboard")}
              className="bg-teal-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-teal-700 transition"
            >
              Go to Dashboard
            </button>
          </div>
        </div>

        <div className="w-[360px] relative hidden md:block">
          <Image src="/images/nurse.jpg" alt="" fill className="object-cover grayscale opacity-60" priority />
          <div className="absolute inset-0 bg-white/65" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
            <Image src="/images/nexus-logo.png" alt="logo" width={160} height={56} className="mb-4" />
            <p className="text-gray-700 text-sm">
              Nexus MedPro Staffing – Connecting Healthcare professionals with service providers
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

