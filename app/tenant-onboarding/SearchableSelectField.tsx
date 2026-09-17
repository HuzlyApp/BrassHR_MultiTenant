"use client"

import { ChevronDown, Search } from "lucide-react"
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { createPortal } from "react-dom"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { brandingToCssVars } from "@/lib/tenant/tenant-branding"

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
  "focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]"

const activeBorderClass =
  "border-[color:var(--brand-primary)] ring-2 ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]"

const inputErrorClass =
  "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20"

const MENU_MAX_HEIGHT = 280
const MENU_GAP = 8

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
  /** Tighter field sizing for signup mobile layout */
  compact?: boolean
  /** Allow confirming a typed value that is not in `options` (any city in an allowed state). */
  allowCustom?: boolean
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
  compact = false,
  allowCustom = false,
}: SearchableSelectFieldProps) {
  const branding = useTenantBranding()
  const brandVars = useMemo(
    () => brandingToCssVars(branding) as CSSProperties,
    [branding.primaryHex, branding.secondaryHex, branding.accentHex]
  )
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [mounted, setMounted] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({
    position: "fixed",
    visibility: "hidden",
  })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [...options]
    return options.filter((opt) => opt.toLowerCase().includes(q))
  }, [options, query])

  const customValue = query.trim()
  const showCustomOption =
    allowCustom &&
    Boolean(customValue) &&
    !options.some((opt) => opt.toLowerCase() === customValue.toLowerCase())

  function commitValue(next: string) {
    onChange(next)
    setOpen(false)
    setQuery("")
    onBlur?.()
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return

    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const menuHeight = Math.min(
        MENU_MAX_HEIGHT,
        menuRef.current?.offsetHeight || MENU_MAX_HEIGHT
      )
      const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP
      const spaceAbove = rect.top - MENU_GAP
      const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow

      const top = openUpward
        ? Math.max(MENU_GAP, rect.top - menuHeight - MENU_GAP)
        : Math.min(rect.bottom + MENU_GAP, window.innerHeight - menuHeight - MENU_GAP)
      const width = rect.width
      const left = Math.max(
        MENU_GAP,
        Math.min(rect.left, window.innerWidth - width - MENU_GAP)
      )

      setMenuStyle({
        position: "fixed",
        top,
        left,
        width,
        maxHeight: MENU_MAX_HEIGHT,
        zIndex: 200,
        visibility: "visible",
        ...brandVars,
      })
    }

    updatePosition()
    // Re-measure after menu content paints so flip/height are accurate.
    const raf = window.requestAnimationFrame(updatePosition)
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [open, filteredOptions.length, query, brandVars])

  useEffect(() => {
    if (!open) return
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (wrapperRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
      onBlur?.()
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        onBlur?.()
      }
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onEscape)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onEscape)
    }
  }, [open, onBlur])

  const displayPlaceholder = loading ? "Loading…" : placeholder
  const isDisabled = disabled || loading
  const labelClass = compact
    ? "mb-[6px] block text-[13px] font-medium leading-[18px] text-[#0f172a] min-[1440px]:mb-[8px] min-[1440px]:text-[14px] min-[1440px]:leading-[20px]"
    : "mb-[8px] block text-[14px] font-medium leading-[20px] text-[#0f172a]"
  const triggerClass = compact
    ? "flex h-[48px] w-full cursor-pointer items-center justify-between rounded-[6px] border bg-white px-[12px] pr-10 text-left text-[14px] leading-[22px] outline-none transition min-[1440px]:h-[56px] min-[1440px]:rounded-[8px] min-[1440px]:px-[14px] min-[1440px]:text-[16px] min-[1440px]:leading-[24px]"
    : "flex h-[56px] w-full cursor-pointer items-center justify-between rounded-[8px] border bg-white px-[14px] pr-10 text-left outline-none transition"

  const menu =
    open && !isDisabled && mounted
      ? createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="overflow-hidden rounded-[8px] border border-[#cbd5e1] bg-white shadow-lg"
          >
            <div className="relative border-b border-[#e2e8f0] p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return
                  event.preventDefault()
                  const typed = query.trim()
                  if (!typed) return
                  const exact = options.find((opt) => opt.toLowerCase() === typed.toLowerCase())
                  if (exact) {
                    commitValue(exact)
                    return
                  }
                  if (allowCustom) {
                    commitValue(typed)
                    return
                  }
                  if (filteredOptions.length === 1) {
                    commitValue(filteredOptions[0] ?? typed)
                  }
                }}
                placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
                autoFocus
                style={inputTypographyStyle}
                className={`h-[44px] w-full rounded-[6px] border bg-white py-2 pl-9 pr-3 text-[#0f172a] outline-none placeholder:text-[#94a3b8] ${activeBorderClass} ${inputFocusClass}`}
              />
            </div>
            <div className="max-h-[220px] overflow-y-auto py-1">
              {showCustomOption ? (
                <button
                  type="button"
                  onClick={() => commitValue(customValue)}
                  className="w-full cursor-pointer px-[14px] py-2.5 text-left text-[16px] leading-[24px] text-[#0f172a] hover:bg-[#f1f5f9]"
                >
                  Use “{customValue}”
                </button>
              ) : null}
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => commitValue(opt)}
                    className={`w-full cursor-pointer px-[14px] py-2.5 text-left text-[16px] leading-[24px] text-[#0f172a] hover:bg-[#f1f5f9] ${
                      opt === value ? "bg-[#eff6ff] font-medium" : ""
                    }`}
                  >
                    {opt}
                  </button>
                ))
              ) : showCustomOption ? null : (
                <p className="px-[14px] py-3 text-[14px] text-[#64748b]">{emptyMessage}</p>
              )}
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <div ref={wrapperRef}>
      <label className={labelClass}>
        {label}
        {required ? <span className="ml-1 text-[#DC2626]">*</span> : null}
      </label>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={isDisabled}
          onClick={() => {
            if (isDisabled) return
            setOpen((prev) => !prev)
          }}
          onBlur={() => {
            if (!open) onBlur?.()
          }}
          style={
            compact
              ? {
                  fontFamily: inputTypographyStyle.fontFamily,
                  fontWeight: inputTypographyStyle.fontWeight,
                  letterSpacing: inputTypographyStyle.letterSpacing,
                }
              : inputTypographyStyle
          }
          className={`${triggerClass} disabled:cursor-not-allowed disabled:bg-[#f7f8fa] disabled:text-[#94a3b8] ${
            error
              ? inputErrorClass
              : open
                ? `${activeBorderClass} ${value ? "text-[#0f172a]" : "text-[#94a3b8]"}`
                : `border-[#cbd5e1] ${inputFocusClass} ${value ? "text-[#0f172a]" : "text-[#94a3b8]"}`
          } ${compact ? "" : inputTextClass}`}
        >
          <span className="truncate">{value || displayPlaceholder}</span>
          <ChevronDown
            className={`pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#64748b] transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
      {error ? (
        <p className="to-field-error mt-[6px] text-[12px] font-normal leading-[16px] text-[#DC2626]">
          {error}
        </p>
      ) : null}
      {menu}
    </div>
  )
}
