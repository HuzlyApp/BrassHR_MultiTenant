"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { Check, GripVertical, Search, X } from "lucide-react"
import { useCallback, useMemo, useState, type CSSProperties } from "react"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { brandingToCssVars } from "@/lib/tenant/tenant-branding"

function BrandedColumnCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <span className="relative inline-flex h-5 w-5 shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-[5px] border-2 border-slate-300 bg-white transition-colors checked:border-[color:var(--brand-checkbox,var(--brand-primary))] checked:bg-[color:var(--brand-checkbox,var(--brand-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary)_30%,transparent)]"
      />
      <Check
        className="pointer-events-none absolute inset-0 m-auto hidden h-3 w-3 text-white peer-checked:block"
        strokeWidth={3}
        aria-hidden
      />
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
          className="fixed inset-x-0 bottom-0 top-auto z-[101] flex max-h-[94dvh] w-full max-w-full translate-x-0 translate-y-0 flex-col rounded-t-[16px] bg-white shadow-2xl outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[min(688px,calc(100vh-2rem))] sm:max-h-none sm:w-[min(1024px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px] sm:border sm:border-zinc-200"
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-zinc-300 sm:hidden" aria-hidden />

          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-3 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0 pr-3">
              <Dialog.Title className="truncate text-base font-semibold leading-6 text-gray-800 sm:text-2xl sm:leading-8">
                {title}
              </Dialog.Title>
              <Dialog.Description className="sr-only">{description}</Dialog.Description>
            </div>
            <Dialog.Close
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black text-white hover:opacity-90 sm:h-8 sm:w-8 sm:p-1.5"
              aria-label="Close"
            >
              <X className="h-5 w-5 sm:h-4 sm:w-4" />
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:grid sm:grid-cols-1 sm:gap-6 sm:overflow-hidden sm:p-6 md:grid-cols-2">
            {/* Left: choose columns */}
            <section className="flex min-h-0 flex-col border-b border-zinc-200 pb-4 md:flex-1 md:border-b-0 md:pb-0">
              <div className="shrink-0 text-base font-semibold text-slate-800 sm:text-[20px]">
                Choose display columns
              </div>
              <div className="mt-2 flex shrink-0 items-center justify-between text-sm sm:mt-3">
                <button
                  type="button"
                  onClick={unselectAll}
                  className="font-medium text-[color:var(--brand-primary)] hover:text-[color:var(--brand-secondary)] hover:underline"
                >
                  Unselect All
                </button>
                <span className="text-slate-500">
                  ({selectedCount} of {totalFields})
                </span>
              </div>
              <div className="mt-2 w-full shrink-0 sm:mt-3">
                <label className="flex h-12 w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3">
                  <Search className="h-5 w-5 shrink-0 text-slate-500" />
                  <input
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    placeholder="Search fields"
                    className="min-w-0 flex-1 bg-transparent text-base leading-6 text-slate-700 outline-none placeholder:text-slate-500 sm:text-sm"
                  />
                </label>
              </div>
              <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 bg-white p-2 pr-1 max-sm:max-h-[36dvh] sm:mt-3 md:max-h-none">
                {filteredOptions.map((col) => {
                  const checked = selectedSet.has(col.id)
                  return (
                    <label
                      key={col.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 hover:bg-zinc-50 sm:py-2"
                    >
                      <BrandedColumnCheckbox checked={checked} onChange={() => toggle(col.id)} />
                      <span className="text-sm text-slate-700">{col.label}</span>
                    </label>
                  )
                })}
              </div>
            </section>

            {/* Right: reorder */}
            <section className="flex min-h-0 flex-col pt-4 md:flex-1 md:pt-0">
              <div className="shrink-0 text-base font-semibold text-slate-800 sm:text-[20px]">
                Reorder the columns
              </div>
              <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 bg-white p-2 pr-1 max-sm:max-h-[32dvh] sm:mt-3 md:max-h-none">
                {draftOrder.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 py-8 text-center text-sm text-gray-600 sm:py-12">
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
                      className="flex cursor-grab items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm text-slate-700 active:cursor-grabbing sm:py-2.5"
                    >
                      <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-gray-600 sm:h-4 sm:w-4" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{labelFor(id)}</span>
                      <button
                        type="button"
                        onClick={() => removeFromOrder(id)}
                        className="cursor-pointer rounded p-2 text-gray-600 hover:bg-zinc-100 hover:text-gray-600 sm:p-1.5"
                        aria-label={`Remove ${labelFor(id)}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="flex shrink-0 gap-2 border-t border-zinc-200 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
            <Dialog.Close asChild>
              <button
                type="button"
                className="h-12 flex-1 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-gray-700 hover:bg-zinc-50 sm:h-auto sm:flex-none sm:px-5 sm:py-2"
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
              className="h-12 flex-1 rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-medium text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary)_35%,transparent)] sm:h-auto sm:flex-none sm:px-5 sm:py-2"
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
