"use client";

import { useState } from "react";
import BrandedEditIcon from "./BrandedEditIcon";

type CandidateDetailEditableFieldProps = {
  label: string;
  displayValue: string;
  editValue: string;
  isMissing: boolean;
  editable?: boolean;
  inputType?: "text" | "email" | "tel" | "number";
  placeholder?: string;
  highlightValue?: boolean;
  saving?: boolean;
  onSave: (value: string) => Promise<void>;
};

export default function CandidateDetailEditableField({
  label,
  displayValue,
  editValue,
  isMissing,
  editable = true,
  inputType = "text",
  placeholder,
  highlightValue = false,
  saving = false,
  onSave,
}: CandidateDetailEditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(editValue);
  const [localSaving, setLocalSaving] = useState(false);
  const busy = saving || localSaving;

  function openEditor() {
    if (!editable || busy) return;
    setDraft(editValue);
    setEditing(true);
  }

  function cancelEditor() {
    setDraft(editValue);
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
        {!editable ? (
          <span className={highlightValue ? "text-[var(--brand-primary)]" : ""}>{displayValue}</span>
        ) : editing ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type={inputType}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              disabled={busy}
              className="min-h-10 w-full min-w-0 flex-1 rounded-lg border border-[#D1D5DB] px-3 py-2 text-[14px] text-[#111827] outline-none focus:border-[var(--brand-primary)]"
            />
            <div className="flex shrink-0 items-center gap-2">
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
            <span className={highlightValue ? "text-[var(--brand-primary)]" : ""}>{displayValue}</span>
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
