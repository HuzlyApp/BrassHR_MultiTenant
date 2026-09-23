"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStateNameFromCode, US_STATE_NAME_TO_CODE } from "@/lib/us-state-names";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ListTableCheckbox } from "@/app/admin_recruiter/components/ListTableCheckbox";
import {
  JOB_FORM_LABEL_CLASS,
  JOB_FORM_SELECT_CHEVRON,
  JOB_FORM_SELECT_CLASS,
  JOB_FORM_SURFACE_CLASS,
  type RemoteStatesScope,
} from "./job-form-shared";
import { JobFormRequiredMark } from "./JobFormRequiredMark";

type StateOption = { code: string; name: string };

const FALLBACK_STATES: StateOption[] = Object.entries(US_STATE_NAME_TO_CODE)
  .map(([name, code]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function formatRemoteAllowedStatesLabel(states: string[] | null | undefined): string {
  if (!states?.length) return "All States";
  return states
    .map((code) => getStateNameFromCode(code) ?? code)
    .filter(Boolean)
    .join(", ");
}

export function showsRemoteAllowedStatesField(locationType: string | null | undefined): boolean {
  return Boolean(locationType?.toLowerCase().includes("remote"));
}

function ChevronIcon({ open }: { open?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M4 6.5L8 10.5L12 6.5"
        stroke="#94A3B8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RemoteAllowedStatesField({
  value,
  scope,
  error,
  onChange,
  onScopeChange,
  required = false,
}: {
  value: string[];
  scope: RemoteStatesScope;
  error?: string;
  onChange: (next: string[]) => void;
  onScopeChange: (next: RemoteStatesScope) => void;
  required?: boolean;
}) {
  const [states, setStates] = useState<StateOption[]>(FALLBACK_STATES);
  const [loadingStates, setLoadingStates] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    let active = true;
    setLoadingStates(true);
    void (async () => {
      try {
        const { data, error: fetchError } = await supabaseBrowser
          .from("signup_us_states")
          .select("code, name")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });

        if (!active || fetchError || !data?.length) return;

        setStates(
          data.map((row) => ({
            code: String(row.code).trim().toUpperCase(),
            name: String(row.name).trim(),
          }))
        );
      } finally {
        if (active) setLoadingStates(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setQuery("");
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const filteredStates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return states;
    return states.filter(
      (state) =>
        state.name.toLowerCase().includes(needle) || state.code.toLowerCase().includes(needle)
    );
  }, [query, states]);

  const selectedLabels = useMemo(
    () =>
      value
        .map((code) => {
          const fromList = states.find((state) => state.code === code)?.name;
          return fromList ?? getStateNameFromCode(code) ?? code;
        })
        .filter(Boolean),
    [states, value]
  );

  function toggleState(code: string) {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(Array.from(next));
  }

  return (
    <div className="min-[700px]:col-span-2" ref={rootRef}>
      <p className={JOB_FORM_LABEL_CLASS}>
        Remote work allowed in
        {required ? <JobFormRequiredMark /> : null}
      </p>
      <p className="mb-2 text-xs text-[#64748B]">
        Defaults to All States. Restrict only when the role is limited to specific states.
      </p>

      <select
        aria-label="Remote work state scope"
        className={`${JOB_FORM_SELECT_CLASS} ${scope ? "text-[#334155]" : "text-[#94A3B8]"}`}
        style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
        value={scope}
        onChange={(event) => {
          const nextScope = event.target.value as RemoteStatesScope;
          onScopeChange(nextScope);
          if (nextScope === "all") {
            onChange([]);
            setMenuOpen(false);
            setQuery("");
          } else {
            setMenuOpen(true);
          }
        }}
      >
        <option value="all">All States</option>
        <option value="restrict">Restrict to specific states</option>
      </select>

      {scope === "restrict" ? (
        <div className="mt-3 space-y-2">
          <div className="relative">
            <button
              type="button"
              className={`${JOB_FORM_SURFACE_CLASS} flex h-10 w-full items-center justify-between gap-2 px-3 text-left outline-none transition focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_12%,transparent)]`}
              aria-expanded={menuOpen}
              aria-haspopup="listbox"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className={`truncate ${selectedLabels.length ? "text-[#334155]" : "text-[#94A3B8]"}`}>
                {selectedLabels.length
                  ? `${selectedLabels.length} state${selectedLabels.length === 1 ? "" : "s"} selected`
                  : loadingStates
                    ? "Loading states…"
                    : "Select states to allow"}
              </span>
              <ChevronIcon open={menuOpen} />
            </button>

            {menuOpen ? (
              <div
                className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-[#CBD5E1] bg-white shadow-sm"
                role="listbox"
                aria-multiselectable="true"
              >
                <div className="border-b border-[#E2E8F0] p-2">
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search states"
                    className="h-9 w-full rounded-md border border-[#CBD5E1] px-3 text-sm text-[#334155] outline-none focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_12%,transparent)]"
                    autoFocus
                  />
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {filteredStates.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-[#94A3B8]">No states match your search.</p>
                  ) : (
                    filteredStates.map((state) => {
                      const checked = selected.has(state.code);
                      return (
                        <label
                          key={state.code}
                          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-[#334155] hover:bg-[#F8FAFC]"
                        >
                          <ListTableCheckbox
                            size="sm"
                            checked={checked}
                            onChange={() => toggleState(state.code)}
                            aria-label={state.name}
                          />
                          <span className="flex-1">{state.name}</span>
                          <span className="text-xs text-[#94A3B8]">{state.code}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {selectedLabels.length ? (
            <div className="flex flex-wrap gap-2">
              {value.map((code) => {
                const label =
                  states.find((state) => state.code === code)?.name ??
                  getStateNameFromCode(code) ??
                  code;
                return (
                  <button
                    key={code}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] px-3 py-1 text-xs font-medium text-[#1D2739]"
                    onClick={() => toggleState(code)}
                    aria-label={`Remove ${label}`}
                  >
                    {label}
                    <span aria-hidden className="text-[#64748B]">
                      ×
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <span className="mt-1 block text-sm text-rose-600">{error}</span> : null}
    </div>
  );
}
