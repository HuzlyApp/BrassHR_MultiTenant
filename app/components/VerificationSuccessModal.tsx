"use client";

import Image from "next/image";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };
const SUCCESS_ICON = "/icons/braas-HR/account-ready-icon.svg";

type VerificationSuccessModalProps = {
  title?: string;
  message?: string;
  buttonLabel?: string;
  loading?: boolean;
  onAction: () => void;
};

export default function VerificationSuccessModal({
  title = "Success!",
  message = "Verification complete",
  buttonLabel = "Continue",
  loading = false,
  onAction,
}: VerificationSuccessModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-success-title"
        className="flex h-[500px] w-[600px] max-w-full items-center justify-center rounded-3xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex w-[486px] max-w-full flex-col items-center gap-[40px]">
          <Image
            src={SUCCESS_ICON}
            alt=""
            width={100}
            height={100}
            priority
            className="h-[100px] w-[100px] shrink-0 object-contain"
          />

          <div className="flex w-full flex-col items-center gap-[8px] text-center">
            <h2
              id="verification-success-title"
              className="text-[30px] font-semibold leading-[36px] tracking-normal text-[#0b0f19]"
              style={interStyle}
            >
              {title}
            </h2>
            <p className="text-[18px] font-normal leading-[28px] tracking-normal text-[#475569]" style={interStyle}>
              {message}
            </p>
          </div>

          <button
            type="button"
            onClick={onAction}
            disabled={loading}
            className="flex h-[52px] w-full items-center justify-center rounded-[8px] text-[16px] font-semibold leading-[22px] tracking-normal text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              backgroundImage: "linear-gradient(90deg, var(--brand-primary) 0%, var(--brand-accent) 100%)",
              fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
            }}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
