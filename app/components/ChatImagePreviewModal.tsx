"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  imageUrl: string | null;
  alt?: string;
  onClose: () => void;
};

export default function ChatImagePreviewModal({ open, imageUrl, alt = "Image", onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close image preview"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
      >
        <X className="h-6 w-6" aria-hidden />
      </button>

      <div
        className="flex max-h-full max-w-full flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={alt}
          className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain"
        />
        {alt ? (
          <p className="max-w-[92vw] truncate text-center text-sm font-medium text-white/90">{alt}</p>
        ) : null}
      </div>
    </div>
  );
}
