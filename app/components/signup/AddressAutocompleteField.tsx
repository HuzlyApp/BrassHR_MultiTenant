"use client"

import { useId, useRef } from "react"
import type { AddressSuggestion } from "@/lib/mapbox/address-validation-types"

export type AddressAutocompleteFieldVariant = "signup" | "onboarding" | "facility"

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  onSelectSuggestion: (suggestion: AddressSuggestion) => void
  suggestions: AddressSuggestion[]
  isLoading?: boolean
  isOpen?: boolean
  onFocus?: () => void
  onBlur?: () => void
  onCloseSuggestions?: () => void
  required?: boolean
  disabled?: boolean
  placeholder?: string
  helperText?: string
  error?: string | null
  searchError?: string | null
  isVerified?: boolean
  variant?: AddressAutocompleteFieldVariant
}

const signupInputClass =
  "h-[48px] w-full rounded-[6px] border bg-white px-[12px] text-[14px] font-normal leading-[22px] tracking-normal placeholder:text-[14px] placeholder:leading-[22px] min-[1440px]:h-[56px] min-[1440px]:px-[14px] min-[1440px]:text-[16px] min-[1440px]:leading-[24px] min-[1440px]:placeholder:text-[16px] min-[1440px]:placeholder:leading-[24px]"

const onboardingInputClass =
  "h-[56px] w-full rounded-[8px] border bg-white px-[14px] text-[16px] font-normal leading-[24px] tracking-normal"

const facilityInputClass =
  "h-11 w-full rounded-md border bg-white px-3 text-sm text-[#111827] outline-none transition placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)] focus:ring-1 focus:ring-[color:var(--brand-primary)]"

const interStyle = { fontFamily: "Inter, Arial, sans-serif" }
const signupInputTypographyStyle = {
  fontFamily: "Inter, Arial, sans-serif",
  fontWeight: 400,
  letterSpacing: "0",
} as const

