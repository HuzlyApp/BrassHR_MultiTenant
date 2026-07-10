"use client"

import type { CSSProperties } from "react"
import { applicationPath } from "@/lib/tenant/with-tenant"
import { useEffect, useState } from "react"
import Link from "next/link"
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { brandingToCssVars, hexToRgba } from "@/lib/tenant/tenant-branding"

type UploadedI9File = {
  name: string
  sizeLabel: string
}

const W2_SIGNED_KEY = "employeeAgreementW2Signed"
const I9_FILE_KEY = "employeeAgreementI9File"

function ActionFileRow({
  fileName,
  actionLabel,
  onAction,
  primaryHex,
}: {
  fileName: string
  actionLabel: string
  onAction?: () => void
  primaryHex: string
}) {
  return (
    <div className="flex h-[72px] w-full max-w-[650px] items-center justify-between gap-5 rounded-xl border border-[color:var(--brand-primary)] bg-white px-4">
      <div className="flex min-w-0 items-center gap-4">
        <BrandedSvgIcon
          src="/icons/pdf-icon.svg"
          className="h-6 w-6 flex-none"
          color={primaryHex}
        />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-normal leading-5 text-[color:var(--brand-primary)]">
            {fileName}
          </p>
          <p className="text-[10px] font-normal leading-[15px] text-slate-500">Required</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onAction}
        className="inline-flex h-11 cursor-pointer flex-none items-center justify-center rounded-xl border border-[color:var(--brand-primary)] bg-white px-5 text-[14px] font-semibold leading-5 text-[color:var(--brand-primary)] transition hover:bg-[color:var(--brand-primary)]/5"
      >
        {actionLabel}
      </button>
    </div>
  )
}

function CompletedFileRow({
  fileName,
  secondaryText,
  rightSlot,
  completedSurfaceStyle,
  primaryHex,
}: {
  fileName: string
  secondaryText?: string
  rightSlot: React.ReactNode
  completedSurfaceStyle: CSSProperties
  primaryHex: string
}) {
  return (
    <div
      className="flex h-[72px] w-full max-w-[650px] items-center justify-between gap-4 rounded-lg border px-4 py-[14px]"
      style={completedSurfaceStyle}
    >
      <div className="flex min-w-0 items-center gap-3">
        <BrandedSvgIcon
          src="/icons/pdf-icon.svg"
          className="h-5 w-5 flex-none"
          color={primaryHex}
        />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-normal leading-5 text-[color:var(--brand-primary)]">
            {fileName}
          </p>
          {secondaryText ? (
            <p className="text-[10px] font-normal leading-[15px] text-slate-500">{secondaryText}</p>
          ) : null}
        </div>
      </div>
      {rightSlot}
    </div>
  )
}

