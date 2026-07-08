"use client"

import { Pencil } from "lucide-react"
import { useRef } from "react"
import {
  ADDRESS_AMBIGUOUS_MESSAGE,
  ADDRESS_INVALID_MESSAGE,
} from "@/lib/mapbox/address-validation-types"
import type { AddressSuggestion, AddressValidationResult } from "@/lib/mapbox/address-validation-types"
import type { AddressValidationUiState } from "@/lib/mapbox/use-address-validation"
import { shouldValidateAddressQuery } from "@/lib/mapbox/address-validation"

type Props = {
  label: string
  required?: boolean
  hint?: string
  value: string
  placeholder?: string
  className?: string
  disabled?: boolean
  query: string
  uiState: AddressValidationUiState
  validationResult: AddressValidationResult | null
  isValidating: boolean
  onChange: (value: string) => void
  onSelectSuggestion: (suggestion: AddressSuggestion) => void
}

export default function ValidatedAddressField({
  label,
  required,
  hint,
  value,
  placeholder,
  className,
  disabled,
  query,
  uiState,
  validationResult,
  isValidating,
  onChange,
  onSelectSuggestion,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const showValidation = shouldValidateAddressQuery(query)

  let statusMessage: string | null = null
  let statusTone: "success" | "error" | "neutral" = "neutral"

  if (showValidation) {
    if (isValidating || uiState.phase === "validating") {
      statusMessage = "Verifying address…"
      statusTone = "neutral"
    } else if (validationResult?.isValid && validationResult.normalizedAddress) {
      statusMessage = "Address verified."
      statusTone = "success"
    } else if (validationResult?.status === "ambiguous") {
      statusMessage = ADDRESS_AMBIGUOUS_MESSAGE
      statusTone = "error"
    } else if (validationResult?.status === "invalid") {
      statusMessage = ADDRESS_INVALID_MESSAGE
      statusTone = "error"
    }
  }

  const suggestions =
    validationResult?.status === "ambiguous" ? validationResult.suggestions ?? [] : []

  const inputBorder =
    showValidation && validationResult && !validationResult.isValid && !isValidating
      ? "border-red-300 focus:border-red-400 focus:ring-red-200/60"
      : showValidation && validationResult?.isValid
        ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-200/60"
        : ""

  return (
    <div>
      <div className="flex flex-wrap justify-between gap-1">
        <label className="mb-1.5 block text-[13px] font-medium text-gray-600">
          {label}
          {required ? <span className="ml-0.5 text-red-500">*</span> : null}
        </label>
        {hint ? <span className="mt-0.5 text-[11px] text-gray-400">{hint}</span> : null}
      </div>
      <div className="group relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${className ?? ""} ${inputBorder}`.trim()}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="street-address"
          aria-invalid={
            showValidation && validationResult && !validationResult.isValid ? true : undefined
          }
          aria-describedby={statusMessage ? "address-validation-status" : undefined}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus:outline-none"
          aria-label={`Edit ${label}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {statusMessage ? (
        <p
          id="address-validation-status"
          role={statusTone === "error" ? "alert" : "status"}
          className={`mt-1.5 text-[12px] leading-snug ${
            statusTone === "success"
              ? "text-emerald-700"
              : statusTone === "error"
                ? "text-red-600"
                : "text-slate-500"
          }`}
        >
          {statusMessage}
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul
          className="mt-2 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
          aria-label="Suggested addresses"
        >
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelectSuggestion(s)}
                className="w-full px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-teal-50 focus:bg-teal-50 focus:outline-none"
              >
                {s.placeName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
