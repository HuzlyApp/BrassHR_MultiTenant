"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };
const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

const inputFocusClass =
  "focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]";

type LoginOtpStepProps = {
  email: string;
  submitting?: boolean;
  onVerify: (code: string) => void;
};

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function verifyButtonStyle(enabled: boolean): React.CSSProperties | undefined {
  if (!enabled) return undefined;
  return {
    backgroundImage: "linear-gradient(90deg, var(--brand-primary) 0%, var(--brand-accent) 100%)",
    fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
  };
}

export default function LoginOtpStep({ email, submitting = false, onVerify }: LoginOtpStepProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length: OTP_LENGTH }, () => ""));
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const code = useMemo(() => digits.join(""), [digits]);
  const isComplete = code.length === OTP_LENGTH && digits.every((digit) => digit.length === 1);

  const updateDigit = (index: number, value: string) => {
    const nextDigit = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = nextDigit;
      return next;
    });
    if (nextDigit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;

    setDigits(Array.from({ length: OTP_LENGTH }, (_, index) => pasted[index] ?? ""));
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleResend = () => {
    setDigits(Array.from({ length: OTP_LENGTH }, () => ""));
    setSecondsLeft(RESEND_SECONDS);
    inputRefs.current[0]?.focus();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isComplete || submitting) return;
    onVerify(code);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[40px] pt-[30px]">
      <div>
        <h1 className="text-[30px] font-semibold leading-[36px] tracking-normal text-[#1f2937]" style={interStyle}>
          Enter Code
        </h1>
        <div className="mt-[12px] space-y-[12px]">
          <p className="text-[14px] font-normal leading-[20px] text-[#4b5563]" style={interStyle}>
            We&apos;ve send you the verification code on this email.
          </p>
          <p className="text-[16px] font-semibold leading-[24px] text-black" style={interStyle}>
            {email}
          </p>
        </div>
      </div>

      <div className="pt-[20px]">
        {isComplete ? (
          <div className="mb-[20px] flex items-center gap-[8px] text-[14px] font-normal leading-[20px] text-[#374151]" style={interStyle}>
            <span
              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <Check className="h-[12px] w-[12px]" strokeWidth={3} />
            </span>
            <span>
              <span className="font-semibold text-black">OTP Passed!</span> Verify to continue.
            </span>
          </div>
        ) : null}

        <p className="text-[14px] font-bold leading-[20px] text-[#374151]" style={interStyle}>
          Enter 6 digit OTP
        </p>

        <div className="flex gap-[30px] py-[24px]">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={digit}
              onChange={(event) => updateDigit(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={handlePaste}
              aria-label={`Digit ${index + 1}`}
              className={`h-[56px] w-[56px] rounded-[8px] border border-[#94a3b8] bg-white text-center text-[20px] font-semibold leading-[24px] text-[#0f172a] outline-none transition ${inputFocusClass}`}
              style={interStyle}
            />
          ))}
        </div>

        <div className="flex items-center gap-[10px] text-[14px] leading-[20px]" style={interStyle}>
          <span className="text-[#374151]">
            Get Code in{" "}
            <span className="font-semibold text-black">{formatTimer(secondsLeft)}</span>
          </span>
          <button
            type="button"
            onClick={handleResend}
            disabled={secondsLeft > 0}
            className="font-normal hover:underline disabled:cursor-not-allowed disabled:text-[#94a3b8] disabled:no-underline"
            style={{ color: secondsLeft > 0 ? "#94a3b8" : "var(--brand-secondary)" }}
          >
            Resend
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={!isComplete || submitting}
        className="flex h-[54px] w-full items-center justify-center rounded-[12px] text-[16px] font-semibold leading-[22px] tracking-normal transition disabled:cursor-not-allowed disabled:bg-[#dddddd] disabled:text-[#94a3b8] enabled:text-white enabled:hover:brightness-95"
        style={verifyButtonStyle(isComplete && !submitting)}
      >
        {submitting ? "Verifying..." : "Verify Code"}
      </button>
    </form>
  );
}
