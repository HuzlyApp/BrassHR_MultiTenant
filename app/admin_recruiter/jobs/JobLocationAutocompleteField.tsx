"use client";

import { MapPin } from "lucide-react";
import { useId } from "react";
import { usePlaceAutocomplete } from "@/lib/mapbox/use-place-autocomplete";
import {
  JOB_FORM_INPUT_CLASS,
  JOB_FORM_LABEL_CLASS,
} from "@/app/admin_recruiter/jobs/job-form-shared";
import { JobFormRequiredMark } from "@/app/admin_recruiter/jobs/JobFormRequiredMark";
import { normalizeJobFormLocationForStorage } from "@/lib/location/city-state";

type Props = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** ZIP from search select — stored separately; no UI field. */
  onPostalCodeChange?: (postalCode: string | null) => void;
  placeholder?: string;
  error?: string;
  showLabel?: boolean;
  required?: boolean;
  className?: string;
  /** Extra space for suggestion list (e.g. review edit modal). */
  suggestionsClassName?: string;
};

/**
 * Mapbox-backed location input for job create/edit.
 * Suggestions and value keep street/area, city, full state name (no ZIP / United States).
 * ZIP is emitted via onPostalCodeChange when found.
 */
export default function JobLocationAutocompleteField({
  id,
  label,
  value,
  onChange,
  onPostalCodeChange,
  placeholder = "Search city, area, or address",
  error,
  showLabel = true,
  required = false,
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
          {required ? <JobFormRequiredMark /> : null}
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
          onChange={(event) => {
            const next = event.target.value;
            onChange(next);
            if (!next.trim() && onPostalCodeChange) onPostalCodeChange(null);
          }}
          onFocus={() => openSuggestions()}
          onBlur={() => {
            const { location, zipCode } = normalizeJobFormLocationForStorage(value);
            const nextLocation = location || value.trim();
            if (nextLocation !== value) onChange(nextLocation);
            if (onPostalCodeChange) {
              if (!nextLocation) onPostalCodeChange(null);
              else if (zipCode) onPostalCodeChange(zipCode);
            }
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
            {suggestions.map((suggestion) => {
              const labelText =
                suggestion.displayLabel ||
                normalizeJobFormLocationForStorage(suggestion.placeName).location ||
                suggestion.placeName;
              return (
                <li key={suggestion.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left text-sm text-[#334155] transition hover:bg-[#F8FAFC] focus:bg-[#F8FAFC] focus:outline-none"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      selectSuggestion(suggestion, labelText);
                      onChange(labelText);
                      if (onPostalCodeChange) {
                        onPostalCodeChange(suggestion.zipCode);
                      }
                    }}
                  >
                    {labelText}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      {isLoading ? (
        <p className="mt-1.5 text-sm text-[#64748B]">Searching locations…</p>
      ) : null}
      {error ? <p className="mt-1.5 text-sm text-rose-600">{error}</p> : null}
      {!error && searchError ? (
        <p className="mt-1.5 text-sm text-[#64748B]" role="status">
          {searchError}
        </p>
      ) : null}
    </div>
  );
}
