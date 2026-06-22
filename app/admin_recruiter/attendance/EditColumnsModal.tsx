"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, GripVertical, Search, X } from "lucide-react";
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import {
  ATTENDANCE_COLUMN_OPTIONS,
  type AttendanceColumnId,
  attendanceColumnLabel,
} from "./column-config";

function BrandedColumnCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
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
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: AttendanceColumnId[];
  onSave: (order: AttendanceColumnId[]) => void;
};

export function AttendanceEditColumnsModal({ open, onOpenChange, value, onSave }: Props) {
  const branding = useTenantBranding();
  const brandVars = brandingToCssVars(branding) as CSSProperties;
  const [fieldSearch, setFieldSearch] = useState("");
  const [draftOrder, setDraftOrder] = useState<AttendanceColumnId[]>(() => [...value]);
  const [dragId, setDragId] = useState<AttendanceColumnId | null>(null);

  const selectedSet = useMemo(() => new Set(draftOrder), [draftOrder]);

  const filteredOptions = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return ATTENDANCE_COLUMN_OPTIONS;
    return ATTENDANCE_COLUMN_OPTIONS.filter((c) => c.label.toLowerCase().includes(q));
  }, [fieldSearch]);

  const toggle = useCallback((id: AttendanceColumnId) => {
    setDraftOrder((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }, []);

  const unselectAll = useCallback(() => {
    setDraftOrder([]);
  }, []);

  const removeFromOrder = useCallback((id: AttendanceColumnId) => {
    setDraftOrder((prev) => prev.filter((x) => x !== id));
  }, []);

  const onDragStart = (e: React.DragEvent, id: AttendanceColumnId) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDropOn = (e: React.DragEvent, targetId: AttendanceColumnId) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain") as AttendanceColumnId;
    const fromId = dragId || raw;
    setDragId(null);
    if (!fromId || fromId === targetId) return;
    setDraftOrder((prev) => {
      const from = prev.indexOf(fromId);
      const to = prev.indexOf(targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      return next;
    });
  };

  const onDragEnd = () => setDragId(null);

  const totalFields = ATTENDANCE_COLUMN_OPTIONS.length;
  const selectedCount = draftOrder.length;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40 data-[state=open]:animate-in fade-in" />
        <Dialog.Content
          style={brandVars}
          className="fixed left-1/2 top-1/2 z-[101] flex h-[min(688px,calc(100vh-2rem))] w-[min(1024px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[20px] border border-zinc-200 bg-white shadow-xl outline-none"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
            <div>
              <Dialog.Title className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-2xl font-semibold leading-8 text-gray-800">
                Edit Columns
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Choose which columns appear in the attendance table and drag to reorder them.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="cursor-pointer rounded-full bg-black p-1.5 text-white hover:opacity-90"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 p-6 md:grid-cols-2">
            <div className="flex min-h-0 flex-col">
              <div className="text-[20px] font-semibold text-slate-800">Choose display columns</div>
              <div className="mt-3 flex items-center justify-between text-sm">
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
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
                <Search className="h-4 w-4 shrink-0 text-gray-600" />
                <input
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="Search fields"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-600"
                />
              </div>
              <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 pr-1">
                {filteredOptions.map((col) => {
                  const checked = selectedSet.has(col.id);
                  return (
                    <label
                      key={col.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-zinc-50"
                    >
                      <BrandedColumnCheckbox checked={checked} onChange={() => toggle(col.id)} />
                      <span className="text-sm text-slate-700">{col.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="text-[20px] font-semibold text-slate-800">Reorder the columns</div>
              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 pr-1">
                {draftOrder.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 py-12 text-center text-sm text-gray-600">
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
                      className="flex cursor-grab items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm text-slate-700 active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-gray-600" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{attendanceColumnLabel(id)}</span>
                      <button
                        type="button"
                        onClick={() => removeFromOrder(id)}
                        className="cursor-pointer rounded p-1.5 text-gray-600 hover:bg-zinc-100 hover:text-gray-600"
                        aria-label={`Remove ${attendanceColumnLabel(id)}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => {
                onSave(draftOrder);
                onOpenChange(false);
              }}
              className="rounded-lg bg-[color:var(--brand-primary)] px-5 py-2 text-sm font-medium text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary)_35%,transparent)]"
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
