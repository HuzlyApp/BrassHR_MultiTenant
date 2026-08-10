"use client";

import { MapPin } from "lucide-react";
import { useId } from "react";
import { usePlaceAutocomplete } from "@/lib/mapbox/use-place-autocomplete";
import {
  JOB_FORM_INPUT_CLASS,
  JOB_FORM_LABEL_CLASS,
} from "@/app/admin_recruiter/jobs/job-form-shared";

type Props = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  showLabel?: boolean;
  className?: string;
  /** Extra space for suggestion list (e.g. review edit modal). */
  suggestionsClassName?: string;
};

/**
 * Mapbox-backed location input for job requisition forms.
 * Stores the selected Mapbox place name (city / area / address).
 */
export default function JobLocationAutocompleteField({
  id,
  label,
  value,
  onChange,
  placeholder = "Search city, area, or address",
  error,
  showLabel = true,
  className,
  suggestionsClassName,
}: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-suggestions`;
  const {
    suggestions,
    isLoading,
    searchError,
    isOpen,
    isVerified,
    selectSuggestion,
    closeSuggestions,
    openSuggestions,
  } = usePlaceAutocomplete(value);

  const showSuggestions = isOpen && suggestions.length > 0;

  return (
    <div className={className}>
      {showLabel ? (
        <label className={JOB_FORM_LABEL_CLASS} htmlFor={inputId}>
          {label}
        </label>
      ) : (
        <label className="sr-only" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <input
          id={inputId}
          type="text"
          className={`${JOB_FORM_INPUT_CLASS} pl-9 ${
            isVerified
              ? "border-[color:color-mix(in_srgb,var(--brand-primary)_45%,#86EFAC)]"
              : ""
          }`}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => openSuggestions()}
          onBlur={() => {
            window.setTimeout(() => closeSuggestions(), 150);
          }}
        />
        {showSuggestions ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={`${label} suggestions`}
            className={`absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white shadow-lg ${
              suggestionsClassName ?? ""
            }`}
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="w-full px-3 py-2.5 text-left text-sm text-[#334155] transition hover:bg-[#F8FAFC] focus:bg-[#F8FAFC] focus:outline-none"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const selected = selectSuggestion(suggestion);
                    onChange(selected.placeName);
                  }}
                >
                  {suggestion.placeName}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {isLoading ? (
        <p className="mt-1.5 text-xs text-[#64748B]">Searching locations…</p>
      ) : null}
      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : null}
      {!error && searchError ? (
        <p className="mt-1.5 text-xs text-[#64748B]" role="status">
          {searchError}
        </p>
      ) : null}
    </div>
  );
}
