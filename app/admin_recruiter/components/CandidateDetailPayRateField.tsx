"use client";

import { useEffect, useState } from "react";
import BrandedEditIcon from "./BrandedEditIcon";
import CandidateDetailAddButton from "./CandidateDetailAddButton";
import {
  WORKER_PAY_RATE_PERIODS,
  formatWorkerPayRateDisplay,
  normalizeWorkerPayRateAmount,
  normalizeWorkerPayRatePeriod,
  type WorkerPayRatePeriod,
} from "@/lib/admin/worker-pay-rate";
import { filterCandidateFieldInput } from "@/lib/admin/worker-profile-field-client";

type CandidateDetailPayRateFieldProps = {
  amount: string | null | undefined;
  period: string | null | undefined;
  isMissing: boolean;
  saving?: boolean;
  onSave: (value: { amount: string; period: WorkerPayRatePeriod }) => Promise<void>;
};

export default function CandidateDetailPayRateField({
  amount,
  period,
  isMissing,
  saving = false,
  onSave,
}: CandidateDetailPayRateFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draftAmount, setDraftAmount] = useState(amount ?? "");
  const [draftPeriod, setDraftPeriod] = useState<WorkerPayRatePeriod>(
    normalizeWorkerPayRatePeriod(period)
  );
  const [localSaving, setLocalSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const busy = saving || localSaving;
  const displayValue = formatWorkerPayRateDisplay(amount, period);

  useEffect(() => {
    if (!editing) {
      setDraftAmount(amount ?? "");
      setDraftPeriod(normalizeWorkerPayRatePeriod(period));
    }
  }, [amount, period, editing]);

  function openEditor() {
    if (busy) return;
    setDraftAmount(amount ?? "");
    setDraftPeriod(normalizeWorkerPayRatePeriod(period));
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditor() {
    setDraftAmount(amount ?? "");
    setDraftPeriod(normalizeWorkerPayRatePeriod(period));
    setSaveError(null);
    setEditing(false);
  }

  async function handleSave() {
    if (busy) return;
    const parsed = normalizeWorkerPayRateAmount(draftAmount);
    if (!parsed.ok) {
      setSaveError(parsed.error);
      return;
    }

    setLocalSaving(true);
    setSaveError(null);
    try {
      await onSave({ amount: parsed.value, period: draftPeriod });
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setLocalSaving(false);
    }
  }

  return (
    <>
      <div className="border-b border-[#E5E7EB] px-3 py-3 text-[14px] font-normal leading-5 text-[#374151] sm:border-r sm:px-5">
        Pay Rate
      </div>
      <div className="border-b border-[#E5E7EB] px-3 py-3 text-[14px] font-normal leading-5 break-all text-[#111827] sm:px-5">
        {editing ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={draftPeriod}
                onChange={(e) => {
                  setDraftPeriod(normalizeWorkerPayRatePeriod(e.target.value));
                  if (saveError) setSaveError(null);
                }}
                disabled={busy}
                aria-label="Pay rate period"
                className={`min-h-10 w-full min-w-[140px] rounded-lg border bg-white px-3 py-2 text-[14px] text-[#111827] outline-none focus:border-[var(--brand-primary)] sm:w-40 ${
                  saveError ? "border-red-400" : "border-[#D1D5DB]"
                }`}
              >
                {WORKER_PAY_RATE_PERIODS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                type="text"
                inputMode="decimal"
                value={draftAmount}
                onChange={(e) => {
                  setDraftAmount(filterCandidateFieldInput("hourly_rate", e.target.value));
                  if (saveError) setSaveError(null);
                }}
                placeholder="25.00"
                disabled={busy}
                aria-label="Pay rate amount"
                className={`min-h-10 w-full min-w-0 flex-1 rounded-lg border px-3 py-2 text-[14px] text-[#111827] outline-none focus:border-[var(--brand-primary)] ${
                  saveError ? "border-red-400" : "border-[#D1D5DB]"
                }`}
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
            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          </div>
        ) : isMissing ? (
          <CandidateDetailAddButton onClick={openEditor} />
        ) : (
          <div className="group flex items-start justify-between gap-2">
            <span>{displayValue}</span>
            <button
              type="button"
              onClick={openEditor}
              aria-label="Edit Pay Rate"
              className="mt-0.5 shrink-0 cursor-pointer opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
            >
              <BrandedEditIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
