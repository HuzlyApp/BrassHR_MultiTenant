import { Shield, ShieldAlert, ShieldX } from "lucide-react"
import type { DocumentVerificationResult } from "@/lib/document-verification"

type AiPreScanBannerProps = {
  result: DocumentVerificationResult | null
  loading?: boolean
  error?: string | null
}

const STATUS_STYLES = {
  valid: {
    container: "border-[#166534] bg-[#DCFCE7]",
    icon: "text-[#15803D]",
    headline: "text-[#15803D]",
    detail: "text-[#166534]",
    Icon: Shield,
    label: "VERIFIED",
  },
  warning: {
    container: "border-[#B45309] bg-[#FEF3C7]",
    icon: "text-[#B45309]",
    headline: "text-[#B45309]",
    detail: "text-[#92400E]",
    Icon: ShieldAlert,
    label: "NEEDS REVIEW",
  },
  invalid: {
    container: "border-[#B91C1C] bg-[#FEE2E2]",
    icon: "text-[#B91C1C]",
    headline: "text-[#B91C1C]",
    detail: "text-[#991B1B]",
    Icon: ShieldX,
    label: "SUSPICIOUS",
  },
} as const

export default function AiPreScanBanner({ result, loading, error }: AiPreScanBannerProps) {
  if (loading) {
    return (
      <div className="mx-5 mb-3 rounded-md border border-[#D1D5DB] bg-[#F9FAFB] px-4 py-3">
        <p className="text-xs font-medium text-[#6B7280]">Running AI pre-scan...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-5 mb-3 rounded-md border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3">
        <p className="text-xs font-semibold text-[#B91C1C]">AI PRE-SCAN — UNAVAILABLE</p>
        <p className="mt-1 text-xs text-[#991B1B]">{error}</p>
      </div>
    )
  }

  if (!result) return null

  const styles = STATUS_STYLES[result.status]
  const Icon = styles.Icon

  return (
    <div
      className={`mx-5 mb-3 flex gap-3 rounded-md border px-4 py-3 ${styles.container}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${styles.icon}`} aria-hidden />
      <div className="min-w-0">
        <p className={`text-xs font-bold uppercase tracking-wide ${styles.headline}`}>
          AI PRE-SCAN — {styles.label}
        </p>
        <p className={`mt-1 text-xs leading-5 ${styles.detail}`}>{result.detail}</p>
      </div>
    </div>
  )
}