export default function AddressAutocompleteField({
  label,
  value,
  onChange,
  onSelectSuggestion,
  suggestions,
  isLoading = false,
  isOpen = false,
  onFocus,
  onBlur,
  onCloseSuggestions,
  required = false,
  disabled = false,
  placeholder = "Start typing your street address",
  helperText = "Start typing to search",
  error,
  searchError,
  isVerified = false,
  variant = "signup",
}: Props) {
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const showSuggestions = isOpen && suggestions.length > 0 && !disabled

  const borderClass = error
    ? variant === "signup"
      ? "border-[#ff5c7a] text-[#f01846] focus:border-[#ff5c7a] focus:ring-[#ff5c7a]/20"
      : variant === "facility"
        ? "border-[#FCA5A5] text-[#B91C1C] focus:border-[#EF4444] focus:ring-[#EF4444]"
      : "border-[#ff5c7a] text-[#0f172a] focus:border-[#ff5c7a] focus:ring-[#ff5c7a]/20"
    : isVerified
      ? variant === "signup"
        ? "border-[#3fb27f] text-[#0f172a] focus:border-[#3fb27f] focus:ring-[#3fb27f]/20"
        : variant === "facility"
          ? "border-[color:color-mix(in_srgb,var(--brand-primary)_45%,#86EFAC)]"
        : "border-[#3fb27f] text-[#0f172a] focus:border-[#3fb27f] focus:ring-[#3fb27f]/20"
      : variant === "signup"
        ? "border-[#d7e0ea] text-[#0f172a] focus:border-[#d89b35] focus:ring-[#d89b35]/20"
        : variant === "facility"
          ? "border-[#D1D5DB]"
        : "border-[#cbd5e1] text-[#0f172a] focus:border-[#d89b35] focus:ring-[#d89b35]/20"

  const inputClassName =
    variant === "signup"
      ? `${signupInputClass} outline-none transition placeholder:text-[#b5c0cf] focus:ring-2 disabled:bg-[#f7f8fa] disabled:text-[#94a3b8] ${borderClass}`
      : variant === "facility"
        ? `${facilityInputClass} disabled:bg-[#f7f8fa] disabled:text-[#94a3b8] ${borderClass}`
      : `${onboardingInputClass} outline-none transition placeholder:text-[#94a3b8] focus:ring-2 focus:ring-[#d89b35]/20 disabled:bg-[#f7f8fa] disabled:text-[#94a3b8] ${borderClass}`

  const handleBlur = () => {
    window.setTimeout(() => {
      onCloseSuggestions?.()
      onBlur?.()
    }, 150)
  }

  return (
    <div>
      <div
        className={
          variant === "signup"
            ? "mb-[10px] flex items-center justify-between gap-3"
            : variant === "facility"
              ? "mb-2 flex items-center justify-between gap-2"
            : "mb-[8px] flex items-center justify-between gap-2"
        }
      >
        <label
          className={
            variant === "signup"
              ? "block text-[13px] font-normal leading-[18px] tracking-normal text-[#0f172a] min-[1440px]:text-[14px] min-[1440px]:leading-[20px]"
              : variant === "facility"
                ? "block text-sm text-[#6B7280]"
              : "block text-[14px] font-normal leading-[20px] text-[#0f172a]"
          }
          style={interStyle}
        >
          {label}
          {required ? <span className="ml-1 text-[#ef4565]">*</span> : null}
        </label>
        {helperText ? (
          <span
            className={
              variant === "signup"
                ? "text-[9px] font-normal leading-none text-[#8a98aa]"
                : variant === "facility"
                  ? "shrink-0 text-xs text-[#9CA3AF]"
                : "shrink-0 text-[12px] font-normal leading-[16px] text-[#94a3b8]"
            }
            style={variant === "onboarding" ? interStyle : undefined}
          >
            {helperText}
          </span>
        ) : null}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => {
            onFocus?.()
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          style={variant === "signup" ? signupInputTypographyStyle : interStyle}
          className={inputClassName}
        />

        {showSuggestions ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Street address suggestions"
            className={
              variant === "signup"
                ? "absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-[240px] overflow-y-auto rounded-[8px] border border-[#d7e0ea] bg-white shadow-md"
                : variant === "facility"
                  ? "absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white shadow-lg"
                : "absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-[240px] overflow-y-auto rounded-[8px] border border-[#cbd5e1] bg-white shadow-md"
            }
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelectSuggestion(suggestion)}
                  className={
                    variant === "signup"
                      ? "w-full px-[12px] py-[10px] text-left text-[13px] leading-[18px] text-[#334155] transition hover:bg-[#f5efe6] focus:bg-[#f5efe6] focus:outline-none"
                      : "w-full px-[14px] py-[10px] text-left text-[14px] leading-[20px] text-[#334155] transition hover:bg-[#f5efe6] focus:bg-[#f5efe6] focus:outline-none"
                  }
                  style={interStyle}
                >
                  {suggestion.placeName}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {isLoading ? (
        <p
          className={`${variant === "signup" ? "mt-[8px] text-[13px] leading-[18px]" : "mt-[8px] text-[13px] leading-[18px]"} font-normal text-[#64748b]`}
          style={interStyle}
        >
          Searching addresses…
        </p>
      ) : null}

      {error ? (
        <p
          className={`to-field-error ${variant === "signup" ? "mt-[8px] text-[14px] leading-[20px]" : "mt-[6px] text-[13px] leading-[18px]"} font-medium text-[#DC2626]`}
          style={{ ...interStyle, color: "#DC2626" }}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {!error && searchError ? (
        <p
          className={`${variant === "signup" ? "mt-[8px] text-[13px] leading-[18px]" : "mt-[8px] text-[13px] leading-[18px]"} font-normal text-[#64748b]`}
          style={interStyle}
          role="status"
        >
          {searchError}
        </p>
      ) : null}
    </div>
  )
}
