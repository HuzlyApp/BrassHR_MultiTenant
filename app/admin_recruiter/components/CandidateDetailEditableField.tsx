"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import BrandedEditIcon from "./BrandedEditIcon";
import CandidateDetailAddButton from "./CandidateDetailAddButton";
import CandidateDetailFieldEditModal from "./CandidateDetailFieldEditModal";
import {
  CANDIDATE_DETAIL_LABEL_CELL_CLASS,
  CANDIDATE_DETAIL_VALUE_CELL_CLASS,
} from "./candidate-detail-field-layout";
import { useCompactViewport } from "@/app/admin_recruiter/hooks/useCompactViewport";
import {
  type CandidateFieldKind,
  filterCandidateFieldInput,
  validateCandidateFieldInput,
} from "@/lib/admin/worker-profile-field-client";
import { PROFILE_FIELD_OPEN_EDIT_EVENT } from "@/lib/admin/candidate-profile-sections";
import { PERSON_NAME_MAX_LENGTH } from "@/lib/person-name";

const SSN_HIDDEN_PREFIX = "********"; // first 8 digits always masked

function ssnLastFourDigits(value: string): string {
  return value.replace(/\D/g, "").slice(-4);
}

/** Eye off: last 4 hidden too. Eye on: 8 * + last 4. */
function formatSsnLastFourDisplay(value: string, revealed: boolean): string {
  const digits = ssnLastFourDigits(value);
  if (!digits) return value.trim() === "—" ? "—" : `${SSN_HIDDEN_PREFIX}****`;
  return revealed ? `${SSN_HIDDEN_PREFIX}${digits}` : `${SSN_HIDDEN_PREFIX}****`;
}

function maskSensitiveDisplay(fieldKind: CandidateFieldKind, value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") return trimmed || "—";
  if (fieldKind === "ssn_last_four") {
    return formatSsnLastFourDisplay(trimmed, false);
  }
  if (fieldKind === "date_of_birth") {
    return "********";
  }
  return trimmed;
}

function formatSensitiveDisplay(fieldKind: CandidateFieldKind, value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") return trimmed || "—";
  if (fieldKind === "ssn_last_four") {
    return formatSsnLastFourDisplay(trimmed, true);
  }
  return trimmed;
}

type CandidateDetailEditableFieldProps = {
  label: ReactNode;
  /** Used for aria-labels when `label` is not a plain string. */
  accessibilityLabel?: string;
  displayValue: string;
  editValue: string;
  isMissing: boolean;
  fieldKind: CandidateFieldKind;
  editable?: boolean;
  placeholder?: string;
  highlightValue?: boolean;
  /** Mask value until eye icon is clicked (DOB / SSN). */
  maskUntilRevealed?: boolean;
  saving?: boolean;
  anchorId?: string;
  onSave: (value: string) => Promise<void>;
};

