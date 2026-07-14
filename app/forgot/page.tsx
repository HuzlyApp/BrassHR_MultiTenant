"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import {
  interStyle,
  loginFieldLabelClass,
  loginInputTextClass,
  loginPrimaryButtonClass,
} from "@/app/login/BraasLoginShell";

const BRAAS_BUTTON_GRADIENT = "linear-gradient(90deg, #BC8B41 0%, #E9B771 100%)";
const LOCK_ICON = "/icons/braas-HR/lock.svg";

/** Brass HR gold focus — do not use loginInputClass (brand CSS vars). */
const forgotEmailInputClass = [
  "h-[44px] w-full rounded-[8px] border border-[#cbd5e1] bg-white px-3",
  "outline-none transition placeholder:text-[#94a3b8]",
  "focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B4120]",
  "sm:h-[56px] sm:px-[14px]",
  loginInputTextClass,
  "text-[#0f172a]",
].join(" ");

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/admin";
  if (value === "/login" || value.startsWith("/login?")) return "/admin";
  return value;
}

function withTenantQuery(href: string, tenant: string | null): string {
  const slug = tenant?.trim().toLowerCase();
  if (!slug || slug.length < 2) return href;
  const [path, existingQs = ""] = href.split("?");
  const params = new URLSearchParams(existingQs);
  if (!params.has("tenant")) params.set("tenant", slug);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

const titleClassName =
  "whitespace-nowrap text-left text-[30px] font-semibold leading-[36px] tracking-normal text-[#0b0f19] max-[399px]:whitespace-normal max-[399px]:text-[22px] max-[399px]:leading-[28px] min-[400px]:max-[549px]:text-[26px] min-[400px]:max-[549px]:leading-[31px] min-[550px]:max-[1079px]:text-[27px] min-[550px]:max-[1079px]:leading-[32px]";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const tenantSlug = searchParams.get("tenant")?.trim().toLowerCase() || null;
  const signInHref = withTenantQuery(safeReturnPath(searchParams.get("return")), tenantSlug);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSubmit = Boolean(email.trim());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);

    try {
      const sendRes = await fetch("/api/auth/forgot-password/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          origin: window.location.origin,
          returnTo: safeReturnPath(searchParams.get("return")),
        }),
      });
      const sendPayload = (await sendRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        reason?: string;
      };

      if (!sendRes.ok) {
        setError(
          sendPayload.error ||
            (sendPayload.reason === "not_found"
              ? "No account found with this email. Check the address and try again."
              : "Something went wrong. Try again.")
        );
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
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#f3f4f6] px-4 py-8 sm:px-5 sm:py-10">
      <div
        className="w-full max-w-[620px] rounded-[14px] border border-[#e5e7eb] bg-white px-5 py-6 shadow-[0_8px_30px_rgba(15,23,42,0.08)] sm:rounded-[16px] sm:px-8 sm:py-9"
        style={interStyle}
      >
        <div className="flex flex-col items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#F3F4F6] sm:h-[56px] sm:w-[56px] sm:rounded-[12px]">
            <Image
              src={LOCK_ICON}
              alt=""
              width={24}
              height={32}
              className="h-7 w-5 object-contain sm:h-[32px] sm:w-[24px]"
              priority
            />
          </span>
        </div>

        <div className="my-5 h-px w-full bg-[#e7edf4] sm:my-7" aria-hidden />

        {sent ? (
          <div className="pt-1 sm:pt-0.5">
            <h1 className={titleClassName}>Check your email</h1>
            <p className="mt-2 break-words text-[14px] font-normal leading-5 text-[#64748b] sm:mt-2.5 sm:text-[16px] sm:leading-6">
              We sent a reset link to <span className="font-medium text-[#0f172a]">{email.trim()}</span>.
            </p>
            <Link
              href={signInHref}
              className={`mt-6 sm:mt-7 ${loginPrimaryButtonClass}`}
              style={{
                backgroundImage: BRAAS_BUTTON_GRADIENT,
                fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
              }}
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className={titleClassName}>Forgot your password?</h1>
            <p className="mt-2 text-[14px] font-normal leading-5 text-[#64748b] sm:mt-2.5 sm:text-[16px] sm:leading-6">
              Enter the email address for your account and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 sm:mt-8">
              <label htmlFor="email" className={loginFieldLabelClass}>
                Email
                <span className="ml-1 text-[#ef4565]">*</span>
              </label>

              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
                placeholder="Email"
                autoComplete="email"
                required
                className={forgotEmailInputClass}
              />

              {error ? (
                <p
                  className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] leading-5 text-red-700 sm:px-4 sm:py-3 sm:text-sm"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className={`mt-6 sm:mt-7 ${loginPrimaryButtonClass}`}
                style={{
                  backgroundImage: canSubmit && !submitting ? BRAAS_BUTTON_GRADIENT : undefined,
                  fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
                }}
              >
                {submitting ? "Sending…" : "Send reset link"}
              </button>

              <p className="mt-5 text-center text-[13px] text-[#64748b] sm:mt-6 sm:text-[14px]">
                <Link href={signInHref} className="font-medium text-[#012352] hover:underline">
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

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-[#f3f4f6]" aria-hidden="true" />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
