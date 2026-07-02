"use client";

import Image from "next/image";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };
const BRAAS_BUTTON_GRADIENT = "linear-gradient(90deg, #BC8B41 0%, #E9B771 100%)";
const ACCOUNT_READY_ICON = "/icons/braas-HR/account-ready-icon.svg";

type AccountReadyModalProps = {
  email: string;
  onExit: () => void;
  onResend?: () => void | Promise<void>;
  resending?: boolean;
};

export default function AccountReadyModal({
  email,
  onExit,
  onResend,
  resending = false,
}: AccountReadyModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-[2px]"
      role="presentation"
      onClick={onExit}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-ready-title"
        className="flex h-[500px] w-[600px] max-w-full items-center justify-center rounded-3xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex w-[486px] max-w-full flex-col items-center gap-[40px]">
          <Image
            src={ACCOUNT_READY_ICON}
            alt=""
            width={100}
            height={100}
            priority
            className="h-[100px] w-[100px] shrink-0 object-contain"
          />

          <h2
            id="account-ready-title"
            className="w-full text-center text-[30px] font-semibold leading-[36px] tracking-normal text-[#0b0f19]"
            style={interStyle}
          >
            Your account is ready
          </h2>

          <p
            className="w-full text-center text-[18px] font-normal leading-[28px] tracking-normal text-[#475569]"
            style={interStyle}
          >
            We&apos;ve sent a verification/status link to{" "}
            <span className="font-semibold text-[#0f172a]">{email}</span>. Click the link in your
            email to continue setting up your trial.
          </p>

          <button
            type="button"
            onClick={onExit}
            className="flex h-[52px] w-full items-center justify-center rounded-[8px] text-[16px] font-semibold leading-[22px] tracking-normal text-white transition hover:brightness-95"
            style={{
              backgroundImage: BRAAS_BUTTON_GRADIENT,
              fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
            }}
          >
            Exit
          </button>

          {onResend ? (
            <button
              type="button"
              onClick={() => void onResend()}
              disabled={resending}
              className="text-sm font-semibold text-[#BC8B41] transition hover:underline disabled:opacity-60"
            >
              {resending ? "Sending…" : "Didn't receive it? Resend setup link"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
