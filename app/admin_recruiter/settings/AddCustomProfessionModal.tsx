"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type AssessmentOption = {
  id: string;
  name: string;
};

export type AddCustomProfessionFormValue = {
  name: string;
  description: string;
  assessmentId: string;
};

type Props = {
  open: boolean;
  industryLabel: string;
  assessments: AssessmentOption[];
  creating?: boolean;
  onClose: () => void;
  onCreate: (value: AddCustomProfessionFormValue) => void;
};

const DESCRIPTION_MAX = 100;

const labelClassName = "text-sm font-medium text-[#64748B]";
const fieldClassName =
  "h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)] disabled:bg-[#F8FAFC]";

function RequiredMark() {
  return (
    <span className="text-[#EF4444]" aria-hidden>
      {" "}
      *
    </span>
  );
}

function AssessmentSelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: AssessmentOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.id === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative z-20">
      <button
        type="button"
        aria-label="Select Assessment"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((current) => !current)}
        className={`${fieldClassName} flex items-center justify-between text-left`}
      >
        <span className={selected ? "text-[#0F172A]" : "text-[#94A3B8]"}>
          {selected?.name ?? (options.length === 0 ? "No assessments available" : "Select assessment")}
        </span>
        <ChevronDown className="h-4 w-4 text-[#64748B]" aria-hidden />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Select Assessment"
          className="absolute bottom-[calc(100%+4px)] z-50 max-h-56 w-full overflow-auto rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg"
        >
          {options.map((option) => {
            const isSelected = option.id === value;
            return (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[#EFF6FF] ${
                    isSelected ? "bg-[#DBEAFE] font-medium text-[#0F172A]" : "text-[#0F172A]"
                  }`}
                >
                  <span
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                      isSelected
                        ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] text-white"
                        : "border-[#CBD5E1] bg-white"
                    }`}
                    aria-hidden
                  >
                    {isSelected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                  {option.name}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function AddCustomProfessionModal({
  open,
  industryLabel,
  assessments,
  creating = false,
  onClose,
  onCreate,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assessmentId, setAssessmentId] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setAssessmentId(assessments[0]?.id ?? "");
  }, [open, assessments, industryLabel]);

  if (!open) return null;

  const canSubmit = name.trim().length > 0 && assessmentId.length > 0 && !creating;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-custom-profession-title"
        className="flex w-full max-w-[520px] flex-col overflow-visible rounded-2xl border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-2">
          <h3 id="add-custom-profession-title" className="text-lg font-semibold text-[#0F172A]">
            Add Custom Profession
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={creating}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="relative z-10 space-y-4 overflow-visible px-5 py-3">
          <p className="text-xs text-[#94A3B8]">
            Adding to <span className="font-medium text-[#64748B]">{industryLabel}</span>
          </p>

          <label className="block space-y-1.5">
            <span className={labelClassName}>
              Add Custom Profession to Industry
              <RequiredMark />
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              disabled={creating}
              placeholder="Front-End Developer"
              aria-required
              className={fieldClassName}
            />
          </label>

          <label className="block space-y-1.5">
            <span className={labelClassName}>Description (Optional)</span>
            <textarea
              value={description}
              maxLength={DESCRIPTION_MAX}
              disabled={creating}
              onChange={(event) => setDescription(event.target.value.slice(0, DESCRIPTION_MAX))}
              rows={4}
              placeholder="Describe this profession…"
              className="w-full resize-none rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm leading-6 text-[#0F172A] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)] disabled:bg-[#F8FAFC]"
            />
            <div className="flex justify-end">
              <span className="text-xs text-[#94A3B8]">
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
          </label>

          <div className="relative z-30 block space-y-1.5">
            <span className={labelClassName}>
              Select Assessment
              <RequiredMark />
            </span>
            <AssessmentSelect
              options={assessments}
              value={assessmentId}
              onChange={setAssessmentId}
              disabled={creating}
            />
          </div>
        </div>

        <div className="relative z-0 flex shrink-0 items-center justify-end gap-3 border-t border-[#E5E7EB] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              onCreate({
                name: name.trim(),
                description: description.trim(),
                assessmentId,
              })
            }
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[color:var(--brand-primary)] px-4 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create Profession"}
          </button>
        </div>
      </div>
    </div>
  );
}
