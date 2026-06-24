"use client";

import { useId, useRef, type RefObject } from "react";
import { WORKER_BTN_FILE_CHOOSE } from "./worker-portal-buttons";

type WorkerFilePickerProps = {
  id?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  emptyLabel?: string;
  error?: string;
};

export function WorkerFilePicker({
  id,
  file,
  onChange,
  accept = ".pdf,image/*",
  disabled = false,
  inputRef,
  emptyLabel = "No file chosen",
  error,
}: WorkerFilePickerProps) {
  const fallbackId = useId();
  const internalRef = useRef<HTMLInputElement>(null);
  const resolvedRef = inputRef ?? internalRef;

  return (
    <div>
      <div
        className={`rounded-lg border border-dashed bg-[#F8FAFC] p-4 ${
          error ? "border-red-300" : "border-[#D1D5DB]"
        }`}
      >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => resolvedRef.current?.click()}
          className={WORKER_BTN_FILE_CHOOSE}
        >
          Choose file
        </button>
        <p className="min-w-0 flex-1 break-words text-sm text-[#64748B]">
          {file ? file.name : emptyLabel}
        </p>
      </div>
      <input
        ref={resolvedRef}
        id={id ?? fallbackId}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
