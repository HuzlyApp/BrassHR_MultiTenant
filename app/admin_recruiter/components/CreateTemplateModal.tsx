"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

type TemplateFolder = "presets" | "saved-templates";

export type CreateTemplatePayload = {
  name: string;
  folder: TemplateFolder;
};

export type TemplateFolderOption = {
  id: TemplateFolder;
  label: string;
  count?: number;
};

type CreateTemplateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreateTemplatePayload) => void | Promise<void>;
  folderOptions?: TemplateFolderOption[];
  creating?: boolean;
  error?: string | null;
};

const CARD_BORDER = "#D0D5DD";
const TEXT_PRIMARY = "#101828";
const TEXT_SECONDARY = "#667085";
const TEXT_MUTED = "#98A2B3";

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className="block shrink-0"
    >
      <path d="M3.5 3.5L10.5 10.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.5 3.5L3.5 10.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FolderIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M2.5 6.5C2.5 5.395 3.395 4.5 4.5 4.5H7.1L8.25 6H13.5C14.605 6 15.5 6.895 15.5 8V13.5C15.5 14.605 14.605 15.5 13.5 15.5H4.5C3.395 15.5 2.5 14.605 2.5 13.5V6.5Z"
        stroke={color}
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.25" stroke="#98A2B3" strokeWidth="1.5" />
      <path d="M10 10L13 13" stroke="#98A2B3" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 6L8 10L12 6" stroke="#98A2B3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M2 5L4.25 7.25L8 3.25"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DEFAULT_FOLDER_OPTIONS: TemplateFolderOption[] = [
  { id: "presets", label: "Presets" },
  { id: "saved-templates", label: "Saved Templates" },
];

export default function CreateTemplateModal({
  open,
  onClose,
  onCreate,
  folderOptions = DEFAULT_FOLDER_OPTIONS,
  creating = false,
  error = null,
}: CreateTemplateModalProps) {
  const branding = useTenantBranding();
  const [templateName, setTemplateName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<TemplateFolder>("presets");
  const [showFolders, setShowFolders] = useState(true);
  const listboxId = useId();
  const containerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setShowFolders(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    setTemplateName("");
    setSearch("");
    setSelectedFolder("presets");
    setShowFolders(true);
  }, [open]);

  const filteredFolders = useMemo(
    () => folderOptions.filter((opt) => opt.label.toLowerCase().includes(search.trim().toLowerCase())),
    [folderOptions, search]
  );

  if (!open) return null;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (creating) return;
    const trimmed = templateName.trim();
    if (!trimmed) return;
    await onCreate({ name: trimmed, folder: selectedFolder });
  };

  const selectedLabel = folderOptions.find((opt) => opt.id === selectedFolder)?.label ?? "Select";
  const canSubmit = templateName.trim().length > 0 && !creating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 px-3 py-4 sm:items-center sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-template-title"
      onClick={onClose}
    >
      <form
        ref={containerRef}
        onSubmit={handleCreate}
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto w-full max-w-[600px] max-h-[min(92dvh,760px)] overflow-y-auto rounded-[20px] border bg-white p-4 shadow-xl max-[369px]:p-3.5 sm:p-6"
        style={{ borderColor: CARD_BORDER }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black transition hover:brightness-110 sm:right-4 sm:top-4"
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <div className="mb-5 flex items-center gap-2.5 border-b pb-4 pr-9 sm:mb-8 sm:gap-3 sm:pb-6" style={{ borderColor: "#E4E7EC" }}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F2F4F7] sm:h-10 sm:w-10">
            <FolderIcon color={branding.primaryHex} />
          </div>
          <h2
            id="create-template-title"
            className="min-w-0 text-lg font-semibold leading-7 max-[369px]:text-base sm:text-[24px] sm:leading-[32px]"
            style={{ color: TEXT_PRIMARY }}
          >
            Create New Flow Template
          </h2>
        </div>

        <div className="space-y-5 sm:space-y-6">
          <div className="min-w-0">
            <label htmlFor="template-name" className="mb-2 block text-sm font-medium" style={{ color: TEXT_SECONDARY }}>
              Template Name
            </label>
            <input
              id="template-name"
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="h-10 w-full min-w-0 rounded-lg border px-3 text-sm outline-none max-[369px]:h-9 max-[369px]:px-2.5 max-[369px]:text-[13px] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)] sm:h-11 sm:px-3.5"
              style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
            />
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium" style={{ color: TEXT_SECONDARY }}>
              Save template to
            </label>
            <button
              type="button"
              className="flex h-10 w-full min-w-0 items-center justify-between rounded-lg border px-3 text-sm max-[369px]:h-9 max-[369px]:px-2.5 max-[369px]:text-[13px] sm:h-11 sm:px-3.5"
              style={{ borderColor: CARD_BORDER, color: selectedLabel ? TEXT_SECONDARY : TEXT_MUTED }}
              onClick={() => setShowFolders((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={showFolders}
              aria-controls={listboxId}
            >
              <span className="min-w-0 truncate">{selectedLabel || "Select"}</span>
              <ChevronDownIcon />
            </button>

            {showFolders ? (
              <div className="mt-2 overflow-hidden rounded-lg border bg-white" style={{ borderColor: CARD_BORDER }}>
                <div className="border-b px-3 py-2" style={{ borderColor: CARD_BORDER }}>
                  <div className="relative">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search folder"
                      className="h-9 w-full min-w-0 bg-transparent pr-8 text-sm outline-none"
                      style={{ color: TEXT_PRIMARY }}
                    />
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2">
                      <SearchIcon />
                    </span>
                  </div>
                </div>
                <ul id={listboxId} role="listbox" aria-label="Folders" className="max-h-[108px] overflow-y-auto py-1">
                  {filteredFolders.map((folder) => {
                    const checked = selectedFolder === folder.id;
                    return (
                      <li key={folder.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-[#F9FAFB]"
                          style={{ backgroundColor: checked ? "#F2F4F7" : "transparent", color: TEXT_SECONDARY }}
                          onClick={() => setSelectedFolder(folder.id)}
                        >
                          <FolderIcon color={branding.primaryHex} />
                          <span className="min-w-0 flex-1 truncate">
                            {folder.label}
                            {folder.count != null ? ` (${folder.count})` : ""}
                          </span>
                          <span
                            className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border"
                            style={{
                              borderColor: checked ? "var(--brand-primary)" : "#D0D5DD",
                              backgroundColor: checked ? "var(--brand-primary)" : "white",
                            }}
                          >
                            {checked ? <CheckIcon /> : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            <p className="mt-1 text-right text-xs" style={{ color: TEXT_MUTED }}>
              1 selected
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition hover:brightness-[0.97] disabled:cursor-not-allowed disabled:opacity-60 max-[369px]:h-9 sm:mt-8 sm:h-11"
          style={{
            background:
              "linear-gradient(90deg, var(--brand-primary) 0%, color-mix(in srgb, var(--brand-primary) 70%, white) 100%)",
          }}
          aria-busy={creating}
        >
          {creating ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
          {creating ? "Creating…" : "Create"}
        </button>
      </form>
    </div>
  );
}
