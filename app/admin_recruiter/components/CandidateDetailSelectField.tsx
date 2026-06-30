"use client";

import { useEffect, useState } from "react";
import BrandedEditIcon from "./BrandedEditIcon";
import CandidateDetailAddButton from "./CandidateDetailAddButton";

export type SelectOption = {
  value: string;
  label: string;
};

type CandidateDetailSelectFieldProps = {
  label: string;
  displayValue: string;
  editValue: string;
  isMissing: boolean;
  options: SelectOption[];
  optionsLoading?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  highlightValue?: boolean;
  saving?: boolean;
  onSave: (value: string) => Promise<void>;
};

export default function CandidateDetailSelectField({
  label,
  displayValue,
  editValue,
  isMissing,
  options,
  optionsLoading = false,
  placeholder = "Select…",
  emptyMessage = "No options available.",
  highlightValue = false,
  saving = false,
  onSave,
}: CandidateDetailSelectFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(editValue);
  const [localSaving, setLocalSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const busy = saving || localSaving;

  useEffect(() => {
    if (!editing) setDraft(editValue);
  }, [editValue, editing]);

  function openEditor() {
    if (busy) return;
    setDraft(editValue);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditor() {
    setDraft(editValue);
    setSaveError(null);
    setEditing(false);
  }

  async function handleSave() {
    if (busy) return;
    if (!draft.trim()) {
      setSaveError("Please pick a value.");
      return;
    }

    setLocalSaving(true);
    setSaveError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save";
      setSaveError(message);
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
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (saveError) setSaveError(null);
                }}
                disabled={busy || optionsLoading}
                className={`min-h-10 w-full min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-[14px] text-[#111827] outline-none focus:border-[var(--brand-primary)] ${
                  saveError ? "border-red-400" : "border-[#D1D5DB]"
                }`}
              >
                <option value="">{optionsLoading ? "Loading…" : placeholder}</option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={busy || optionsLoading}
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
            {!optionsLoading && options.length === 0 ? (
              <p className="text-sm text-[#6B7280]">{emptyMessage}</p>
            ) : null}
            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          </div>
        ) : isMissing ? (
          <CandidateDetailAddButton onClick={openEditor} />
        ) : (
          <div className="group flex items-start justify-between gap-2">
            <span className={highlightValue ? "text-[var(--brand-primary)]" : ""}>{displayValue}</span>
            <button
              type="button"
              onClick={openEditor}
              aria-label={`Edit ${label}`}
              className="mt-0.5 shrink-0 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            >
              <BrandedEditIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