export default function CandidateDetailEditableField({
  label,
  accessibilityLabel,
  displayValue,
  editValue,
  isMissing,
  fieldKind,
  editable = true,
  placeholder,
  highlightValue = false,
  maskUntilRevealed = false,
  saving = false,
  anchorId,
  onSave,
}: CandidateDetailEditableFieldProps) {
  const fieldLabel =
    accessibilityLabel?.trim() || (typeof label === "string" ? label : "Field");
  const compact = useCompactViewport();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(editValue);
  const [localSaving, setLocalSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const busy = saving || localSaving;
  const isSensitive = maskUntilRevealed;
  const showInlineEditor = editing && !compact;
  const showModalEditor = editing && compact;

  const inputMode =
    fieldKind === "email"
      ? "email"
      : fieldKind === "phone" || fieldKind === "ssn_last_four"
        ? "tel"
        : fieldKind === "years_experience" || fieldKind === "hourly_rate"
          ? "decimal"
          : "text";

  const inputType =
    fieldKind === "email"
      ? "email"
      : fieldKind === "phone" || fieldKind === "ssn_last_four"
        ? "tel"
        : fieldKind === "years_experience" || fieldKind === "hourly_rate"
          ? "text"
          : "text";

  const inputMaxLength =
    fieldKind === "ssn_last_four"
      ? 4
      : fieldKind === "date_of_birth"
        ? 10
        : fieldKind === "phone"
          ? 14
          : fieldKind === "zip"
            ? 10
            : fieldKind === "person_name"
              ? PERSON_NAME_MAX_LENGTH
              : fieldKind === "short_text"
                ? 120
                : undefined;

  function openEditor() {
    if (!editable || busy) return;
    setDraft(editValue);
    setSaveError(null);
    setEditing(true);
  }

  useEffect(() => {
    if (!anchorId) return;
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string }>;
      if (customEvent.detail?.id !== anchorId) return;
      if (!editable || busy) return;
      setDraft(editValue);
      setSaveError(null);
      setEditing(true);
    };
    window.addEventListener(PROFILE_FIELD_OPEN_EDIT_EVENT, handler);
    return () => window.removeEventListener(PROFILE_FIELD_OPEN_EDIT_EVENT, handler);
  }, [anchorId, editable, busy, editValue]);

  function cancelEditor() {
    setDraft(editValue);
    setSaveError(null);
    setEditing(false);
  }

  function handleDraftChange(next: string) {
    setDraft(filterCandidateFieldInput(fieldKind, next));
    if (saveError) setSaveError(null);
  }

  async function handleSave() {
    if (busy) return;
    const validated = validateCandidateFieldInput(fieldKind, draft);
    if (!validated.ok) {
      setSaveError(validated.error);
      return;
    }

    setLocalSaving(true);
    setSaveError(null);
    try {
      await onSave(validated.value);
      setEditing(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save";
      setSaveError(message);
    } finally {
      setLocalSaving(false);
    }
  }

  const editorInput = (
    <input
      type={inputType}
      inputMode={inputMode}
      value={draft}
      onChange={(e) => handleDraftChange(e.target.value)}
      placeholder={placeholder}
      disabled={busy}
      maxLength={inputMaxLength}
      autoFocus={showModalEditor}
      className={`min-h-10 w-full min-w-0 flex-1 rounded-lg border px-3 py-2 text-[14px] text-[#111827] outline-none focus:border-[var(--brand-primary)] ${
        saveError ? "border-red-400" : "border-[#D1D5DB]"
      }`}
    />
  );

  const displayContent = (
    <div className="group flex items-start justify-between gap-2">
      <span className={highlightValue ? "text-[var(--brand-primary)]" : ""}>
        {isSensitive
          ? revealed
            ? formatSensitiveDisplay(fieldKind, displayValue)
            : maskSensitiveDisplay(fieldKind, displayValue)
          : displayValue}
      </span>
      <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
        {isSensitive ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? `Hide ${fieldLabel}` : `Show ${fieldLabel}`}
            className="inline-flex cursor-pointer text-[#6B7280] transition-colors hover:text-[color:var(--brand-primary)]"
          >
            {revealed ? (
              <Eye className="h-4 w-4" aria-hidden />
            ) : (
              <EyeOff className="h-4 w-4" aria-hidden />
            )}
          </button>
        ) : null}
        <button
          type="button"
          onClick={openEditor}
          aria-label={`Edit ${fieldLabel}`}
          className="cursor-pointer opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
        >
          <BrandedEditIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div
        id={anchorId}
        className={`${CANDIDATE_DETAIL_LABEL_CELL_CLASS}${anchorId ? " scroll-mt-24" : ""}`}
      >
        {label}
      </div>
      <div className={CANDIDATE_DETAIL_VALUE_CELL_CLASS}>
        {!editable ? (
          <span className={highlightValue ? "text-[var(--brand-primary)]" : ""}>{displayValue}</span>
        ) : showInlineEditor ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {editorInput}
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
            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          </div>
        ) : isMissing ? (
          <CandidateDetailAddButton onClick={openEditor} />
        ) : (
          displayContent
        )}
      </div>

      <CandidateDetailFieldEditModal
        open={showModalEditor}
        title={isMissing ? `Add ${fieldLabel}` : `Edit ${fieldLabel}`}
        busy={busy}
        error={saveError}
        onClose={cancelEditor}
        onSave={() => void handleSave()}
      >
        <label className="mb-2 block text-sm font-medium text-[#374151]">{fieldLabel}</label>
        {editorInput}
      </CandidateDetailFieldEditModal>
    </>
  );
}
