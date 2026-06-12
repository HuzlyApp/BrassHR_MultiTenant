"use client";

import { useEffect } from "react";
import { Check, X } from "lucide-react";

type SuccessModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  autoCloseMs?: number;
};

export default function SuccessModal({
  open,
  onClose,
  title = "Success!",
  message = "Action completed successfully",
  autoCloseMs,
}: SuccessModalProps) {
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
    if (!open || !autoCloseMs) return;
    const timer = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(timer);
  }, [open, autoCloseMs, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/30 px-4 py-8 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-modal-title"
        className="relative w-full max-w-[360px] rounded-2xl bg-white px-8 py-10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#101828] text-white transition hover:brightness-110"
        >
          <X size={14} />
        </button>

        <div className="flex flex-col items-center gap-5 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{
              background:
                "linear-gradient(135deg, var(--brand-primary, #bc8b41) 0%, color-mix(in srgb, var(--brand-primary, #bc8b41) 65%, white) 100%)",
            }}
          >
            <Check size={28} className="text-white" strokeWidth={3} aria-hidden />
          </div>

          <div className="flex flex-col gap-1.5">
            <h2
              id="success-modal-title"
              className="text-xl font-bold leading-7"
              style={{ color: "#101828" }}
            >
              {title}
            </h2>
            <p
              className="text-sm leading-5"
              style={{ color: "#667085" }}
            >
              {message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
