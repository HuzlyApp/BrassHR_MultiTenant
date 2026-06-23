"use client";

import Link from "next/link";
import { useEffect, useMemo, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

type SuccessModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: ReactNode;
  size?: "default" | "large";
  autoCloseMs?: number;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
};

function brandGradients(primaryHex: string) {
  return {
    button: `linear-gradient(90deg, ${primaryHex} 0%, color-mix(in srgb, ${primaryHex} 70%, white) 100%)`,
    icon: `linear-gradient(135deg, ${primaryHex} 0%, color-mix(in srgb, ${primaryHex} 65%, white) 100%)`,
  };
}

export default function SuccessModal({
  open,
  onClose,
  title = "Success!",
  message = "Action completed successfully",
  size = "default",
  autoCloseMs,
  actionHref,
  actionLabel,
  onAction,
}: SuccessModalProps) {
  const branding = useTenantBranding();
  const gradients = useMemo(
    () => brandGradients(branding.primaryHex),
    [branding.primaryHex]
  );

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

  const isLarge = size === "large";
  const showAction = Boolean(actionLabel && (actionHref || onAction));

  const actionButtonClass = isLarge
    ? "mt-6 flex h-11 w-full max-w-[360px] items-center justify-center rounded-lg text-sm font-semibold text-white transition hover:brightness-[0.97]"
    : "mt-2 flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white transition hover:brightness-[0.97]";

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center px-4 py-8 ${
        isLarge ? "z-[140]" : "z-60"
      } ${isLarge ? "bg-black/40 backdrop-blur-[2px]" : "bg-black/30 backdrop-blur-[2px]"}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-modal-title"
        className={
          isLarge
            ? "relative flex min-h-[383px] w-full max-w-[500px] flex-col items-center justify-center rounded-[20px] border border-[#E5E7EB] bg-white px-8 pb-8 pt-10 shadow-xl"
            : "relative w-full max-w-[360px] rounded-2xl bg-white px-8 py-10 shadow-2xl"
        }
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`absolute flex items-center justify-center rounded-full bg-[#101828] text-white transition hover:brightness-110 ${
            isLarge ? "right-4 top-4 h-6 w-6" : "right-4 top-4 h-8 w-8"
          }`}
        >
          <X size={isLarge ? 12 : 14} />
        </button>

        <div className={`flex flex-col items-center text-center ${isLarge ? "gap-0" : "gap-5"}`}>
          <div
            className={`flex items-center justify-center rounded-full ${
              isLarge ? "mb-5 h-[72px] w-[72px]" : "h-16 w-16"
            }`}
            style={{ background: gradients.icon }}
          >
            <Check
              size={isLarge ? 32 : 28}
              className="text-white"
              strokeWidth={isLarge ? 2.5 : 3}
              aria-hidden
            />
          </div>

          <div className={`flex flex-col ${isLarge ? "gap-2" : "gap-1.5"}`}>
            <h2
              id="success-modal-title"
              className={
                isLarge
                  ? "text-2xl font-semibold leading-8 text-[#101828]"
                  : "text-xl font-bold leading-7"
              }
              style={isLarge ? undefined : { color: "#101828" }}
            >
              {title}
            </h2>
            {typeof message === "string" ? (
              <p
                className={isLarge ? "text-base leading-6 text-[#4B5563]" : "text-sm leading-5"}
                style={isLarge ? undefined : { color: "#667085" }}
              >
                {message}
              </p>
            ) : (
              <div
                className={
                  isLarge
                    ? "flex flex-col gap-1 text-base leading-6 text-[#4B5563]"
                    : "text-sm leading-5 text-[#667085]"
                }
              >
                {message}
              </div>
            )}
          </div>

          {showAction && actionHref ? (
            <Link
              href={actionHref}
              onClick={onClose}
              className={actionButtonClass}
              style={{ background: gradients.button }}
            >
              {actionLabel}
            </Link>
          ) : null}

          {showAction && onAction && !actionHref ? (
            <button
              type="button"
              onClick={() => {
                onAction();
                onClose();
              }}
              className={actionButtonClass}
              style={{ background: gradients.button }}
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
