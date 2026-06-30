"use client";

import { useState } from "react";
import BrandedEditIcon from "./BrandedEditIcon";

export type ReferenceFormValue = {
  first: string;
  last: string;
  email: string;
  phone: string;
};

type CandidateDetailReferenceFieldProps = {
  label: string;
  displayValue: string;
  value: ReferenceFormValue;
  isMissing: boolean;
  saving?: boolean;
  onSave: (value: ReferenceFormValue) => Promise<void>;
};

export default function CandidateDetailReferenceField({
  label,
  displayValue,
  value,
  isMissing,
  saving = false,
  onSave,
}: CandidateDetailReferenceFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ReferenceFormValue>(value);
  const [localSaving, setLocalSaving] = useState(false);
  const busy = saving || localSaving;

  function openEditor() {
    if (busy) return;
    setDraft(value);
    setEditing(true);
  }

  function cancelEditor() {
    setDraft(value);
    setEditing(false);
  }

  async function handleSave() {
    if (busy) return;
    setLocalSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setLocalSaving(false);
    }
  }

  return (
    <>
      <div className="border-b border-r border-[#E5E7EB] px-5 py-3 text-[14px] font-normal leading-5 text-[#374151]">
        {label}
      </div>
      <div className="border-b border-[#E5E7EB] px-5 py-3 text-[14px] font-normal leading-5 break-all text-[#111827]">
        {editing ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={draft.first}
                onChange={(e) => setDraft((prev) => ({ ...prev, first: e.target.value }))}
                placeholder="First name"
                disabled={busy}
                className="min-h-10 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[var(--brand-primary)]"
              />
              <input
                type="text"
                value={draft.last}
                onChange={(e) => setDraft((prev) => ({ ...prev, last: e.target.value }))}
                placeholder="Last name"
                disabled={busy}
                className="min-h-10 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[var(--brand-primary)]"
              />
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email"
                disabled={busy}
                className="min-h-10 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[var(--brand-primary)]"
              />
              <input
                type="tel"
                value={draft.phone}
                onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone"
                disabled={busy}
                className="min-h-10 w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={busy}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEditor}
                disabled={busy}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#374151] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : isMissing ? (
          <button
            type="button"
            onClick={openEditor}
            className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline"
          >
            <span className="text-base leading-none">+</span>
            <span>Add</span>
          </button>
        ) : (
          <div className="group flex items-start justify-between gap-2">
            <span>{displayValue}</span>
            <button
              type="button"
              onClick={openEditor}
              aria-label={`Edit ${label}`}
              className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            >
              <BrandedEditIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
