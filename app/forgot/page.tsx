"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { interStyle } from "@/app/login/BraasLoginShell";

const BRAAS_BUTTON_GRADIENT = "linear-gradient(90deg, #BC8B41 0%, #E9B771 100%)";
const LOCK_ICON = "/icons/braas-HR/lock.svg";
const KEY_ICON = "/icons/braas-HR/key.svg";
const EYE_ICON = "/icons/braas-HR/eye.svg";

const inputTypographyStyle = {
  fontFamily: "Inter, Arial, sans-serif",
  fontSize: "16px",
  lineHeight: "24px",
  fontWeight: 400,
  letterSpacing: "0",
} as const;

const inputTextClass =
  "text-[16px] font-normal leading-[24px] tracking-normal placeholder:text-[16px] placeholder:leading-[24px] placeholder:font-normal";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password.trim()) return;
    setSubmitting(true);
    router.push("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f4f6] px-[20px] py-[40px]">
      <div
        className="w-full max-w-[620px] rounded-[16px] border border-[#e5e7eb] bg-white px-[32px] py-[36px] shadow-[0_8px_30px_rgba(15,23,42,0.08)]"
        style={interStyle}
      >
        <div className="flex flex-col items-center">
          <span className="flex h-[56px] w-[56px] items-center justify-center rounded-[12px] bg-[#F3F4F6]">
            <Image src={LOCK_ICON} alt="" width={24} height={32} className="h-[32px] w-[24px] object-contain" priority />
          </span>
        </div>

        <div className="my-[28px] h-px w-full bg-[#e7edf4]" aria-hidden />

        <h1 className="text-left text-[30px] font-semibold leading-[36px] tracking-normal text-[#0b0f19]">
          Just to be safe, we logged you out.
        </h1>
        <p className="mt-[10px]  text-[16px] font-normal leading-[24px] text-[#64748b]">
          Enter your password to pick up where you left off.
        </p>

        <form onSubmit={handleSubmit} className="mt-[32px]">
          <label htmlFor="password" className="mb-[10px] block text-[14px] font-normal leading-[20px] text-[#0f172a]">
            Password
            <span className="ml-1 text-[#ef4565]">*</span>
          </label>

          <div className="relative">
            <span className="pointer-events-none absolute left-[14px] top-1/2 flex h-[17px] w-[17px] -translate-y-1/2 items-center justify-center">
              <Image src={KEY_ICON} alt="" width={17} height={17} className="h-[17px] w-[17px]" />
            </span>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
              style={inputTypographyStyle}
              className={`h-[56px] w-full rounded-[8px] border border-[#cbd5e1] bg-white pl-[44px] pr-12 ${inputTextClass} text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B4120]`}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((current) => !current)}
              className={`absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition ${
                showPassword ? "bg-[#BC8B411F] ring-1 ring-[#BC8B4140]" : "hover:bg-[#f8fafc]"
              }`}
            >
              <Image
                src={EYE_ICON}
                alt=""
                width={20}
                height={20}
                className="h-[20px] w-[20px]"
                style={{
                  filter: showPassword
                    ? "brightness(0) saturate(100%) invert(55%) sepia(33%) saturate(738%) hue-rotate(359deg) brightness(88%) contrast(86%)"
                    : undefined,
                }}
              />
            </button>
          </div>

          <div className="mt-[10px] flex justify-end">
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="text-[14px] font-normal leading-[20px] text-[#104b83] hover:underline"
            >
              {showPassword ? "Hide password" : "Show password"}
            </button>
          </div>

          <button
            type="submit"
            disabled={!password.trim() || submitting}
            className="mt-[28px] flex h-[52px] w-full items-center justify-center rounded-[8px] text-[16px] font-semibold leading-[22px] text-white transition enabled:hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#dddddd] disabled:text-[#c5c5c5]"
            style={{
              backgroundImage: password.trim() ? BRAAS_BUTTON_GRADIENT : undefined,
              fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
            }}
          >
            Log In
          </button>
        </form>
      </div>
    </main>
  );
}
