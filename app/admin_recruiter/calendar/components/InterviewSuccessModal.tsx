"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";

type InterviewSuccessModalProps = {
  open: boolean;
  onClose: () => void;
  onGoToCalendar: () => void;
};

export function InterviewSuccessModal({ open, onClose, onGoToCalendar }: InterviewSuccessModalProps) {
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="interview-success-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[500px] rounded-[20px] border border-[#E5E7EB] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end px-3.5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-white"
            aria-label="Close"
          >
            <span className="text-xs">×</span>
          </button>
        </div>
        <div className="flex flex-col items-center px-5 pb-8 pt-2 text-center">
          <div
            className="mb-5 flex h-[74px] w-[74px] items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--brand-primary, #bc8b41)" }}
          >
            <Check className="h-8 w-8 text-white" strokeWidth={2.5} />
          </div>
          <h2 id="interview-success-title" className="text-2xl font-semibold text-black">
            Success!
          </h2>
          <p className="mt-2 text-base text-[#4B5563]">You have scheduled a new interview</p>
          <button
            type="button"
            onClick={onGoToCalendar}
            className="mt-6 rounded-lg px-6 py-2.5 text-sm font-semibold text-white"
            style={{
              background:
                "linear-gradient(90deg, var(--brand-primary, #bc8b41) 0%, color-mix(in srgb, var(--brand-primary, #bc8b41) 70%, #e9b771) 100%)",
            }}
          >
            Go to Calendar
          </button>
        </div>
      </div>
    </div>
  );
}