export default function EmployeeAgreementPage() {
  const branding = useTenantBranding()
  const [w2Signed, setW2Signed] = useState(false)
  const [uploadedI9, setUploadedI9] = useState<UploadedI9File | null>(null)

  const contentStyle = brandingToCssVars(branding) as CSSProperties
  const brandSoftBgStyle = { backgroundColor: hexToRgba(branding.primaryHex, 0.06) } as CSSProperties
  const completedSurfaceStyle = {
    borderColor: branding.primaryHex,
    backgroundColor: hexToRgba(branding.primaryHex, 0.08),
  } as CSSProperties
  const primaryBtnStyle = { backgroundColor: branding.primaryHex } as CSSProperties
  const signedBadgeStyle = { backgroundColor: branding.primaryHex } as CSSProperties

  useEffect(() => {
    const signedValue = localStorage.getItem(W2_SIGNED_KEY)
    setW2Signed(signedValue === "true")

    const uploadedValue = localStorage.getItem(I9_FILE_KEY)
    if (!uploadedValue) {
      setUploadedI9(null)
      return
    }

    try {
      const parsed = JSON.parse(uploadedValue) as UploadedI9File
      if (parsed?.name && parsed?.sizeLabel) {
        setUploadedI9(parsed)
      }
    } catch {
      localStorage.removeItem(I9_FILE_KEY)
      setUploadedI9(null)
    }
  }, [])

  const handleSignW2 = () => {
    setW2Signed(true)
    localStorage.setItem(W2_SIGNED_KEY, "true")
  }

  const handleDeleteI9 = () => {
    setUploadedI9(null)
    localStorage.removeItem(I9_FILE_KEY)
  }

  const hasUploadedI9 = Boolean(uploadedI9)

  return (
    <OnboardingLayout
      rightPanelImageClassName="object-cover object-center opacity-60"
      rightPanelOverlayClassName="bg-white/65"
      rightPanelContentClassName="p-5"
      rightPanelInnerClassName="max-w-[290px] gap-8"
      logoClassName="h-[72px] w-[240px]"
      taglineClassName="max-w-[310px] text-[15px] leading-8 text-slate-900"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-14" style={contentStyle}>
        <div className="flex flex-1 flex-col">
          <div className="max-w-[650px]">
            <h1 className="text-[24px] font-semibold leading-8 text-slate-900">
              Employee Agreement W2 &amp; I9
            </h1>
            <p className="mt-5 text-[14px] font-normal leading-5 text-slate-700">
              Confirms that the employee has reviewed and signed the employment agreement and
              completed the Form I-9, verifying identity and work authorization requirements as part
              of the onboarding process.
            </p>
          </div>

          <div className="mt-8 max-w-[650px]">
            <h2 className="text-[18px] font-semibold leading-7 text-slate-900">W2 Form eSign</h2>
            <div className="mt-4">
              {w2Signed ? (
                <CompletedFileRow
                  fileName="Employee Agreement W2.pdf"
                  completedSurfaceStyle={completedSurfaceStyle}
                  primaryHex={branding.primaryHex}
                  rightSlot={
                    <span
                      className="inline-flex h-7 items-center rounded-md px-3 text-[12px] font-semibold leading-4 text-white"
                      style={signedBadgeStyle}
                    >
                      Signed
                    </span>
                  }
                />
              ) : (
                <ActionFileRow
                  fileName="Employee Agreement W2.pdf"
                  actionLabel="Click and Sign"
                  onAction={handleSignW2}
                  primaryHex={branding.primaryHex}
                />
              )}
            </div>
          </div>

          <div className="mt-6 max-w-[650px]">
            <h2 className="text-[18px] font-semibold leading-7 text-slate-900">I9 Form</h2>
            <div className="mt-4">
              {hasUploadedI9 && uploadedI9 ? (
                <CompletedFileRow
                  fileName={uploadedI9.name}
                  secondaryText={uploadedI9.sizeLabel}
                  completedSurfaceStyle={completedSurfaceStyle}
                  primaryHex={branding.primaryHex}
                  rightSlot={
                    <button
                      type="button"
                      onClick={handleDeleteI9}
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[color:var(--brand-primary)] transition hover:brightness-95"
                      style={brandSoftBgStyle}
                      aria-label="Remove uploaded I9 form"
                    >
                      <BrandedSvgIcon
                        src="/icons/delete-icon.svg"
                        className="h-6 w-6"
                        color={branding.primaryHex}
                      />
                    </button>
                  }
                />
              ) : (
                <>
                  <ActionFileRow
                    fileName="I9 Form.pdf"
                    actionLabel="Download"
                    primaryHex={branding.primaryHex}
                  />
                  <p className="mt-4 text-[14px] font-normal leading-5 text-slate-500">
                    Note: Once you downloaded the form, click next to upload the signed I9 form.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="mt-auto grid grid-cols-2 gap-3 pt-8 sm:flex sm:items-center sm:justify-end sm:gap-4 sm:pt-10">
            <Link
              href={applicationPath("/application/application-status")}
              className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-xl border border-[color:var(--brand-primary)] bg-white px-4 text-[16px] font-semibold leading-6 text-[color:var(--brand-primary)] transition hover:bg-[color:var(--brand-primary)]/5 sm:w-auto sm:px-6"
            >
              Back
            </Link>

            {hasUploadedI9 ? (
              <Link
                href={applicationPath("/application/document-received")}
                className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-xl px-4 text-[16px] font-semibold leading-6 text-white transition hover:brightness-90 sm:w-auto sm:px-6"
                style={primaryBtnStyle}
              >
                Save
              </Link>
            ) : (
              <Link
                href={applicationPath("/application/upload-19-form")}
                className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-xl px-4 text-[16px] font-semibold leading-6 text-white transition hover:brightness-90 sm:w-auto sm:px-6"
                style={primaryBtnStyle}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
