"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { Check, X } from "lucide-react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import BrandedUploadIcon from "@/app/components/BrandedUploadIcon";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { isPdfFile } from "@/lib/document-upload-helpers";
import type { ProfessionDocumentKind } from "@/lib/professions/profession-documents";
import { professionDocumentKindLabel } from "@/lib/professions/profession-documents";

export type DocumentFormKind = Extract<ProfessionDocumentKind, "vaccination" | "other">;

export type DocumentFormValues = {
  name: string;
  documentKind: DocumentFormKind;
  isRequired: boolean;
  hasExpiration: boolean;
  issuedDate: string;
  expiryDate: string;
  file: File | null;
};

type AddDocumentModalProps = {
  open: boolean;
  saving?: boolean;
  error?: string | null;
  professionOptions?: readonly string[];
  professionValue?: string;
  professionLocked?: boolean;
  onProfessionChange?: (professionName: string) => void;
  onClose: () => void;
  onSubmit: (values: DocumentFormValues) => void;
};

const EMPTY: DocumentFormValues = {
  name: "",
  documentKind: "other",
  isRequired: true,
  hasExpiration: false,
  issuedDate: "",
  expiryDate: "",
  file: null,
};

const FIELD_CLASS =
  "h-11 w-full cursor-pointer rounded-lg border border-[#D1D5DB] bg-white px-3 pr-10 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary)]";

const SELECT_CLASS =
  "h-11 w-full cursor-pointer appearance-none rounded-lg border border-[#D1D5DB] bg-white bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat px-3 pr-10 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary)] disabled:cursor-not-allowed disabled:bg-[#F8FAFC]";

