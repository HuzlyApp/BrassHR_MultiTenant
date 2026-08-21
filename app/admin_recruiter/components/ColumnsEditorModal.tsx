"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { useCallback, useMemo, useState, type CSSProperties } from "react"
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { brandingToCssVars } from "@/lib/tenant/tenant-branding"

const COLUMNS_ICONS = "/icons/jobs-icons"
const SEARCH_ICON_SRC = `${COLUMNS_ICONS}/search.svg`
const CHECK_ICON_SRC = `${COLUMNS_ICONS}/columns-check.svg`
const CLOSE_X_SRC = `${COLUMNS_ICONS}/columns-close-x.svg`
const REMOVE_X_SRC = `${COLUMNS_ICONS}/columns-remove-x.svg`
const DRAG_ICON_SRC = `${COLUMNS_ICONS}/columns-drag.svg`

function ColumnsGlyph({
  src,
  outer,
  leafWidth,
  leafHeight,
}: {
  src: string
  outer: number
  leafWidth: number
  leafHeight: number
}) {
  return (
    <span
      className="relative shrink-0 overflow-hidden"
      style={{ width: outer, height: outer }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={leafWidth}
        height={leafHeight}
        className="absolute left-1/2 top-1/2 shrink-0 -translate-x-1/2 -translate-y-1/2"
        style={{ width: leafWidth, height: leafHeight }}
      />
    </span>
  )
}

function ColumnCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="absolute inset-0 z-10 cursor-pointer appearance-none"
      />
      <span
        className={`pointer-events-none relative size-4 overflow-hidden rounded-[4px] border ${
          checked
            ? "border-[color:var(--brand-checkbox,var(--brand-secondary))] bg-[color:var(--brand-checkbox,var(--brand-secondary))]"
            : "border-[#CBD5E1] bg-white"
        }`}
        aria-hidden
      >
        {checked ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={CHECK_ICON_SRC}
            alt=""
            width={12}
            height={12}
            className="absolute left-px top-px size-3"
          />
        ) : null}
      </span>
    </span>
  )
}

type ColumnOption<TId extends string> = { id: TId; label: string }

type Props<TId extends string> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** All selectable columns. */
  options: ColumnOption<TId>[]
  /** Current saved column order (visible columns only). */
  value: TId[]
  onSave: (order: TId[]) => void
  title?: string
  description?: string
}

