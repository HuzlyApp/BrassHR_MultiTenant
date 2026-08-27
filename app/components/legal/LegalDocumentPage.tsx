"use client"

import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import type { CSSProperties } from "react"
import { useEffect, useRef, useState } from "react"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import type { LegalDocument } from "@/lib/legal/types"
import { brandingShellGradient, brandingToCssVars } from "@/lib/tenant/tenant-branding"

type LegalDocumentPageProps = {
  document: LegalDocument
  /** Optional fallback when browser history has nothing to go back to. */
  fallbackHref?: string
}

function resolveReturnHref(fallbackHref: string): string {
  if (typeof window === "undefined") return fallbackHref
  try {
    const returnTo = new URLSearchParams(window.location.search).get("returnTo")
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      return returnTo
    }
  } catch {
    /* ignore */
  }
  return fallbackHref
}

export default function LegalDocumentPage({
  document,
  fallbackHref = "/signup",
}: LegalDocumentPageProps) {
  const branding = useTenantBranding()
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(false)
  const [returnHref, setReturnHref] = useState(fallbackHref)

  const shellStyle: CSSProperties = {
    ...brandingToCssVars(branding),
    background: brandingShellGradient(branding),
  }

  useEffect(() => {
    setReturnHref(resolveReturnHref(fallbackHref))
  }, [fallbackHref])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8
    if (reachedBottom) setIsAtBottom(true)
  }, [document.title])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8
    if (reachedBottom) setIsAtBottom(true)
  }

  function goBackToFlow() {
    router.push(returnHref)
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4 sm:p-6 md:p-8"
      style={shellStyle}
    >
      <div className="flex w-full max-w-4xl flex-col rounded-xl bg-white p-4 shadow-2xl sm:p-6 md:p-8">
        <button
          type="button"
          onClick={goBackToFlow}
          className="mb-4 inline-flex w-fit items-center gap-2 rounded-md px-1 py-1.5 text-sm font-medium transition hover:bg-slate-50"
          style={{ color: branding.secondaryHex }}
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          Back
        </button>

        <header className="shrink-0 border-b border-slate-200 pb-4">
          <div
            className="mb-3 h-1 w-12 rounded-full"
            style={{ backgroundColor: branding.primaryHex }}
            aria-hidden
          />
          <h1
            className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl"
            style={{ color: branding.headingColor, fontFamily: "var(--brand-font-heading)" }}
          >
            {document.title}
          </h1>
          {document.lastUpdated ? (
            <p
              className="mt-2 text-sm"
              style={{ color: branding.mutedTextColor, fontFamily: "var(--brand-font-body)" }}
            >
              {document.lastUpdated}
            </p>
          ) : null}
        </header>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="mt-4 h-[min(520px,62vh)] overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white p-3 sm:mt-5 sm:h-[min(560px,65vh)] sm:p-4 md:p-6"
          style={{ fontFamily: "var(--brand-font-body)" }}
        >
          <div className="space-y-6 sm:space-y-7">
            {document.sections.map((section) => (
              <section key={section.title}>
                <h2
                  className="text-base font-semibold sm:text-lg"
                  style={{ color: branding.secondaryHex }}
                >
                  {section.title}
                </h2>
                <div className="mt-2 space-y-3">
                  {section.paragraphs.map((paragraph, index) => {
                    const isBullet = paragraph.startsWith("•")
                    return (
                      <p
                        key={`${section.title}-${index}`}
                        className={`text-sm leading-6 text-slate-700 sm:text-[15px] sm:leading-7 ${
                          isBullet ? "pl-1" : ""
                        }`}
                      >
                        {paragraph}
                      </p>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        {isAtBottom ? (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={goBackToFlow}
              className="rounded-md px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
              style={{ backgroundColor: branding.secondaryHex }}
            >
              Continue
            </button>
          </div>
        ) : (
          <p
            className="mt-3 text-center text-xs sm:text-left sm:text-sm"
            style={{ color: branding.mutedTextColor }}
          >
            Scroll to the bottom to continue.
          </p>
        )}
      </div>
    </div>
  )
}
