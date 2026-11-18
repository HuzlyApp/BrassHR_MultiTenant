"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { validateSupportTicketFile } from "@/lib/support-tickets/support-ticket-file-validation";

export const MAX_SUPPORT_TICKET_ATTACHMENTS = 5;

type FileSlot = {
  id: string;
  file: File | null;
};

type Props = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  fileUrl: string;
  onFileUrlChange: (value: string) => void;
  attachedUrls: string[];
  onAttachedUrlsChange: (urls: string[]) => void;
  disabled?: boolean;
  /** Bump when the parent form reopens so slots reset. */
  resetKey?: string | number;
};

function newSlotId(): string {
  return `slot-${Math.random().toString(36).slice(2, 10)}`;
}

export function TicketFileUploadFields({
  files: _files,
  onFilesChange,
  fileUrl,
  onFileUrlChange,
  attachedUrls,
  onAttachedUrlsChange,
  disabled = false,
  resetKey = 0,
}: Props) {
  const baseId = useId();
  const [slots, setSlots] = useState<FileSlot[]>([{ id: newSlotId(), file: null }]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setSlots([{ id: newSlotId(), file: null }]);
    setUploadError(null);
  }, [resetKey]);

  function syncFiles(nextSlots: FileSlot[]) {
    setSlots(nextSlots);
    onFilesChange(nextSlots.map((slot) => slot.file).filter((file): file is File => Boolean(file)));
  }

  function setFileOnSlot(slotId: string, fileList: FileList | null) {
    const picked = fileList?.[0] ?? null;
    if (!picked) return;
    const validation = validateSupportTicketFile(picked);
    if (validation) {
      setUploadError(validation);
      return;
    }
    setUploadError(null);
    const next = slots.map((slot) => (slot.id === slotId ? { ...slot, file: picked } : slot));
    syncFiles(next);
    const input = inputRefs.current[slotId];
    if (input) input.value = "";
  }

  function addSlot() {
    const filledCount = slots.filter((slot) => slot.file).length + attachedUrls.length;
    if (slots.length >= MAX_SUPPORT_TICKET_ATTACHMENTS || filledCount >= MAX_SUPPORT_TICKET_ATTACHMENTS) {
      setUploadError(`You can attach up to ${MAX_SUPPORT_TICKET_ATTACHMENTS} files.`);
      return;
    }
    if (slots.length >= MAX_SUPPORT_TICKET_ATTACHMENTS) return;
    setUploadError(null);
    setSlots((current) => [...current, { id: newSlotId(), file: null }]);
  }

  function removeSlot(slotId: string) {
    setUploadError(null);
    if (slots.length === 1) {
      syncFiles([{ id: slots[0].id, file: null }]);
      return;
    }
    syncFiles(slots.filter((slot) => slot.id !== slotId));
  }

  function handleAttachUrl() {
    const trimmed = fileUrl.trim();
    if (!trimmed) {
      setUploadError("Enter a file URL.");
      return;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Invalid protocol");
      }
    } catch {
      setUploadError("Enter a valid http(s) file URL.");
      return;
    }
    const total =
      slots.filter((slot) => slot.file).length +
      attachedUrls.length +
      (attachedUrls.includes(trimmed) ? 0 : 1);
    if (total > MAX_SUPPORT_TICKET_ATTACHMENTS) {
      setUploadError(`You can attach up to ${MAX_SUPPORT_TICKET_ATTACHMENTS} files.`);
      return;
    }
    onAttachedUrlsChange(attachedUrls.includes(trimmed) ? attachedUrls : [...attachedUrls, trimmed]);
    onFileUrlChange("");
    setUploadError(null);
  }

  const canAddMore =
    slots.length < MAX_SUPPORT_TICKET_ATTACHMENTS &&
    slots.filter((slot) => slot.file).length + attachedUrls.length < MAX_SUPPORT_TICKET_ATTACHMENTS;

  return (
    <div>
      <p className="mb-1.5 block text-sm font-medium text-[#374151]">Upload file</p>

      <div className="space-y-2">
        {slots.map((slot, index) => {
          const inputId = `${baseId}-${slot.id}`;
          const showDelete = Boolean(slot.file) || slots.length > 1;
          return (
            <div key={slot.id} className="flex flex-wrap items-stretch gap-2">
              <input
                id={inputId}
                ref={(node) => {
                  inputRefs.current[slot.id] = node;
                }}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
                disabled={disabled}
                onChange={(event) => setFileOnSlot(slot.id, event.target.files)}
              />
              <div className="flex min-h-11 min-w-0 flex-1 items-stretch overflow-hidden rounded-lg border border-[#CBD5E1] bg-white">
                <button
                  type="button"
                  onClick={() => inputRefs.current[slot.id]?.click()}
                  disabled={disabled}
                  className="shrink-0 border-r border-[#CBD5E1] px-3.5 text-sm font-semibold text-[color:var(--brand-secondary,#012352)] transition hover:bg-[#F8FAFC] disabled:opacity-60"
                >
                  Select File
                </button>
                <div className="flex min-w-0 flex-1 items-center px-3 text-sm text-[#64748B]">
                  <span className="truncate">{slot.file?.name ?? "No file selected"}</span>
                </div>
              </div>

              {index === 0 ? (
                <button
                  type="button"
                  onClick={addSlot}
                  disabled={disabled || !canAddMore}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-[#F3F4F6] px-3.5 text-sm font-medium text-[#374151] transition hover:bg-[#E5E7EB] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Add More
                </button>
              ) : null}

              {showDelete ? (
                <button
                  type="button"
                  aria-label="Remove file"
                  onClick={() => removeSlot(slot.id)}
                  disabled={disabled}
                  className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#B91C1C] transition hover:bg-[#FEF2F2] disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-[#6B7280]">
        Allow File Extensions: .jpg, .png, .txt, .pdf (Max file size: 10MB). Max {MAX_SUPPORT_TICKET_ATTACHMENTS}{" "}
        files.
      </p>

      {attachedUrls.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {attachedUrls.map((url) => (
            <li
              key={url}
              className="flex items-center justify-between gap-2 rounded-md bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A]"
            >
              <span className="truncate">{url}</span>
              <button
                type="button"
                aria-label="Remove file URL"
                onClick={() => onAttachedUrlsChange(attachedUrls.filter((item) => item !== url))}
                disabled={disabled}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#B91C1C] hover:bg-[#FEF2F2] disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative mt-3">
        <input
          type="url"
          value={fileUrl}
          onChange={(event) => {
            onFileUrlChange(event.target.value);
            if (uploadError) setUploadError(null);
          }}
          placeholder="Add file URL"
          disabled={disabled}
          className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 pr-24 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8] transition focus:border-[color:var(--brand-secondary,#012352)] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleAttachUrl}
          disabled={disabled}
          className="absolute right-1.5 top-1/2 inline-flex h-8 -translate-y-1/2 items-center rounded-md border border-[color:var(--brand-secondary,#012352)] px-3 text-xs font-semibold text-[color:var(--brand-secondary,#012352)] transition hover:bg-[#F8FAFC] disabled:opacity-60"
        >
          Upload
        </button>
      </div>
      {uploadError ? <p className="mt-1 text-xs text-red-600">{uploadError}</p> : null}
    </div>
  );
}
