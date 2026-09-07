"use client";

import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { X } from "lucide-react";

type FilterChipInputProps = {
  values: string[];
  suggestions?: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
  /** Nest inside another bordered control (e.g. candidates toolbar). */
  embedded?: boolean;
  "aria-label"?: string;
  /**
   * Fired on Enter after committing any draft chip text.
   * Receives the skill list that should be used for search (includes newly committed chips).
   */
  onEnterSubmit?: (nextValues: string[]) => void;
};

function mergeChipValues(values: string[], raw: string): string[] {
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return values;
  const next = [...values];
  for (const part of parts) {
    if (!next.some((value) => value.toLowerCase() === part.toLowerCase())) next.push(part);
  }
  return next;
}

/** Comma/Enter chip input used by candidate skill (and similar) filters. */
export function FilterChipInput({
  values,
  suggestions = [],
  placeholder,
  onChange,
  embedded = false,
  "aria-label": ariaLabel,
  onEnterSubmit,
}: FilterChipInputProps) {
  const [draft, setDraft] = useState("");
  const unused = suggestions.filter(
    (item) => !values.some((value) => value.toLowerCase() === item.toLowerCase())
  );

  function commit(raw: string) {
    const next = mergeChipValues(values, raw);
    if (next.length === values.length && !raw.trim()) return;
    const parts = raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) return;
    onChange(next);
    setDraft("");
  }

  return (
    <div className={embedded ? "min-w-0 flex-1" : undefined}>
      <div
        className={
          embedded
            ? "flex min-h-9 min-w-0 flex-wrap items-center gap-1.5 bg-transparent"
            : "flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-2 py-1.5"
        }
      >
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-black"
          >
            <span className="truncate">{value}</span>
            <button
              type="button"
              className="shrink-0 text-black/60 hover:text-black"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter") {
              event.preventDefault();
              const next = draft.trim() ? mergeChipValues(values, draft) : values;
              if (draft.trim()) {
                onChange(next);
                setDraft("");
              }
              onEnterSubmit?.(next);
              return;
            }
            if (event.key === ",") {
              event.preventDefault();
              commit(draft);
              return;
            }
            if (event.key === "Backspace" && !draft && values.length) {
              event.preventDefault();
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
          placeholder={values.length ? "" : placeholder}
          aria-label={ariaLabel ?? placeholder}
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-[#334155] outline-none placeholder:text-[#94A3B8]"
        />
      </div>
      {!embedded && unused.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {unused.slice(0, 8).map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-full border border-[#E2E8F0] bg-white px-2 py-0.5 text-[11px] text-[#64748B] hover:border-[#CBD5E1] hover:text-[#334155]"
              onClick={() => onChange([...values, item])}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
