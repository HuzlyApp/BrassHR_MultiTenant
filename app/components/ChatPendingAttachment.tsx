"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

function isImageFile(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    (!file.type && /\.(png|jpe?g|jpeg|webp|gif)$/i.test(file.name))
  );
}

type Props = {
  file: File;
  onRemove: () => void;
  removeLabel?: string;
  className?: string;
};

export default function ChatPendingAttachment({
  file,
  onRemove,
  removeLabel = "Remove file",
  className = "mb-2 flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155]",
}: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImageFile(file)) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className={className}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob preview for local file
          <img src={previewUrl} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
        ) : null}
        <span className="truncate">{file.name}</span>
      </div>
      <button
        type="button"
        aria-label={removeLabel}
        className="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#E2E8F0] text-[#64748B] transition hover:bg-[#CBD5E1]"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
