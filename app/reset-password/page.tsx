"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { PasswordVisibilityToggle } from "@/app/components/PasswordVisibilityToggle";
import { interStyle } from "@/app/login/BraasLoginShell";
import {
  PASSWORD_UPDATE_SUCCESS_MESSAGE,
  updateAuthUserPassword,
  validatePasswordUpdate,
} from "@/lib/account/password-update";
import { supabaseBrowser } from "@/lib/supabase-browser";

const BRAAS_BUTTON_GRADIENT = "linear-gradient(90deg, #BC8B41 0%, #E9B771 100%)";
const KEY_ICON = "/icons/braas-HR/key.svg";

const inputTypographyStyle = {
  fontFamily: "Inter, Arial, sans-serif",
  fontSize: "16px",
  lineHeight: "24px",
  fontWeight: 400,
  letterSpacing: "0",
} as const;

const inputTextClass =
  "text-[16px] font-normal leading-[24px] tracking-normal placeholder:text-[16px] placeholder:leading-[24px] placeholder:font-normal";

function PasswordInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-[10px] block text-[14px] font-normal leading-[20px] text-[#0f172a]">
        {label}
        <span className="ml-1 text-[#ef4565]">*</span>
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-[14px] top-1/2 flex h-[17px] w-[17px] -translate-y-1/2 items-center justify-center">
          <Image src={KEY_ICON} alt="" width={17} height={17} className="h-[17px] w-[17px]" />
        </span>
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={label}
          autoComplete="new-password"
          required
          style={inputTypographyStyle}
          className={`h-[56px] w-full rounded-[8px] border border-[#cbd5e1] bg-white pl-[44px] pr-12 ${inputTextClass} text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B4120]`}
        />
        <PasswordVisibilityToggle
          visible={visible}
          onToggle={() => setVisible((current) => !current)}
          label={label}
        />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const newPasswordId = useId();
  const confirmPasswordId = useId();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validatePasswordUpdate(newPassword, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      if (!session) {
        setError("This reset link is invalid or has expired. Request a new one from the sign-in page.");
        return;
      }

      await updateAuthUserPassword(supabaseBrowser, newPassword);
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
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
        <h1 className="text-left text-[30px] font-semibold leading-[36px] tracking-normal text-[#0b0f19]">
          Set a new password
        </h1>
        <p className="mt-[10px] text-[16px] font-normal leading-[24px] text-[#64748b]">
          Choose a strong password for your account.
        </p>

        {success ? (
          <p className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
            {PASSWORD_UPDATE_SUCCESS_MESSAGE} Redirecting to sign in…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-[32px] space-y-6">
            <PasswordInput id={newPasswordId} label="New password" value={newPassword} onChange={setNewPassword} />
            <PasswordInput
              id={confirmPasswordId}
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!newPassword || !confirmPassword || submitting}
              className="flex h-[52px] w-full items-center justify-center rounded-[8px] text-[16px] font-semibold leading-[22px] text-white transition enabled:hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#dddddd] disabled:text-[#c5c5c5]"
              style={{
                backgroundImage: newPassword && confirmPassword ? BRAAS_BUTTON_GRADIENT : undefined,
                fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
              }}
            >
              {submitting ? "Updating…" : "Update password"}
            </button>

            <p className="text-center text-[14px] text-[#64748b]">
              <Link href="/forgot" className="font-medium text-[#104b83] hover:underline">
                Request a new reset link
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
