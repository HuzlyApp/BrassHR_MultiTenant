"use client"

import { ChevronDown, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

const inputTypographyStyle = {
  fontFamily: "Inter, Arial, sans-serif",
  fontSize: "16px",
  lineHeight: "24px",
  fontWeight: 400,
  letterSpacing: "0",
} as const

const inputTextClass =
  "text-[16px] font-normal leading-[24px] tracking-normal placeholder:text-[16px] placeholder:leading-[24px] placeholder:font-normal"

const inputFocusClass =
  "focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20"

const inputErrorClass = "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20"

type SearchableSelectFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  searchPlaceholder?: string
  options: readonly string[]
  required?: boolean
  disabled?: boolean
  loading?: boolean
  error?: string | null
  emptyMessage?: string
}

export default function SearchableSelectField({
  label,
  value,
  onChange,
  onBlur,
  placeholder = "Select",
  searchPlaceholder,
  options,
  required = false,
  disabled = false,
  loading = false,
  error,
  emptyMessage = "No cities found",
}: SearchableSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const wrapperRef = useRef<HTMLDivElement>(null)

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [...options]
    return options.filter((opt) => opt.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onDocClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false)
        onBlur?.()
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open, onBlur])

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  const displayPlaceholder = loading ? "Loading…" : placeholder
  const isDisabled = disabled || loading

  return (
    <div ref={wrapperRef}>
      <label className="mb-[8px] block text-[14px] font-medium leading-[20px] text-[#0f172a]">
        {label}
        {required ? <span className="ml-1 text-[#DC2626]">*</span> : null}
      </label>
      <div className="relative">
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => {
            if (isDisabled) return
            setOpen((prev) => !prev)
          }}
          onBlur={() => {
            if (!open) onBlur?.()
          }}
          style={inputTypographyStyle}
          className={`flex h-[56px] w-full items-center justify-between rounded-[8px] border bg-white px-[14px] pr-10 text-left outline-none transition disabled:cursor-not-allowed disabled:bg-[#f7f8fa] disabled:text-[#94a3b8] ${
            error
              ? inputErrorClass
              : `border-[#cbd5e1] ${inputFocusClass} ${value ? "text-[#0f172a]" : "text-[#94a3b8]"}`
          } ${inputTextClass}`}
        >
          <span className="truncate">{value || displayPlaceholder}</span>
          <ChevronDown
            className={`pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#64748b] transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && !isDisabled ? (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-[8px] border border-[#cbd5e1] bg-white shadow-lg">
            <div className="relative border-b border-[#e2e8f0] p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
                autoFocus
                style={inputTypographyStyle}
                className={`h-[44px] w-full rounded-[6px] border border-[#cbd5e1] bg-white py-2 pl-9 pr-3 text-[#0f172a] outline-none placeholder:text-[#94a3b8] ${inputFocusClass}`}
              />
            </div>
            <div className="max-h-[220px] overflow-y-auto py-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onChange(opt)
                      setOpen(false)
                      setQuery("")
                      onBlur?.()
                    }}
                    className={`w-full px-[14px] py-2.5 text-left text-[16px] leading-[24px] text-[#0f172a] hover:bg-[#f1f5f9] ${
                      opt === value ? "bg-[#eff6ff] font-medium" : ""
                    }`}
                  >
                    {opt}
                  </button>
                ))
              ) : (
                <p className="px-[14px] py-3 text-[14px] text-[#64748b]">{emptyMessage}</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="mt-[6px] text-[12px] font-normal leading-[16px] text-[#DC2626]">{error}</p>
      ) : null}
    </div>
  )
}
