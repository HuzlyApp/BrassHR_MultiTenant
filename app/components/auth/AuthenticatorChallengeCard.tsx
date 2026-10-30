"use client";

import { FormEvent, useId, useState } from "react";
import { verifyCurrentAuthenticator } from "@/lib/auth/authenticator-mfa";
import { supabaseBrowser } from "@/lib/supabase-browser";

const inputClassName =
  "h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm tracking-[0.3em] text-[#111827] outline-none focus-visible:ring-2 focus-visible:ring-[#012352]/30";

type AuthenticatorChallengeCardProps = {
  onVerified: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  cancelLabel?: string;
  layout?: "plain" | "page";
};

export default function AuthenticatorChallengeCard({
  onVerified,
  onCancel,
  cancelLabel = "Back to sign in",
  layout = "plain",
}: AuthenticatorChallengeCardProps) {
  const inputId = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = code.length === 6 && !submitting;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await verifyCurrentAuthenticator(supabaseBrowser, code);
      await onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not match. Try the code currently on screen.");
      setSubmitting(false);
    }
  };

  const form = (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
      <div>
        <h1 className="text-sm font-semibold leading-5 text-black">Authenticator</h1>
        <p className="mt-1 text-[13px] leading-5 text-[#6B7280]">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>
      <div>
        <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-[#374151]">
          Verification code
        </label>
        <input
          id={inputId}
          value={code}
          onChange={(event) => {
            setError(null);
            setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          placeholder="000000"
          aria-invalid={error != null}
          className={inputClassName}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!canSubmit}
        className="h-10 rounded-lg bg-[#012352] px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Checking..." : "Continue"}
      </button>
      {onCancel ? (
        <button
          type="button"
          onClick={() => void onCancel()}
          disabled={submitting}
          className="h-10 rounded-lg border border-[#E5E7EB] bg-white px-4 text-sm font-medium text-[#374151] disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      ) : null}
    </form>
  );

  if (layout === "page") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F4F4] px-4">
        <div className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-6">{form}</div>
      </div>
    );
  }

  return form;
}
