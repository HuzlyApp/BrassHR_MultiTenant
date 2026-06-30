"use client";

import { useEffect, useState } from "react";
import BrandedEditIcon from "./BrandedEditIcon";
import CandidateDetailAddButton from "./CandidateDetailAddButton";
import type { SelectOption } from "./CandidateDetailSelectField";

type CandidateDetailCityFieldProps = {
  label: string;
  displayValue: string;
  editValue: string;
  isMissing: boolean;
  stateCode: string;
  stateDisplay: string;
  states: SelectOption[];
  cities: SelectOption[];
  citiesLoading?: boolean;
  saving?: boolean;
  onLoadCities: (stateCode: string) => Promise<void>;
  onSave: (city: string, stateCode: string) => Promise<void>;
};

export default function CandidateDetailCityField({
  label,
  displayValue,
  editValue,
  isMissing,
  stateCode,
  stateDisplay,
  states,
  cities,
  citiesLoading = false,
  saving = false,
  onLoadCities,
  onSave,
}: CandidateDetailCityFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draftState, setDraftState] = useState(stateCode);
  const [draftCity, setDraftCity] = useState(editValue);
  const [localSaving, setLocalSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const busy = saving || localSaving;

  useEffect(() => {
    if (!editing) {
      setDraftState(stateCode);
      setDraftCity(editValue);
    }
  }, [editValue, stateCode, editing]);

  useEffect(() => {
    if (!editing || !draftState) return;
    void onLoadCities(draftState);
  }, [draftState, editing, onLoadCities]);

  function openEditor() {
    if (busy) return;
    setDraftState(stateCode);
    setDraftCity(editValue);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditor() {
    setDraftState(stateCode);
    setDraftCity(editValue);
    setSaveError(null);
    setEditing(false);
  }

  async function handleSave() {
    if (busy) return;
    if (!draftState.trim()) {
      setSaveError("Pick a state first.");
      return;
    }
    if (!draftCity.trim()) {
      setSaveError("Pick a city.");
      return;
    }

    setLocalSaving(true);
    setSaveError(null);
    try {
      await onSave(draftCity, draftState);
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={draftState}
                onChange={(e) => {
                  setDraftState(e.target.value);
                  setDraftCity("");
                  if (saveError) setSaveError(null);
                }}
                disabled={busy}
                className="min-h-10 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-[14px] outline-none focus:border-[var(--brand-primary)]"
              >
                <option value="">Pick state</option>
                {states.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={draftCity}
                onChange={(e) => {
                  setDraftCity(e.target.value);
                  if (saveError) setSaveError(null);
                }}
                disabled={busy || citiesLoading || !draftState}
                className="min-h-10 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-[14px] outline-none focus:border-[var(--brand-primary)]"
              >
                <option value="">
                  {citiesLoading ? "Loading cities…" : draftState ? "Pick city" : "Pick state first"}
                </option>
                {cities.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={busy || citiesLoading}
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
            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
          </div>
        ) : isMissing ? (
          <CandidateDetailAddButton onClick={openEditor} />
        ) : (
          <div className="group flex items-start justify-between gap-2">
            <span>
              {displayValue}
              {stateDisplay ? (
                <span className="text-[#6B7280]">{`, ${stateDisplay}`}</span>
              ) : null}
            </span>
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
