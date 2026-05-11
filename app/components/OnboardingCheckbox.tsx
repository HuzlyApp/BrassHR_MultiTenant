"use client"

import type { ReactNode } from "react"

const box =
  "flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors"

type Props = {
  checked: boolean
  onChange: (next: boolean) => void
  children?: ReactNode
  /** When true, renders a native checkbox for form labels (e.g. login) */
  native?: boolean
  id?: string
  className?: string
  disabled?: boolean
}

export default function OnboardingCheckbox({
  checked,
  onChange,
  children,
  native,
  id,
  className,
  disabled,
}: Props) {
  if (native && id) {
    return (
      <div className={className ?? "flex items-start gap-3"}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-[5px] border-2 border-slate-300 text-teal-600 accent-[#0D9488] focus:ring-2 focus:ring-teal-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {children}
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`flex items-start gap-3 text-left ${className ?? ""} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`${box} ${
          checked ? "border-[#0D9488] bg-[#0D9488] text-white" : "border-slate-300 bg-white"
        }`}
        aria-hidden
      >
        {checked ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M20 6L9 17L4 12"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      {children ? <span className="min-w-0 flex-1">{children}</span> : null}
    </button>
  )
}
