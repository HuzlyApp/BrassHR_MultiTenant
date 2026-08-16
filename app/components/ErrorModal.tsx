"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

type ErrorModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

function brandGradients(primaryHex: string) {
  return {
    button: `linear-gradient(90deg, ${primaryHex} 0%, color-mix(in srgb, ${primaryHex} 70%, white) 100%)`,
  };
}

export default function ErrorModal({
  open,
  onClose,
  title = "Upload failed",
  message = "Something went wrong. Please try again.",
  actionLabel = "Close",
  onAction,
}: ErrorModalProps) {
  const branding = useTenantBranding();
  const gradients = useMemo(
    () => brandGradients(branding.primaryHex),
    [branding.primaryHex]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="error-modal-title"
        className="relative flex min-h-[320px] w-full max-w-[500px] flex-col items-center justify-center rounded-[20px] border border-[#E5E7EB] bg-white px-8 pb-8 pt-10 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-[#101828] text-white transition hover:brightness-110"
        >
          <X size={12} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#FEF2F2]">
            <AlertTriangle size={32} className="text-[#DC2626]" strokeWidth={2.25} aria-hidden />
          </div>

          <h2
            id="error-modal-title"
            className="text-2xl font-semibold leading-8 text-[#101828]"
          >
            {title}
          </h2>

          {typeof message === "string" ? (
            <p className="mt-2 max-w-[360px] text-base leading-6 text-[#4B5563]">{message}</p>
          ) : (
            <div className="mt-2 max-w-[360px] text-base leading-6 text-[#4B5563]">{message}</div>
          )}

          <button
            type="button"
            onClick={() => {
              onAction?.();
              onClose();
            }}
            className="mt-6 flex h-11 w-full max-w-[360px] items-center justify-center rounded-lg text-sm font-semibold text-white transition hover:brightness-[0.97]"
            style={{ background: gradients.button }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
