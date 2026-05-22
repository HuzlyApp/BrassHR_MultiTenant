"use client";

import { AlertCircle } from "lucide-react";
import type { LoginAuthErrorCode } from "@/lib/auth/login-api-errors";
import { titleForLoginError } from "@/lib/auth/login-api-errors";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };

type LoginFormErrorProps = {
  message: string;
  code?: LoginAuthErrorCode;
  title?: string | null;
};

export default function LoginFormError({ message, code, title }: LoginFormErrorProps) {
  const heading = title ?? (code ? titleForLoginError(code) : null);

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex gap-[12px] rounded-[10px] border border-[#fca5a5] bg-[#fef2f2] px-[16px] py-[14px]"
      style={interStyle}
    >
      <span className="mt-[2px] flex h-[20px] w-[20px] shrink-0 items-center justify-center text-[#dc2626]" aria-hidden>
        <AlertCircle className="h-[20px] w-[20px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        {heading ? (
          <p className="text-[14px] font-semibold leading-[20px] text-[#991b1b]">{heading}</p>
        ) : null}
        <p
          className={`text-[14px] font-normal leading-[22px] text-[#b91c1c] ${heading ? "mt-[4px]" : ""}`}
        >
          {message}
        </p>
      </div>
    </div>
  );
}

/** Red border for inputs when API marks a field invalid. */
export const loginInputErrorClass =
  "!border-[#ef4444] !bg-[#fff5f5] focus:!border-[#dc2626] focus:ring-2 focus:ring-[#fecaca]";
