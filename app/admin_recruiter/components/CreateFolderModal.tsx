"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

export type CreateFolderTemplateOption = {
  id: string;
  name: string;
  status: string;
};

export type CreateFolderPayload = {
  name: string;
  templateIds: string[];
};

type CreateFolderModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreateFolderPayload) => void | Promise<void>;
  templates?: CreateFolderTemplateOption[];
  creating?: boolean;
  error?: string | null;
};

const CARD_BORDER = "#D0D5DD";
const TEXT_PRIMARY = "#101828";
const TEXT_SECONDARY = "#667085";
const TEXT_MUTED = "#98A2B3";
const NAVY = "#012352";

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

export default function CreateFolderModal({
  open,
  onClose,
  onCreate,
  templates = [],
  creating = false,
  error = null,
}: CreateFolderModalProps) {
  const branding = useTenantBranding();
  const primary = branding.primaryHex || NAVY;
  const [folderName, setFolderName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showList, setShowList] = useState(true);
  const listboxId = useId();
  const containerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    setFolderName("");
    setSearch("");
    setSelectedIds([]);
    setShowList(true);
  }, [open]);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  if (!open) return null;

  const toggleTemplate = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (creating) return;
    const trimmed = folderName.trim();
    if (!trimmed) return;
    await onCreate({ name: trimmed, templateIds: selectedIds });
  };

  const canSubmit = folderName.trim().length > 0 && !creating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 px-3 py-4 sm:items-center sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-folder-title"
      onClick={onClose}
    >
      <form
        ref={containerRef}
        onSubmit={(e) => void handleCreate(e)}
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto w-full max-w-[560px] max-h-[min(92dvh,720px)] overflow-y-auto rounded-[20px] border bg-white p-4 shadow-xl sm:p-6"
        style={{ borderColor: CARD_BORDER }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#101828] transition hover:brightness-110 sm:right-4 sm:top-4"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5 text-white" />
        </button>

        <div
          className="mb-5 flex items-center gap-2.5 border-b pb-4 pr-9 sm:mb-6 sm:gap-3 sm:pb-5"
          style={{ borderColor: "#E4E7EC" }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F2F4F7] sm:h-10 sm:w-10">
            <FolderIcon color={primary} />
          </div>
          <h2
            id="create-folder-title"
            className="min-w-0 text-lg font-semibold leading-7 sm:text-[22px] sm:leading-8"
            style={{ color: TEXT_PRIMARY }}
          >
            Create a folder
          </h2>
        </div>

        <div className="space-y-5">
          <div>
            <label
              htmlFor="folder-name"
              className="mb-2 block text-sm font-medium"
              style={{ color: TEXT_SECONDARY }}
            >
              Folder Name
            </label>
            <input
              id="folder-name"
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Offer letters"
              className="h-11 w-full rounded-lg border px-3.5 text-sm outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]"
              style={{ borderColor: CARD_BORDER, color: TEXT_PRIMARY }}
              autoFocus
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="block text-sm font-medium" style={{ color: TEXT_SECONDARY }}>
                Save templates to <span className="font-normal text-[#98A2B3]">(optional)</span>
              </label>
              <button
                type="button"
                className="text-xs font-medium text-[#667085] hover:text-[#101828]"
                onClick={() => setShowList((v) => !v)}
              >
                {showList ? "Hide" : "Show"}
              </button>
            </div>

            {showList ? (
              <div className="overflow-hidden rounded-lg border bg-white" style={{ borderColor: CARD_BORDER }}>
                <div className="relative border-b px-3 py-2" style={{ borderColor: CARD_BORDER }}>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]"
                    aria-hidden
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search templates"
                    className="h-9 w-full bg-transparent pl-7 pr-2 text-sm outline-none"
                    style={{ color: TEXT_PRIMARY }}
                  />
                </div>
                <ul
                  id={listboxId}
                  role="listbox"
                  aria-label="Templates"
                  aria-multiselectable="true"
                  className="max-h-[180px] overflow-y-auto py-1"
                >
                  {filteredTemplates.length === 0 ? (
                    <li className="px-3 py-3 text-sm" style={{ color: TEXT_MUTED }}>
                      {templates.length === 0 ? "No templates available yet." : "No matches."}
                    </li>
                  ) : (
                    filteredTemplates.map((template) => {
                      const checked = selectedIds.includes(template.id);
                      return (
                        <li key={template.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={checked}
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-[#F9FAFB]"
                            style={{
                              backgroundColor: checked ? "#F2F4F7" : "transparent",
                              color: TEXT_SECONDARY,
                            }}
                            onClick={() => toggleTemplate(template.id)}
                          >
                            <span className="min-w-0 flex-1 truncate font-medium text-[#344054]">
                              {template.name}
                            </span>
                            <span className="shrink-0 text-xs capitalize text-[#98A2B3]">
                              {template.status}
                            </span>
                            <span
                              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border"
                              style={{
                                borderColor: checked ? primary : "#D0D5DD",
                                backgroundColor: checked ? primary : "white",
                              }}
                            >
                              {checked ? <CheckIcon /> : null}
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            ) : null}
            <p className="mt-1 text-right text-xs" style={{ color: TEXT_MUTED }}>
              {selectedIds.length} selected
            </p>
          </div>
        </div>

        {error ? (
          <p
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white transition hover:brightness-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: primary }}
            aria-busy={creating}
          >
            {creating ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
