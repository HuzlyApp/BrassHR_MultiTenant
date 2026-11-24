"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Folder, Search, X } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import type { RecruiterTemplateFolder } from "@/lib/recruiter-templates/template-folders-storage";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";

const CARD_BORDER = "#EAECF0";
const TEXT_PRIMARY = "#101828";
const TEXT_MUTED = "#667085";
const UNCATEGORIZED_VALUE = "__uncategorized__";

type FolderOption = {
  id: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  open: boolean;
  templateName: string;
  folders: RecruiterTemplateFolder[];
  /** Folder the template is in today; null = uncategorized. */
  currentFolderId: string | null;
  saving?: boolean;
  onClose: () => void;
  onMove: (folderId: string | null) => void | Promise<void>;
};

export default function MoveTemplateToFolderModal({
  open,
  templateName,
  folders,
  currentFolderId,
  saving = false,
  onClose,
  onMove,
}: Props) {
  const branding = useTenantBranding();
  const brandStyle = brandingToCssVars(branding) as CSSProperties;
  const secondary = branding.secondaryHex || "var(--brand-secondary)";
  const listboxId = useId();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const options = useMemo((): FolderOption[] => {
    const alreadyUncategorized = currentFolderId == null;
    const rows: FolderOption[] = [
      {
        id: UNCATEGORIZED_VALUE,
        label: alreadyUncategorized ? "Uncategorized (current)" : "Uncategorized",
        disabled: alreadyUncategorized,
      },
      ...folders
        .filter((folder) => folder.id !== currentFolderId)
        .map((folder) => ({ id: folder.id, label: folder.name })),
    ];
    return rows;
  }, [folders, currentFolderId]);

  const selectableOptions = useMemo(
    () => options.filter((option) => !option.disabled),
    [options]
  );

  const [selectedId, setSelectedId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        if (menuOpen) {
          setMenuOpen(false);
          return;
        }
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, saving, menuOpen]);

  useEffect(() => {
    if (!open) {
      setSelectedId("");
      setFormError(null);
      setMenuOpen(false);
      setSearch("");
      return;
    }
    setSelectedId(selectableOptions[0]?.id ?? "");
    setFormError(null);
    setMenuOpen(false);
    setSearch("");
  }, [open, selectableOptions]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [menuOpen]);

  if (!open || typeof document === "undefined") return null;

  const selectedLabel = options.find((option) => option.id === selectedId)?.label;
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(search.trim().toLowerCase())
  );
  const canSubmit = Boolean(selectedId) && !saving && selectableOptions.length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      style={brandStyle}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-template-folder-title"
        className="relative w-full max-w-[440px] overflow-visible rounded-2xl border bg-white shadow-xl"
        style={{ borderColor: CARD_BORDER, backgroundColor: "#FFFFFF" }}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: CARD_BORDER }}>
          <div className="min-w-0">
            <h3 id="move-template-folder-title" className="text-lg font-semibold" style={{ color: TEXT_PRIMARY }}>
              Move to another folder
            </h3>
            <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
              Move <span className="font-medium text-[#344054]">{templateName}</span> to another library folder.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F2F4F7] text-[#667085] hover:bg-[#E4E7EC] disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="relative z-10 space-y-3 px-5 py-4">
          {selectableOptions.length === 0 ? (
            <p
              className="rounded-lg border border-dashed border-[#E4E7EC] bg-[#F9FAFB] px-4 py-5 text-sm"
              style={{ color: TEXT_MUTED }}
            >
              No other folders available. Create a folder first, then move this template.
            </p>
          ) : (
            <div className="relative z-20 min-w-0 pb-1">
              <label
                htmlFor="move-template-folder-trigger"
                className="mb-1.5 block text-sm font-medium leading-5"
                style={{ color: TEXT_PRIMARY }}
              >
                Select folder
              </label>
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  id="move-template-folder-trigger"
                  disabled={saving}
                  aria-haspopup="listbox"
                  aria-expanded={menuOpen}
                  aria-controls={listboxId}
                  onClick={() => !saving && setMenuOpen((openMenu) => !openMenu)}
                  className="flex h-11 w-full items-center gap-2 rounded-lg border bg-white px-3 text-left text-sm outline-none transition focus:border-[color:var(--brand-secondary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-secondary)_25%,transparent)] disabled:opacity-60"
                  style={{ borderColor: CARD_BORDER, color: selectedLabel ? TEXT_PRIMARY : TEXT_MUTED, backgroundColor: "#FFFFFF" }}
                >
                  <Folder className="h-4 w-4 shrink-0 text-[#98A2B3]" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{selectedLabel ?? "Select folder"}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[#98A2B3] transition ${menuOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>

                {menuOpen ? (
                  <div
                    className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border bg-white shadow-lg"
                    style={{ borderColor: CARD_BORDER, backgroundColor: "#FFFFFF" }}
                  >
                    <div className="border-b bg-white px-3 py-2.5" style={{ borderColor: CARD_BORDER }}>
                      <div className="relative">
                        <input
                          type="search"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search folder"
                          className="h-9 w-full rounded-md border-0 bg-white py-2 pl-1 pr-9 text-sm outline-none"
                          style={{ color: TEXT_PRIMARY }}
                          aria-label="Search folder"
                        />
                        <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[#98A2B3]">
                          <Search className="h-4 w-4" aria-hidden />
                        </span>
                      </div>
                    </div>
                    <ul
                      id={listboxId}
                      role="listbox"
                      aria-label="Select folder"
                      className="max-h-[220px] overflow-y-auto bg-white py-1"
                    >
                      {filtered.length === 0 ? (
                        <li className="px-3.5 py-3 text-sm" style={{ color: TEXT_MUTED }}>
                          No folders found
                        </li>
                      ) : (
                        filtered.map((option) => {
                          const checked = selectedId === option.id;
                          return (
                            <li key={option.id} role="option" aria-selected={checked} aria-disabled={option.disabled}>
                              <button
                                type="button"
                                disabled={option.disabled || saving}
                                onClick={() => {
                                  if (option.disabled) return;
                                  setSelectedId(option.id);
                                  setFormError(null);
                                  setMenuOpen(false);
                                  setSearch("");
                                }}
                                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                  backgroundColor: checked ? "#F2F4F7" : "#FFFFFF",
                                  color: TEXT_PRIMARY,
                                }}
                              >
                                <Folder className="h-4 w-4 shrink-0 text-[#98A2B3]" aria-hidden />
                                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                                <span
                                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border ${
                                    checked ? "" : "border-[#D0D5DD] bg-white"
                                  }`}
                                  style={
                                    checked
                                      ? {
                                          borderColor: secondary,
                                          backgroundColor: secondary,
                                        }
                                      : undefined
                                  }
                                  aria-hidden
                                >
                                  {checked ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
                                </span>
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          )}
          {formError ? <p className="text-sm text-[#B42318]">{formError}</p> : null}
        </div>

        <div className="relative z-0 flex items-center justify-end gap-3 border-t px-5 py-4" style={{ borderColor: CARD_BORDER }}>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border bg-white px-4 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
            style={{ borderColor: CARD_BORDER }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (!selectedId) {
                setFormError("Select a folder");
                return;
              }
              void (async () => {
                try {
                  await onMove(selectedId === UNCATEGORIZED_VALUE ? null : selectedId);
                } catch (error) {
                  setFormError(error instanceof Error ? error.message : "Failed to move template");
                }
              })();
            }}
            className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: secondary }}
          >
            {saving ? "Moving…" : "Move"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
