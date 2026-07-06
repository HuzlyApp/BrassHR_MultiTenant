"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { CandidateListAvatar } from "./CandidateListAvatar";
import type { MailComposeDropdownOption } from "./MailComposeDropdown";

type CandidateTab = "applicants" | "workers";

type MailComposeCandidateDropdownProps = {
  id?: string;
  value: string;
  applicantOptions: MailComposeDropdownOption[];
  workerOptions: MailComposeDropdownOption[];
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  onChange: (value: string) => void;
};

const TALL_TRIGGER_CLASS = "min-h-[3.25rem]";
const PLACEHOLDER_CLASS = "text-lg font-medium text-[#94A3B8]";

const OPTION_HOVER = "hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)]";
const OPTION_SELECTED = "bg-[color-mix(in_srgb,var(--brand-primary)_12%,white)]";

function matchesSearch(option: MailComposeDropdownOption, query: string): boolean {
  if (!query) return true;
  const haystack = `${option.label} ${option.sublabel ?? ""}`.toLowerCase();
  return haystack.includes(query);
}

function OptionAvatar({ option }: { option: MailComposeDropdownOption }) {
  return (
    <CandidateListAvatar
      name={option.label}
      photoUrl={option.avatarUrl}
      className="h-9 w-9 text-sm"
    />
  );
}

export function MailComposeCandidateDropdown({
  id,
  value,
  applicantOptions,
  workerOptions,
  placeholder,
  disabled = false,
  loading = false,
  loadingLabel = "Loading...",
  onChange,
}: MailComposeCandidateDropdownProps) {
  const branding = useTenantBranding();
  const brandVars = brandingToCssVars(branding) as CSSProperties;
  const autoId = useId();
  const listboxId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CandidateTab>("applicants");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const allOptions = useMemo(
    () => [...applicantOptions, ...workerOptions],
    [applicantOptions, workerOptions]
  );

  const selected = allOptions.find((option) => option.value === value) ?? null;

  const tabOptions = activeTab === "applicants" ? applicantOptions : workerOptions;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredOptions = useMemo(
    () => tabOptions.filter((option) => matchesSearch(option, normalizedQuery)),
    [normalizedQuery, tabOptions]
  );

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      return;
    }
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open, activeTab]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const menu = document.getElementById(`${listboxId}-list`);
      if (menu?.contains(target)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, listboxId]);

  useEffect(() => {
    if (!value) return;
    const inApplicants = applicantOptions.some((option) => option.value === value);
    const inWorkers = workerOptions.some((option) => option.value === value);
    if (inWorkers && !inApplicants) setActiveTab("workers");
    else if (inApplicants) setActiveTab("applicants");
  }, [value, applicantOptions, workerOptions]);

  if (loading) {
    return (
      <div
        className={`flex min-w-0 flex-1 items-center rounded-md border border-[#E5E7EB] bg-white px-3 text-[#6B7280] ${TALL_TRIGGER_CLASS} text-lg font-medium`}
        aria-busy="true"
      >
        {loadingLabel}
      </div>
    );
  }

  const menu =
    open && menuStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            id={`${listboxId}-list`}
            role="listbox"
            aria-labelledby={listboxId}
            style={{
              position: "fixed",
              top: menuStyle.top,
              left: menuStyle.left,
              width: menuStyle.width,
              ...brandVars,
            }}
            className="z-200 overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--brand-primary)_18%,#E5E7EB)] bg-white shadow-lg"
          >
            <div className="flex border-b border-[#E5E7EB] p-1">
              {(
                [
                  { id: "applicants" as const, label: "Applicants" },
                  { id: "workers" as const, label: "Workers" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? "bg-white text-(--brand-primary) shadow-sm ring-1 ring-[color-mix(in_srgb,var(--brand-primary)_25%,#E5E7EB)]"
                      : "text-[#64748B] hover:text-[#111827]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="border-b border-[#E5E7EB] p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  ref={searchRef}
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name or email"
                  className="h-10 w-full rounded-md border border-[#E5E7EB] bg-white py-2 pr-3 pl-9 text-sm text-[#111827] outline-none placeholder:text-[#94A3B8] focus:border-(--brand-primary) focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_18%,white)]"
                />
              </div>
            </div>

            <ul className="max-h-56 overflow-y-auto py-1">
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${OPTION_HOVER} ${
                    !value ? `${OPTION_SELECTED} text-(--brand-primary)` : "text-[#64748B]"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{placeholder}</span>
                  {!value ? <Check className="h-4 w-4 shrink-0 text-(--brand-primary)" /> : null}
                </button>
              </li>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <li key={`${activeTab}-${option.value}`} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${OPTION_HOVER} ${
                          isSelected ? OPTION_SELECTED : ""
                        }`}
                      >
                        <OptionAvatar option={option} />
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate ${isSelected ? "font-semibold text-(--brand-primary)" : "font-medium text-[#111827]"}`}
                          >
                            {option.label}
                          </span>
                          {option.sublabel ? (
                            <span className="block truncate text-xs text-[#64748B]">{option.sublabel}</span>
                          ) : null}
                        </span>
                        {isSelected ? (
                          <Check className="h-4 w-4 shrink-0 text-(--brand-primary)" />
                        ) : null}
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="px-3 py-4 text-center text-sm text-[#64748B]">
                  {normalizedQuery ? "No matches found." : "No one listed yet."}
                </li>
              )}
            </ul>
          </div>,
          document.body
        )
      : null;

  const showCenteredPlaceholder = !selected;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        ref={triggerRef}
        type="button"
        id={listboxId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${listboxId}-list`}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        className={`relative flex w-full min-w-0 items-center gap-3 rounded-md border px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${TALL_TRIGGER_CLASS} ${
          selected ? "text-left text-sm" : ""
        } ${
          open
            ? "border-(--brand-primary) bg-white ring-2 ring-[color-mix(in_srgb,var(--brand-primary)_18%,white)]"
            : "border-[#E5E7EB] bg-white hover:border-[color-mix(in_srgb,var(--brand-primary)_35%,#E5E7EB)]"
        }`}
      >
        {selected ? (
          <>
            <OptionAvatar option={selected} />
            <span className="min-w-0 flex-1 truncate text-[#111827]">
              <span className="block min-w-0 text-left">
                <span className="block truncate font-medium">{selected.label}</span>
                {selected.sublabel ? (
                  <span className="block truncate text-xs text-[#64748B]">{selected.sublabel}</span>
                ) : (
                  <span className="block truncate text-xs leading-4 opacity-0" aria-hidden>
                    &nbsp;
                  </span>
                )}
              </span>
            </span>
          </>
        ) : showCenteredPlaceholder ? (
          <span
            className={`pointer-events-none absolute inset-0 flex items-center justify-center px-10 ${PLACEHOLDER_CLASS}`}
          >
            <span className="truncate">{placeholder}</span>
          </span>
        ) : (
          <span className={`min-w-0 flex-1 truncate ${PLACEHOLDER_CLASS}`}>{placeholder}</span>
        )}
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-(--brand-primary) transition ${
            showCenteredPlaceholder ? "absolute top-1/2 right-3 -translate-y-1/2" : "relative ml-auto"
          } ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {menu}
    </div>
  );
}
