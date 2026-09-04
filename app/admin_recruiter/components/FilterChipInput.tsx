"use client";

import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { X } from "lucide-react";

type FilterChipInputProps = {
  values: string[];
  suggestions?: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
};

/** Comma/Enter chip input used by candidate skill (and similar) filters. */
export function FilterChipInput({
  values,
  suggestions = [],
  placeholder,
  onChange,
}: FilterChipInputProps) {
  const [draft, setDraft] = useState("");
  const unused = suggestions.filter(
    (item) => !values.some((value) => value.toLowerCase() === item.toLowerCase())
  );

  function commit(raw: string) {
    const parts = raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    for (const part of parts) {
      if (!next.some((value) => value.toLowerCase() === part.toLowerCase())) next.push(part);
    }
    onChange(next);
    setDraft("");
  }

  return (
    <div>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-2 py-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs text-[#334155]"
          >
            {value}
            <button
              type="button"
              className="text-[#64748B] hover:text-[#0F172A]"
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
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit(draft);
            }
          }}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
          placeholder={values.length ? "" : placeholder}
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-[#334155] outline-none placeholder:text-[#94A3B8]"
        />
      </div>
      {unused.length ? (
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
