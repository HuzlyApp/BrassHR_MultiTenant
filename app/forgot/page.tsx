"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { interStyle } from "@/app/login/BraasLoginShell";
import { supabaseBrowser } from "@/lib/supabase-browser";

const BRAAS_BUTTON_GRADIENT = "linear-gradient(90deg, #BC8B41 0%, #E9B771 100%)";
const LOCK_ICON = "/icons/braas-HR/lock.svg";

const inputTypographyStyle = {
  fontFamily: "Inter, Arial, sans-serif",
  fontSize: "16px",
  lineHeight: "24px",
  fontWeight: 400,
  letterSpacing: "0",
} as const;

const inputTextClass =
  "text-[16px] font-normal leading-[24px] tracking-normal placeholder:text-[16px] placeholder:leading-[24px] placeholder:font-normal";

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/login";
  return value;
}

export default function ForgotPasswordPage() {
  const searchParams = useSearchParams();
  const signInHref = safeReturnPath(searchParams.get("return"));
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabaseBrowser.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
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

        {sent ? (
          <>
            <h1 className="text-left text-[30px] font-semibold leading-[36px] tracking-normal text-[#0b0f19]">
              Check your email
            </h1>
            <p className="mt-[10px] text-[16px] font-normal leading-[24px] text-[#64748b]">
              If an account exists for <span className="font-medium text-[#0f172a]">{email.trim()}</span>, we sent a
              link to reset your password.
            </p>
            <Link
              href={signInHref}
              className="mt-[28px] flex h-[52px] w-full items-center justify-center rounded-[8px] text-[16px] font-semibold leading-[22px] text-white transition hover:brightness-95"
              style={{
                backgroundImage: BRAAS_BUTTON_GRADIENT,
                fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
              }}
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-left text-[30px] font-semibold leading-[36px] tracking-normal text-[#0b0f19]">
              Forgot your password?
            </h1>
            <p className="mt-[10px] text-[16px] font-normal leading-[24px] text-[#64748b]">
              Enter the email address for your account and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="mt-[32px]">
              <label htmlFor="email" className="mb-[10px] block text-[14px] font-normal leading-[20px] text-[#0f172a]">
                Email
                <span className="ml-1 text-[#ef4565]">*</span>
              </label>

              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                autoComplete="email"
                required
                style={inputTypographyStyle}
                className={`h-[56px] w-full rounded-[8px] border border-[#cbd5e1] bg-white px-[14px] ${inputTextClass} text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B4120]`}
              />

              {error ? (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={!email.trim() || submitting}
                className="mt-[28px] flex h-[52px] w-full items-center justify-center rounded-[8px] text-[16px] font-semibold leading-[22px] text-white transition enabled:hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#dddddd] disabled:text-[#c5c5c5]"
                style={{
                  backgroundImage: email.trim() ? BRAAS_BUTTON_GRADIENT : undefined,
                  fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
                }}
              >
                {submitting ? "Sending…" : "Send reset link"}
              </button>

              <p className="mt-6 text-center text-[14px] text-[#64748b]">
                <Link href={signInHref} className="font-medium text-[#104b83] hover:underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
