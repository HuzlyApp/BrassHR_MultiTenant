"use client";

import {
  Accessibility,
  Braces,
  Check,
  ChevronDown,
  Code2,
  Dna,
  HeartPulse,
  MoreHorizontal,
  Search,
  Stethoscope,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

export type AddIndustryOption = {
  key: string;
  label: string;
};

export type AddIndustryProfessionOption = {
  key: string;
  name: string;
  industryKey: string;
};

export type AddIndustryFormValue = {
  industryKey: string;
  description: string;
  iconId: string | null;
  catalogKeys: string[];
  customNames: string[];
};

const DESCRIPTION_MAX = 100;

export const INDUSTRY_ICON_OPTIONS = [
  { id: "medical", label: "Medical", bg: "#DBEAFE", fg: "#1D4ED8", Icon: Stethoscope },
  { id: "logistics", label: "Logistics", bg: "#DCFCE7", fg: "#15803D", Icon: Truck },
  { id: "care", label: "Care", bg: "#FCE7F3", fg: "#BE185D", Icon: HeartPulse },
  { id: "science", label: "Science", bg: "#F3E8FF", fg: "#7E22CE", Icon: Dna },
  { id: "access", label: "Accessibility", bg: "#FEF3C7", fg: "#B45309", Icon: Accessibility },
  { id: "person", label: "People", bg: "#E0E7FF", fg: "#4338CA", Icon: UserRound },
  { id: "code", label: "Technology", bg: "#FEE2E2", fg: "#B91C1C", Icon: Braces },
  { id: "clinical", label: "Clinical", bg: "#E0F2FE", fg: "#0369A1", Icon: Code2 },
] as const;

export type IndustryIconId = (typeof INDUSTRY_ICON_OPTIONS)[number]["id"];

type Props = {
  open: boolean;
  mode?: "create" | "edit";
  industries: AddIndustryOption[];
  availableProfessions: AddIndustryProfessionOption[];
  /** Pre-fill for edit mode (and optional create defaults). */
  initialValue?: Partial<AddIndustryFormValue> | null;
  /** Catalog keys already on the industry — stay selected and cannot be unchecked. */
  lockedCatalogKeys?: string[];
  /** Extra custom profession names added via the dedicated modal (create mode). */
  extraCustomNames?: string[];
  creating?: boolean;
  onClose: () => void;
  onSubmit: (value: AddIndustryFormValue) => void;
  onRequestCustomProfession?: (industryKey: string) => void;
  onRemoveExtraCustomName?: (name: string) => void;
};

const labelClassName = "text-sm font-medium text-[#64748B]";
const fieldClassName =
  "h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)]";

function IndustrySelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: AddIndustryOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.key === value);

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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Select Industry"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((current) => !current)}
        className={`${fieldClassName} flex items-center justify-between text-left disabled:bg-[#F8FAFC]`}
      >
        <span className={selected ? "text-[#0F172A]" : "text-[#94A3B8]"}>
          {selected?.label ?? "Select industry"}
        </span>
        <ChevronDown className="h-4 w-4 text-[#64748B]" aria-hidden />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Select Industry"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg"
        >
          {options.map((option) => {
            const isSelected = option.key === value;
            return (
              <li key={option.key} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.key);
                    setOpen(false);
                  }}
                  className={`flex w-full px-3 py-2.5 text-left text-sm hover:bg-[#EFF6FF] ${
                    isSelected ? "bg-[#DBEAFE] font-medium text-[#0F172A]" : "text-[#0F172A]"
                  }`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ProfessionMultiSelect({
  options,
  selectedKeys,
  lockedKeys = [],
  onChange,
  disabled,
}: {
  options: AddIndustryProfessionOption[];
  selectedKeys: string[];
  lockedKeys?: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.name.toLowerCase().includes(needle));
  }, [options, query]);

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

  const lockedSet = useMemo(() => new Set(lockedKeys), [lockedKeys]);

  function toggle(key: string) {
    if (lockedSet.has(key)) return;
    if (selectedKeys.includes(key)) {
      onChange(selectedKeys.filter((item) => item !== key));
      return;
    }
    onChange([...selectedKeys, key]);
  }

  const summary =
    selectedKeys.length === 0
      ? "Add/search Profession"
      : `${selectedKeys.length} profession${selectedKeys.length === 1 ? "" : "s"} selected`;

  return (
    <div ref={rootRef} className="relative z-20">
      <button
        type="button"
        aria-label="Add/search Profession"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((current) => !current)}
        className={`${fieldClassName} flex items-center justify-between text-left disabled:bg-[#F8FAFC]`}
      >
        <span className={selectedKeys.length ? "text-[#0F172A]" : "text-[#94A3B8]"}>{summary}</span>
        <ChevronDown className="h-4 w-4 text-[#64748B]" aria-hidden />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Add Profession to Industry"
          aria-multiselectable="true"
          className="absolute bottom-[calc(100%+4px)] z-50 w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-lg"
        >
          <div className="relative border-b border-[#F1F5F9] p-2">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Profession"
              aria-label="Search Profession"
              className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm text-[#0F172A] outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)]"
            />
          </div>
          <ul className="max-h-48 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-[#94A3B8]">No professions found</li>
            ) : (
              filtered.map((option) => {
                const checked = selectedKeys.includes(option.key);
                const locked = lockedSet.has(option.key);
                return (
                  <li key={option.key} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      aria-disabled={locked}
                      onClick={() => toggle(option.key)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC] ${
                        locked ? "cursor-default opacity-90" : ""
                      }`}
                    >
                      <span
                        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                          checked
                            ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] text-white"
                            : "border-[#CBD5E1] bg-white"
                        }`}
                        aria-hidden
                      >
                        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                      {option.name}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3 py-1" aria-hidden>
      <div className="h-px flex-1 bg-[#E5E7EB]" />
      <span className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">OR</span>
      <div className="h-px flex-1 bg-[#E5E7EB]" />
    </div>
  );
}

export default function AddIndustryModal({
  open,
  mode = "create",
  industries,
  availableProfessions,
  initialValue = null,
  lockedCatalogKeys = [],
  extraCustomNames = [],
  creating = false,
  onClose,
  onSubmit,
  onRequestCustomProfession,
  onRemoveExtraCustomName,
}: Props) {
  const isEdit = mode === "edit";
  const [industryKey, setIndustryKey] = useState("");
  const [description, setDescription] = useState("");
  const [iconId, setIconId] = useState<string | null>("code");
  const [showAllIcons, setShowAllIcons] = useState(false);
  const [catalogKeys, setCatalogKeys] = useState<string[]>([]);
  const [customNames, setCustomNames] = useState<string[]>([]);

  const initialIndustryKey = initialValue?.industryKey ?? "";
  const initialDescription = initialValue?.description ?? "";
  const initialIconId = initialValue?.iconId ?? "code";
  const initialCatalogKeys = initialValue?.catalogKeys?.join("|") ?? "";
  const initialCustomNames = initialValue?.customNames?.join("|") ?? "";
  const lockedKeysJoined = lockedCatalogKeys.join("|");

  useEffect(() => {
    if (!open) return;
    const nextIndustryKey = initialIndustryKey || industries[0]?.key || "";
    setIndustryKey(nextIndustryKey);
    setDescription(initialDescription);
    setIconId(initialIconId);
    setShowAllIcons(false);
    setCatalogKeys(
      Array.from(
        new Set(
          [
            ...(initialCatalogKeys ? initialCatalogKeys.split("|") : []),
            ...(lockedKeysJoined ? lockedKeysJoined.split("|") : []),
          ].filter(Boolean)
        )
      )
    );
    setCustomNames(initialCustomNames ? initialCustomNames.split("|") : []);
  }, [
    open,
    industries,
    initialIndustryKey,
    initialDescription,
    initialIconId,
    initialCatalogKeys,
    initialCustomNames,
    lockedKeysJoined,
  ]);

  useEffect(() => {
    if (!open || isEdit) return;
    setCatalogKeys([]);
  }, [industryKey, open, isEdit]);

  const professionOptions = useMemo(() => {
    const forIndustry = availableProfessions.filter(
      (option) => option.industryKey === industryKey
    );
    return forIndustry;
  }, [availableProfessions, industryKey]);

  const visibleIcons = showAllIcons ? INDUSTRY_ICON_OPTIONS : INDUSTRY_ICON_OPTIONS.slice(0, 7);

  if (!open) return null;

  const allCustomNames = Array.from(
    new Set([...customNames, ...extraCustomNames].map((name) => name.trim()).filter(Boolean))
  );

  const titleId = isEdit ? "edit-industry-title" : "add-industry-title";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(92dvh,760px)] w-full max-w-[560px] flex-col overflow-visible rounded-2xl border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-2">
          <h3 id={titleId} className="text-lg font-semibold text-[#0F172A]">
            {isEdit ? "Edit Industry" : "Add Industry"}
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

        <div className="relative z-10 min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-visible px-5 py-3">
          {!isEdit && industries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-6 text-center text-sm text-[#64748B]">
              All available industries are already added.
            </p>
          ) : null}

          <label className="block space-y-1.5">
            <span className={labelClassName}>Select Industry</span>
            <IndustrySelect
              options={industries}
              value={industryKey}
              onChange={setIndustryKey}
              disabled={creating || industries.length === 0 || isEdit}
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
              placeholder="Add a short description for this industry…"
              className="w-full resize-none rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm leading-6 text-[#0F172A] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)] disabled:bg-[#F8FAFC]"
            />
            <div className="flex justify-end">
              <span className="text-xs text-[#94A3B8]">
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
          </label>

          <div className="space-y-2">
            <p className={labelClassName}>Icon (Optional)</p>
            <div className="flex flex-wrap items-center gap-2">
              {visibleIcons.map(({ id, label, bg, fg, Icon }) => {
                const selected = iconId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-label={label}
                    aria-pressed={selected}
                    disabled={creating}
                    onClick={() => setIconId(id)}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${
                      selected ? "ring-2 ring-[#F87171] ring-offset-2" : "hover:opacity-90"
                    }`}
                    style={{ backgroundColor: bg, color: fg }}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </button>
                );
              })}
              {!showAllIcons ? (
                <button
                  type="button"
                  aria-label="More icons"
                  disabled={creating}
                  onClick={() => setShowAllIcons(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className={labelClassName}>Add Profession to Industry</p>
              <p className="text-xs text-[#94A3B8]">(Optional you can add later)</p>
            </div>
            <ProfessionMultiSelect
              options={professionOptions}
              selectedKeys={catalogKeys}
              lockedKeys={isEdit ? lockedCatalogKeys : []}
              onChange={setCatalogKeys}
              disabled={creating || !industryKey}
            />
            {!industryKey ? (
              <p className="text-xs text-[#94A3B8]">Select an industry to choose professions.</p>
            ) : professionOptions.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">
                {isEdit
                  ? "No additional catalog professions available for this industry."
                  : "No catalog professions left for this industry. Add a custom profession below."}
              </p>
            ) : null}
          </div>

          {!isEdit ? (
            <>
              <OrDivider />

              <button
                type="button"
                disabled={creating || !industryKey}
                onClick={() => onRequestCustomProfession?.(industryKey)}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
              >
                Add Custom Profession
              </button>

              {allCustomNames.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {allCustomNames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full bg-[#EEF2F6] px-2.5 py-1 text-xs font-medium text-[#334155]"
                    >
                      {name}
                      <button
                        type="button"
                        aria-label={`Remove ${name}`}
                        disabled={creating}
                        onClick={() => {
                          if (extraCustomNames.includes(name)) {
                            onRemoveExtraCustomName?.(name);
                            return;
                          }
                          setCustomNames((current) => current.filter((item) => item !== name));
                        }}
                        className="rounded-full p-0.5 text-[#94A3B8] hover:bg-white hover:text-[#B91C1C]"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
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
            disabled={creating || !industryKey}
            onClick={() =>
              onSubmit({
                industryKey,
                description: description.trim(),
                iconId,
                catalogKeys,
                customNames: isEdit ? [] : allCustomNames,
              })
            }
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[color:var(--brand-primary)] px-4 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
          >
            {creating
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save Changes"
                : "Create Industry"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function IndustryIconBadge({
  iconId,
  className,
}: {
  iconId: string | null | undefined;
  className?: string;
}): ReactNode {
  const option = INDUSTRY_ICON_OPTIONS.find((item) => item.id === iconId) ?? INDUSTRY_ICON_OPTIONS[0];
  const { Icon, bg, fg } = option;
  return (
    <span
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${className ?? ""}`}
      style={{ backgroundColor: bg, color: fg }}
      aria-hidden
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}
