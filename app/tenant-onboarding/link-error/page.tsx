"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };
const BRAAS_BUTTON_GRADIENT = "linear-gradient(90deg, #BC8B41 0%, #E9B771 100%)";

const ERROR_COPY: Record<string, { title: string; message: string }> = {
  missing: {
    title: "This setup link is invalid",
    message: "The link is missing required information. Request a new setup link below.",
  },
  invalid: {
    title: "This setup link is invalid",
    message: "This link could not be verified. Request a new setup link below.",
  },
  expired: {
    title: "This setup link has expired",
    message: "Setup links expire for security. Request a new link to continue BrassHR setup.",
  },
  revoked: {
    title: "This setup link is invalid",
    message: "This link is no longer active. Request a new setup link below.",
  },
};

function LinkErrorContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code")?.trim() || "invalid";
  const copy = ERROR_COPY[code] ?? ERROR_COPY.invalid;
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  async function handleResend() {
    setResending(true);
    setResendMessage(null);
    setResendError(null);
    try {
      const res = await fetch("/api/auth/signup/resend-onboarding-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        sent?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setResendError(json.error || "Could not resend setup link.");
        return;
      }
      if (json.sent) {
        setResendMessage("A new setup link has been sent to your email.");
      } else {
        setResendMessage("If your account is eligible, a setup link is on its way.");
      }
    } catch {
      setResendError("Network error. Try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-[520px] rounded-3xl border border-[#e8edf4] bg-white p-8 shadow-sm">
        <Image
          src="/icons/braas-HR/BrassHR-logo.svg"
          alt="Brass HR"
          width={140}
          height={70}
          className="mb-8 h-[70px] w-[140px] object-contain"
        />
        <h1 className="text-[28px] font-semibold leading-[34px] text-[#0b0f19]" style={interStyle}>
          {copy.title}
        </h1>
        <p className="mt-3 text-[16px] leading-[24px] text-[#475569]" style={interStyle}>
          {copy.message}
        </p>

        {resendMessage ? (
          <p className="mt-4 text-sm text-emerald-700">{resendMessage}</p>
        ) : null}
        {resendError ? <p className="mt-4 text-sm text-red-700">{resendError}</p> : null}

        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={resending}
          className="mt-8 flex h-[48px] w-full items-center justify-center rounded-[8px] text-[15px] font-semibold text-white disabled:opacity-60"
          style={{ backgroundImage: BRAAS_BUTTON_GRADIENT, ...interStyle }}
        >
          {resending ? "Sending..." : "Resend setup link"}
        </button>

        <p className="mt-4 text-center text-sm text-[#64748b]">
          <Link href="/login" className="font-medium text-[#BC8B41] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function TenantOnboardingLinkErrorPage() {
  return (
    <Suspense fallback={null}>
      <LinkErrorContent />
    </Suspense>
  );
}