const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 10 || unitIndex === 0 ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded} ${units[unitIndex]}`;
}

export default function AddDocumentModal({
  open,
  saving = false,
  error,
  professionOptions = [],
  professionValue = "",
  professionLocked = false,
  onProfessionChange,
  onClose,
  onSubmit,
}: AddDocumentModalProps) {
  const branding = useTenantBranding();
  const primaryColor = branding.primaryHex || "#BC8B41";
  const secondaryColor = branding.secondaryHex || "#012352";
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<DocumentFormValues>(EMPTY);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!open) {
      setValues(EMPTY);
      setFieldError(null);
      setDragActive(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setValues(EMPTY);
    setFieldError(null);
    setDragActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  function patch(partial: Partial<DocumentFormValues>) {
    setValues((current) => ({ ...current, ...partial }));
  }

  function clearFile() {
    patch({ file: null });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function setFile(file: File | null) {
    patch({ file });
    if (!file && fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!saving) setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (saving) return;
    setFile(event.dataTransfer.files?.[0] ?? null);
  }

  function handleSubmit() {
    if (!professionValue.trim()) {
      setFieldError("Select a profession before saving.");
      return;
    }
    const name = values.name.trim();
    if (!name) {
      setFieldError("Document name is required.");
      return;
    }
    if (!values.file) {
      setFieldError("Choose a file to upload.");
      return;
    }
    if (values.hasExpiration) {
      if (!values.issuedDate.trim() || !values.expiryDate.trim()) {
        setFieldError("Issued and expiry dates are required when expiry is enabled.");
        return;
      }
      if (values.expiryDate < values.issuedDate) {
        setFieldError("Expiry date must be on or after the issued date.");
        return;
      }
    }
    setFieldError(null);
    onSubmit({
      ...values,
      name,
      issuedDate: values.hasExpiration ? values.issuedDate : "",
      expiryDate: values.hasExpiration ? values.expiryDate : "",
    });
  }

  const displayedFileName = values.file?.name || null;
  const fileIconSrc = displayedFileName
    ? isPdfFile(values.file, displayedFileName, null)
      ? "/icons/pdf-icon.svg"
      : /\.(docx?)$/i.test(displayedFileName)
        ? "/icons/docx-icon.svg"
        : "/icons/jpeg-icon.svg"
    : "/icons/pdf-icon.svg";

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 px-3 py-0 sm:items-center sm:px-4 sm:py-8"
      role="presentation"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-document-modal-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[10px] border border-[#E5E7EB] bg-white shadow-xl sm:rounded-[10px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0 pr-2">
            <h2
              id="add-document-modal-title"
              className="text-lg font-semibold text-[#0F172A]"
            >
              Add Document
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">
              Add a document for this candidate and upload the supporting file.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F1F5F9] disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {error || fieldError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {fieldError || error}
            </div>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#374151]">Profession</span>
            {professionLocked ? (
              <input
                value={professionValue || "—"}
                readOnly
                disabled
                className="h-11 w-full cursor-not-allowed rounded-lg border border-[#D1D5DB] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] outline-none"
              />
            ) : (
              <select
                value={professionValue}
                disabled={saving || professionOptions.length === 0}
                onChange={(event) => onProfessionChange?.(event.target.value)}
                className={SELECT_CLASS}
                style={{ backgroundImage: SELECT_CHEVRON }}
              >
                <option value="">
                  {professionOptions.length === 0
                    ? "No professions in settings"
                    : "Select profession"}
                </option>
                {professionOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#374151]">Document name</span>
            <input
              value={values.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="e.g. TB Test Results"
              className="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary)]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#374151]">Type</span>
            <select
              value={values.documentKind}
              onChange={(event) =>
                patch({ documentKind: event.target.value as DocumentFormKind })
              }
              className={SELECT_CLASS}
              style={{ backgroundImage: SELECT_CHEVRON }}
            >
              <option value="other">{professionDocumentKindLabel("other")}</option>
              <option value="vaccination">
                {professionDocumentKindLabel("vaccination")}
              </option>
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-[#0F172A]">
              <span className="relative inline-flex h-5 w-5 shrink-0">
                <input
                  type="checkbox"
                  checked={values.isRequired}
                  onChange={(event) => patch({ isRequired: event.target.checked })}
                  className="peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-[5px] border border-[#CBD5E1] bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_28%,transparent)]"
                  style={
                    values.isRequired
                      ? {
                          backgroundColor: secondaryColor,
                          borderColor: secondaryColor,
                        }
                      : undefined
                  }
                />
                <Check
                  className="pointer-events-none absolute inset-0 m-auto hidden h-3.5 w-3.5 text-white peer-checked:block"
                  strokeWidth={3}
                  aria-hidden
                />
              </span>
              {values.isRequired ? "Required" : "Optional"}
            </label>

            <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-[#0F172A]">
              <span className="relative inline-flex h-5 w-5 shrink-0">
                <input
                  type="checkbox"
                  checked={values.hasExpiration}
                  onChange={(event) =>
                    patch({
                      hasExpiration: event.target.checked,
                      ...(event.target.checked ? {} : { issuedDate: "", expiryDate: "" }),
                    })
                  }
                  className="peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-[5px] border border-[#CBD5E1] bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_28%,transparent)]"
                  style={
                    values.hasExpiration
                      ? {
                          backgroundColor: secondaryColor,
                          borderColor: secondaryColor,
                        }
                      : undefined
                  }
                />
                <Check
                  className="pointer-events-none absolute inset-0 m-auto hidden h-3.5 w-3.5 text-white peer-checked:block"
                  strokeWidth={3}
                  aria-hidden
                />
              </span>
              Has expiry date
            </label>
          </div>

          {values.hasExpiration ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block cursor-pointer space-y-1.5">
                <span className="text-sm font-medium text-[#374151]">Issued date</span>
                <input
                  type="date"
                  value={values.issuedDate}
                  onChange={(event) => patch({ issuedDate: event.target.value })}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block cursor-pointer space-y-1.5">
                <span className="text-sm font-medium text-[#374151]">Expiry date</span>
                <input
                  type="date"
                  value={values.expiryDate}
                  onChange={(event) => patch({ expiryDate: event.target.value })}
                  className={FIELD_CLASS}
                />
              </label>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-[#374151]">Document file</span>
            <div
              className={`rounded-[10px] border-2 border-dashed bg-white p-4 transition ${
                dragActive
                  ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)]"
                  : "border-[color:var(--brand-primary)]"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {displayedFileName ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <BrandedSvgIcon
                      src={fileIconSrc}
                      className="h-9 w-9 shrink-0"
                      color={primaryColor}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0F172A]">
                        {displayedFileName}
                      </p>
                      <p className="text-xs text-[#64748B]">
                        {values.file ? formatBytes(values.file.size) : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={clearFile}
                    className="text-sm font-semibold text-[#64748B] hover:text-[#0F172A] disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <BrandedUploadIcon primaryHex={primaryColor} className="h-10 w-10" />
                  <p className="text-sm text-[#64748B]">
                    Drag your file(s) to start uploading OR{" "}
                    <label
                      htmlFor={fileInputId}
                      className="cursor-pointer font-semibold text-[color:var(--brand-primary)] hover:underline"
                    >
                      Browse files
                    </label>
                  </p>
                  <p className="text-xs text-[#94A3B8]">
                    PDF, DOC, DOCX, PNG, JPG — Max 10 MB
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                disabled={saving}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#E5E7EB] px-4 py-4 sm:px-6">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-4 text-sm font-semibold text-[#374151] transition hover:bg-[#F8FAFC] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