export function ColumnsEditorModal<TId extends string>({
  open,
  onOpenChange,
  options,
  value,
  onSave,
  title = "Edit Columns",
  description = "Choose which columns appear in the list and drag to reorder them.",
}: Props<TId>) {
  const branding = useTenantBranding()
  const brandVars = brandingToCssVars(branding) as CSSProperties
  const [fieldSearch, setFieldSearch] = useState("")
  const [draftOrder, setDraftOrder] = useState<TId[]>(() => [...value])
  const [dragId, setDragId] = useState<TId | null>(null)

  const selectedSet = useMemo(() => new Set(draftOrder), [draftOrder])

  const labelFor = useCallback(
    (id: TId) => options.find((c) => c.id === id)?.label ?? id,
    [options]
  )

  const filteredOptions = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase()
    if (!q) return options
    return options.filter((c) => c.label.toLowerCase().includes(q))
  }, [fieldSearch, options])

  const toggle = useCallback((id: TId) => {
    setDraftOrder((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id)
      }
      return [...prev, id]
    })
  }, [])

  const unselectAll = useCallback(() => {
    setDraftOrder([])
  }, [])

  const removeFromOrder = useCallback((id: TId) => {
    setDraftOrder((prev) => prev.filter((x) => x !== id))
  }, [])

  const onDragStart = (e: React.DragEvent, id: TId) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", id)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const onDropOn = (e: React.DragEvent, targetId: TId) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData("text/plain") as TId
    const fromId = dragId || raw
    setDragId(null)
    if (!fromId || fromId === targetId) return
    setDraftOrder((prev) => {
      const from = prev.indexOf(fromId)
      const to = prev.indexOf(targetId)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [removed] = next.splice(from, 1)
      next.splice(to, 0, removed)
      return next
    })
  }

  const onDragEnd = () => setDragId(null)

  const totalFields = options.length
  const selectedCount = draftOrder.length

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40 data-[state=open]:animate-in fade-in" />
        <Dialog.Content
          style={brandVars}
          className="fixed inset-x-0 bottom-0 top-auto z-[101] flex h-[94dvh] max-h-[94dvh] w-full max-w-full translate-x-0 translate-y-0 flex-col overflow-hidden rounded-t-[16px] border border-[#E5E7EB] bg-white shadow-[0px_20px_12.5px_rgba(0,0,0,0.1),0px_10px_5px_rgba(0,0,0,0.04)] outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[min(772px,calc(100vh-2rem))] sm:max-h-[calc(100vh-2rem)] sm:w-[min(1024px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-zinc-300 sm:hidden" aria-hidden />

          <div className="flex shrink-0 items-center justify-between pb-2 pl-[30px] pr-5 pt-5">
            <div className="min-w-0 pr-3">
              <Dialog.Title className="truncate text-2xl font-semibold leading-8 text-[#1F2937]">
                {title}
              </Dialog.Title>
              <Dialog.Description className="sr-only">{description}</Dialog.Description>
            </div>
            <Dialog.Close
              className="flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-black p-1.5 hover:opacity-90"
              aria-label="Close"
            >
              <ColumnsGlyph src={CLOSE_X_SRC} outer={18} leafWidth={11} leafHeight={11} />
            </Dialog.Close>
          </div>

          <div className="shrink-0 px-0 py-2" aria-hidden>
            <div className="h-px w-full bg-[#E5E7EB]" />
          </div>

          <div className="flex min-h-0 flex-1 touch-pan-y flex-col gap-[30px] overflow-y-auto overscroll-y-contain border-b border-[#E5E7EB] px-[30px] pb-5 pt-3 md:flex-row md:overflow-hidden">
            <section className="flex min-h-0 w-full flex-col gap-5 md:flex-1">
              <h3 className="shrink-0 text-sm font-semibold leading-5 text-black">Choose display columns</h3>
              <div className="flex shrink-0 items-center justify-between text-xs font-normal leading-4">
                <button
                  type="button"
                  onClick={unselectAll}
                  className="text-[color:var(--brand-primary)] hover:opacity-80"
                >
                  Unselect All
                </button>
                <span className="text-[#6B7280]">
                  ({selectedCount} of {totalFields})
                </span>
              </div>
              <label className="flex h-9 w-full shrink-0 items-center gap-1 overflow-hidden rounded-lg border border-[#CBD5E1] bg-white px-2.5">
                <span className="relative flex size-5 shrink-0 items-center justify-center overflow-hidden" aria-hidden>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={SEARCH_ICON_SRC}
                    alt=""
                    width={16.67}
                    height={16.67}
                    className="size-[16.67px] shrink-0"
                  />
                </span>
                <input
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="Search fields"
                  className="min-w-0 flex-1 bg-transparent text-sm font-normal leading-5 text-[#334155] outline-none placeholder:text-[#94A3B8]"
                />
              </label>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                {filteredOptions.map((col) => {
                  const checked = selectedSet.has(col.id)
                  return (
                    <label
                      key={col.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 hover:bg-[#F8FAFC]"
                    >
                      <ColumnCheckbox checked={checked} onChange={() => toggle(col.id)} />
                      <span className="text-xs font-normal leading-4 text-[#374151]">{col.label}</span>
                    </label>
                  )
                })}
              </div>
            </section>

            <section className="flex min-h-0 w-full flex-col gap-5 md:flex-1">
              <h3 className="shrink-0 text-sm font-semibold leading-5 text-black">Reorder the columns</h3>
              <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain pr-1">
                {draftOrder.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#E5E7EB] py-8 text-center text-xs text-[#6B7280]">
                    No columns selected. Check fields on the left.
                  </div>
                ) : (
                  draftOrder.map((id) => (
                    <div
                      key={id}
                      draggable
                      onDragStart={(e) => onDragStart(e, id)}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDropOn(e, id)}
                      onDragEnd={onDragEnd}
                      className="flex cursor-grab items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-3 active:cursor-grabbing"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="relative size-[18px] shrink-0 overflow-hidden" aria-hidden>
                          <BrandedSvgIcon
                            src={DRAG_ICON_SRC}
                            className="absolute left-1/2 top-1/2 h-[12px] w-[7.5px] -translate-x-1/2 -translate-y-1/2"
                            color={branding.primaryHex}
                          />
                        </span>
                        <span className="min-w-0 truncate text-xs font-normal leading-4 text-[#374151]">
                          {labelFor(id)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromOrder(id)}
                        className="cursor-pointer rounded p-0.5 hover:bg-[#F8FAFC]"
                        aria-label={`Remove ${labelFor(id)}`}
                      >
                        <ColumnsGlyph src={REMOVE_X_SRC} outer={18} leafWidth={11} leafHeight={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[color:var(--brand-primary)] px-4 text-sm font-semibold leading-5 text-[color:var(--brand-primary)] hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)]"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => {
                onSave(draftOrder)
                onOpenChange(false)
              }}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] px-4 text-sm font-semibold leading-5 text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary)_35%,transparent)]"
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
