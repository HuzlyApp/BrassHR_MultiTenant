"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BRAAS_PRIMARY } from "@/lib/tenant/tenant-branding";

const GOLD = BRAAS_PRIMARY;
const TEXT_PRIMARY = "#101828";
const TEXT_SECONDARY = "#667085";

type TemplateCreateSuccessModalProps = {
  open: boolean;
  templateName: string;
  onClose: () => void;
};

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SuccessCheckIcon() {
  return (
    <svg width="32" height="27" viewBox="0 0 32 27" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M26.36 3.77333L28.2267 5.64L11.24 22.6267L3.77333 15.16L5.64 13.2933L11.24 18.8933L26.36 3.77333ZM26.36 0L11.24 15.12L5.64 9.52L0 15.16L11.24 26.4L32 5.64L26.36 0Z"
        fill="white"
      />
    </svg>
  );
}

export default function TemplateCreateSuccessModal({
  open,
  templateName,
  onClose,
}: TemplateCreateSuccessModalProps) {
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

  const displayName = templateName.trim() || "Template";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-created-success-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[400px] rounded-2xl bg-white px-8 pb-8 pt-10 shadow-xl sm:px-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-[#101828] transition hover:brightness-110"
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <div className="flex flex-col items-center text-center">
          <div
            className="mb-6 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: GOLD }}
          >
            <SuccessCheckIcon />
          </div>

          <h2
            id="template-created-success-title"
            className="text-xl font-semibold leading-7"
            style={{ color: TEXT_PRIMARY }}
          >
            Success!
          </h2>

          <p className="mt-2 text-sm leading-5" style={{ color: TEXT_SECONDARY }}>
            New workflow <strong className="font-semibold text-[#101828]">{displayName}</strong> has been
            created
          </p>

          <Link
            href="/admin_recruiter/dashboard/onboarding-flows"
            onClick={onClose}
            className="mt-8 flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white transition hover:brightness-[0.97]"
            style={{ background: "linear-gradient(90deg, #BC8B41 0%, #E9B771 100%)" }}
          >
            Go to flow
          </Link>
        </div>
      </div>
    </div>
  );
}
