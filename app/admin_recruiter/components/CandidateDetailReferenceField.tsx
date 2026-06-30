"use client";

import { useState } from "react";
import BrandedEditIcon from "./BrandedEditIcon";
import CandidateDetailAddButton from "./CandidateDetailAddButton";
import {
  filterCandidateFieldInput,
  formatPhoneForEdit,
  validateCandidateFieldInput,
} from "@/lib/admin/worker-profile-field-client";

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

function validateReferenceDraft(draft: ReferenceFormValue): { ok: true } | { ok: false; error: string } {
  const first = validateCandidateFieldInput("person_name", draft.first);
  if (!first.ok) return { ok: false, error: `First name: ${first.error}` };

  const last = validateCandidateFieldInput("person_name", draft.last);
  if (!last.ok) return { ok: false, error: `Last name: ${last.error}` };

  const email = validateCandidateFieldInput("email", draft.email);
  if (!email.ok) return { ok: false, error: email.error };

  const phone = validateCandidateFieldInput("phone", draft.phone);
  if (!phone.ok) return { ok: false, error: phone.error };

  return { ok: true };
}

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const busy = saving || localSaving;

  function openEditor() {
    if (busy) return;
    setDraft({
      ...value,
      phone: formatPhoneForEdit(value.phone),
    });
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditor() {
    setDraft(value);
    setSaveError(null);
    setEditing(false);
  }

  async function handleSave() {
    if (busy) return;

    const validated = validateReferenceDraft(draft);
    if (!validated.ok) {
      setSaveError(validated.error);
      return;
    }

    const phoneDigits = validateCandidateFieldInput("phone", draft.phone);
    const emailValue = validateCandidateFieldInput("email", draft.email);
    if (!phoneDigits.ok) {
      setSaveError(phoneDigits.error);
      return;
    }
    if (!emailValue.ok) {
      setSaveError(emailValue.error);
      return;
    }

    setLocalSaving(true);
    setSaveError(null);
    try {
      await onSave({
        first: draft.first.trim(),
        last: draft.last.trim(),
        email: emailValue.value,
        phone: phoneDigits.value,
      });
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
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={draft.first}
                onChange={(e) => {
                  setDraft((prev) => ({
                    ...prev,
                    first: filterCandidateFieldInput("person_name", e.target.value),
                  }));
                  if (saveError) setSaveError(null);
                }}
                placeholder="First name"
                disabled={busy}
                className={`min-h-10 w-full rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[var(--brand-primary)] ${
                  saveError ? "border-red-400" : "border-[#D1D5DB]"
                }`}
              />
              <input
                type="text"
                value={draft.last}
                onChange={(e) => {
                  setDraft((prev) => ({
                    ...prev,
                    last: filterCandidateFieldInput("person_name", e.target.value),
                  }));
                  if (saveError) setSaveError(null);
                }}
                placeholder="Last name"
                disabled={busy}
                className={`min-h-10 w-full rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[var(--brand-primary)] ${
                  saveError ? "border-red-400" : "border-[#D1D5DB]"
                }`}
              />
              <input
                type="email"
                value={draft.email}
                onChange={(e) => {
                  setDraft((prev) => ({
                    ...prev,
                    email: filterCandidateFieldInput("email", e.target.value),
                  }));
                  if (saveError) setSaveError(null);
                }}
                placeholder="Email"
                disabled={busy}
                className={`min-h-10 w-full rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[var(--brand-primary)] ${
                  saveError ? "border-red-400" : "border-[#D1D5DB]"
                }`}
              />
              <input
                type="tel"
                inputMode="tel"
                value={draft.phone}
                onChange={(e) => {
                  setDraft((prev) => ({
                    ...prev,
                    phone: filterCandidateFieldInput("phone", e.target.value),
                  }));
                  if (saveError) setSaveError(null);
                }}
                placeholder="(555) 555-5555"
                disabled={busy}
                maxLength={14}
                className={`min-h-10 w-full rounded-lg border px-3 py-2 text-[14px] outline-none focus:border-[var(--brand-primary)] ${
                  saveError ? "border-red-400" : "border-[#D1D5DB]"
                }`}
              />
            </div>
            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
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
          <CandidateDetailAddButton onClick={openEditor} />
        ) : (
          <div className="group flex items-start justify-between gap-2">
            <span>{displayValue}</span>
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
