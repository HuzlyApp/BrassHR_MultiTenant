"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { CandidateListAvatar } from "./CandidateListAvatar";

export type MailComposeDropdownOption = {
  value: string;
  label: string;
  sublabel?: string;
  avatarUrl?: string | null;
};

type MailComposeDropdownProps = {
  id?: string;
  value: string;
  options: MailComposeDropdownOption[];
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  onChange: (value: string) => void;
  alignLabel?: "single" | "stacked";
  showAvatars?: boolean;
  /** Match compose candidate row height (avatar + two lines). */
  tallTrigger?: boolean;
};

const TALL_TRIGGER_CLASS = "min-h-[3.25rem]";
const PLACEHOLDER_CLASS = "text-lg font-medium text-[#94A3B8]";

const OPTION_HOVER =
  "hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)]";
const OPTION_SELECTED =
  "bg-[color-mix(in_srgb,var(--brand-primary)_12%,white)]";

function optionText(option: MailComposeDropdownOption): string {
  return option.sublabel ? `${option.label} · ${option.sublabel}` : option.label;
}

function OptionAvatar({
  option,
  showAvatars,
}: {
  option: MailComposeDropdownOption;
  showAvatars: boolean;
}) {
  if (!showAvatars) return null;
  return (
    <CandidateListAvatar
      name={option.label}
      photoUrl={option.avatarUrl}
      className="h-9 w-9 text-sm"
    />
  );
}

export function MailComposeDropdown({
  id,
  value,
  options,
  placeholder,
  disabled = false,
  loading = false,
  loadingLabel = "Loading...",
  onChange,
  alignLabel = "single",
  showAvatars = false,
  tallTrigger = false,
}: MailComposeDropdownProps) {
  const branding = useTenantBranding();
  const brandVars = brandingToCssVars(branding) as CSSProperties;
  const autoId = useId();
  const listboxId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const selected = options.find((option) => option.value === value) ?? null;

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

  if (loading) {
    return (
      <div
        className={`flex min-w-0 flex-1 items-center rounded-md border border-[#E5E7EB] bg-white px-3 text-[#6B7280] ${
          tallTrigger ? `${TALL_TRIGGER_CLASS} text-lg font-medium` : "text-sm"
        }`}
        aria-busy="true"
      />
    );
  }

  const menu =
    open && menuStyle && typeof document !== "undefined"
      ? createPortal(
          <ul
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
            className="z-200 max-h-64 overflow-y-auto rounded-md border border-[color-mix(in_srgb,var(--brand-primary)_18%,#E5E7EB)] bg-white py-1 shadow-lg"
          >
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
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value} role="presentation">
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
                    <OptionAvatar option={option} showAvatars={showAvatars} />
                    <span className="min-w-0 flex-1">
                      {alignLabel === "stacked" ? (
                        <>
                          <span
                            className={`block truncate ${isSelected ? "font-semibold text-(--brand-primary)" : "font-medium text-[#111827]"}`}
                          >
                            {option.label}
                          </span>
                          {option.sublabel ? (
                            <span className="block truncate text-xs text-[#64748B]">{option.sublabel}</span>
                          ) : null}
                        </>
                      ) : (
                        <span
                          className={`block truncate ${isSelected ? "font-semibold text-(--brand-primary)" : "text-[#111827]"}`}
                        >
                          {optionText(option)}
                        </span>
                      )}
                    </span>
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0 text-(--brand-primary)" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  const showCenteredPlaceholder = !selected && tallTrigger;

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
        className={`relative flex w-full min-w-0 items-center gap-3 rounded-md border px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${
          tallTrigger ? TALL_TRIGGER_CLASS : ""
        } ${selected ? "text-left text-sm" : ""} ${
          open
            ? "border-(--brand-primary) bg-white ring-2 ring-[color-mix(in_srgb,var(--brand-primary)_18%,white)]"
            : "border-[#E5E7EB] bg-white hover:border-[color-mix(in_srgb,var(--brand-primary)_35%,#E5E7EB)]"
        }`}
      >
        {selected ? (
          <>
            {showAvatars ? <OptionAvatar option={selected} showAvatars={showAvatars} /> : null}
            <span className="min-w-0 flex-1 truncate text-[#111827]">
              {alignLabel === "stacked" ? (
                <span className="block min-w-0 text-left">
                  <span className="block truncate font-medium">{selected.label}</span>
                  {selected.sublabel ? (
                    <span className="block truncate text-xs text-[#64748B]">{selected.sublabel}</span>
                  ) : tallTrigger ? (
                    <span className="block truncate text-xs leading-4 opacity-0" aria-hidden>
                      &nbsp;
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="truncate">{optionText(selected)}</span>
              )}
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
