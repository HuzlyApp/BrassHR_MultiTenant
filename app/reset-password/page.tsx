"use client";

import type { Session } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import RedirectionProgressModal from "@/app/components/RedirectionProgressModal";
import { PasswordVisibilityToggle } from "@/app/components/PasswordVisibilityToggle";
import { loginInputErrorClass } from "@/app/login/LoginFormError";
import {
  interStyle,
  loginFieldLabelClass,
  loginInputTextClass,
  loginPrimaryButtonClass,
} from "@/app/login/BraasLoginShell";
import {
  PASSWORD_UPDATE_SUCCESS_MESSAGE,
  updateAuthUserPassword,
} from "@/lib/account/password-update";
import {
  passwordPolicyValidationError,
  passwordStrengthValidationError,
} from "@/lib/auth/password-policy";
import {
  buildForgotPasswordHref,
  buildPostResetSignInHref,
} from "@/lib/auth/password-reset-return";
import {
  authSessionIsPasswordRecovery,
  passwordRecoverySessionMatches,
  planPasswordRecoverySession,
  readPasswordRecoveryLinkParams,
} from "@/lib/auth/password-recovery-session";
import { createEphemeralAuthClient } from "@/lib/supabase/ephemeral-auth-client";
import { supabaseBrowser } from "@/lib/supabase-browser";

const BRAAS_BUTTON_GRADIENT = "linear-gradient(90deg, #BC8B41 0%, #E9B771 100%)";
const KEY_ICON = "/icons/braas-HR/key.svg";
const RESET_SUCCESS_REDIRECT_MESSAGE = `${PASSWORD_UPDATE_SUCCESS_MESSAGE} Redirecting to sign in…`;
const RESET_LINK_INVALID_MESSAGE =
  "This reset link is invalid or has expired. Request a new one from the sign-in page.";

/** Survives React Strict Mode remounts so a one-time token is not verified twice. */
const recoveryExchanges = new Map<string, Promise<Session>>();

const titleClassName =
  "whitespace-nowrap text-left text-[30px] font-semibold leading-[36px] tracking-normal text-[#0b0f19] max-[399px]:whitespace-normal max-[399px]:text-[22px] max-[399px]:leading-[28px] min-[400px]:max-[549px]:text-[26px] min-[400px]:max-[549px]:leading-[31px] min-[550px]:max-[1079px]:text-[27px] min-[550px]:max-[1079px]:leading-[32px]";

const authCardClassName =
  "w-full max-w-[620px] rounded-[14px] border border-[#e5e7eb] bg-white px-5 py-6 shadow-[0_8px_30px_rgba(15,23,42,0.08)] sm:rounded-[16px] sm:px-8 sm:py-9";

const fieldErrorClassName =
  "mt-1.5 text-[12px] font-medium leading-4 text-[#dc2626] sm:mt-2 sm:text-[13px] sm:leading-5";

const passwordInputBaseClassName = `h-[44px] w-full rounded-[8px] border border-[#cbd5e1] bg-white pl-10 pr-11 outline-none transition placeholder:text-[#94a3b8] focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B4120] sm:h-[56px] sm:pl-[44px] sm:pr-12 ${loginInputTextClass} text-[#0f172a]`;

function PasswordInput({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}) {
  const [visible, setVisible] = useState(false);
  const hasError = Boolean(error);

  return (
    <div>
      <label htmlFor={id} className={loginFieldLabelClass}>
        {label}
        <span className="ml-1 text-[#ef4565]">*</span>
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center sm:left-[14px] sm:h-[17px] sm:w-[17px]">
          <Image src={KEY_ICON} alt="" width={17} height={17} className="h-4 w-4 sm:h-[17px] sm:w-[17px]" />
        </span>
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={label}
          autoComplete="new-password"
          required
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
          // Password managers inject attributes (e.g. aria-autocomplete) before hydrate.
          suppressHydrationWarning
          className={`${passwordInputBaseClassName} ${hasError ? loginInputErrorClass : ""}`}
        />
        <PasswordVisibilityToggle
          visible={visible}
          onToggle={() => setVisible((current) => !current)}
          label={label}
        />
      </div>
      {hasError ? (
        <p id={`${id}-error`} className={fieldErrorClassName} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function fieldErrors(newPassword: string, confirmPassword: string): {
  newPassword: string | null;
  confirmPassword: string | null;
} {
  const strengthError = passwordStrengthValidationError(newPassword);
  if (strengthError) {
    return {
      newPassword: strengthError,
      confirmPassword: null,
    };
  }

  if (!confirmPassword.trim()) {
    return {
      newPassword: null,
      confirmPassword: "Confirm password is required.",
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      newPassword: null,
      confirmPassword: "Passwords do not match.",
    };
  }

  return { newPassword: null, confirmPassword: null };
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-[#f3f4f6]" aria-hidden="true" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantSlug = searchParams.get("tenant")?.trim().toLowerCase() || null;
  const signInHref = buildPostResetSignInHref(searchParams.get("return"), tenantSlug);
  const forgotHref = buildForgotPasswordHref({
    returnTo: searchParams.get("return"),
    tenant: tenantSlug,
  });
  const newPasswordId = useId();
  const confirmPasswordId = useId();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryAccountEmail, setRecoveryAccountEmail] = useState<string | null>(null);
  const recoverySessionRef = useRef<Session | null>(null);

  useEffect(() => {
    let alive = true;
    const unlock = (session: Session) => {
      if (!alive) return;
      recoverySessionRef.current = session;
      setRecoveryAccountEmail(session.user.email ?? null);
      setRecoveryReady(true);
      setFormError(null);
    };
    void (async () => {
      try {
        const { data: { session: existing } } = await supabaseBrowser.auth.getSession();
        if (recoverySessionRef.current) {
          if (!passwordRecoverySessionMatches(existing, recoverySessionRef.current)) {
            throw new Error(RESET_LINK_INVALID_MESSAGE);
          }
          return;
        }
        const link = readPasswordRecoveryLinkParams(searchParams);
        const plan = planPasswordRecoverySession({
          hasExistingSession: Boolean(existing),
          sessionIsRecovery: authSessionIsPasswordRecovery(existing),
          link,
        });
        if (plan === "reuse-recovery-session" && existing) {
          unlock(existing);
          return;
        }
        if (plan !== "verify-link") throw new Error(RESET_LINK_INVALID_MESSAGE);
        const key = link.tokenHash ? `token:${link.tokenHash}` : `code:${link.code}`;
        let exchange = recoveryExchanges.get(key);
        if (!exchange) {
          exchange = (async () => {
            // The exchange response identifies the invitee. Never substitute getUser()
            // from the shared browser session, which another tab can change.
            const result = link.tokenHash
              ? await supabaseBrowser.auth.verifyOtp({ type: "recovery", token_hash: link.tokenHash })
              : await supabaseBrowser.auth.exchangeCodeForSession(link.code!);
            if (result.error || !result.data.session) throw new Error(RESET_LINK_INVALID_MESSAGE);
            return result.data.session;
          })();
          recoveryExchanges.set(key, exchange);
        }
        const verified = await exchange;
        const { data: { session: current } } = await supabaseBrowser.auth.getSession();
        if (!passwordRecoverySessionMatches(current, verified)) throw new Error(RESET_LINK_INVALID_MESSAGE);
        unlock(verified);
        if (alive) {
          const next = new URL(window.location.href);
          next.searchParams.delete("token_hash");
          next.searchParams.delete("type");
          next.searchParams.delete("code");
          window.history.replaceState(null, "", next.pathname + next.search);
        }
      } catch {
        if (alive) {
          recoverySessionRef.current = null;
          setRecoveryReady(false);
          setFormError(RESET_LINK_INVALID_MESSAGE);
        }
      } finally {
        if (alive) setSessionReady(true);
      }
    })();
    return () => { alive = false; };
  }, [searchParams]);

  const errors = useMemo(
    () => (attempted ? fieldErrors(newPassword, confirmPassword) : { newPassword: null, confirmPassword: null }),
    [attempted, newPassword, confirmPassword]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    setFormError(null);

    const validationError = passwordPolicyValidationError(newPassword, confirmPassword);
    if (validationError) {
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      const verified = recoverySessionRef.current;
      if (!session || !recoveryReady || !passwordRecoverySessionMatches(session, verified)) {
        setFormError(RESET_LINK_INVALID_MESSAGE);
        return;
      }

      // Use an isolated client pinned to the verified recovery session. A cookie
      // change between the check above and updateUser cannot target another user.
      const recoveryClient = createEphemeralAuthClient();
      if (!recoveryClient || !verified) throw new Error(RESET_LINK_INVALID_MESSAGE);
      const { data: bound, error: bindError } = await recoveryClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (bindError || !passwordRecoverySessionMatches(bound.session, verified)) {
        throw new Error(RESET_LINK_INVALID_MESSAGE);
      }
      await updateAuthUserPassword(recoveryClient, newPassword);
      const setupRes = await fetch("/api/auth/password-setup-complete", {
        method: "POST",
        headers: { Authorization: `Bearer ${bound.session!.access_token}` },
      });
      if (!setupRes.ok) {
        const payload = (await setupRes.json().catch(() => ({}))) as { error?: string };
        console.error(
          "[reset-password] password-setup-complete failed",
          setupRes.status,
          payload.error ?? "unknown"
        );
        // Password is already updated in Auth; login OTP send will clear the gate.
      }
      const { data: { session: afterUpdate } } = await supabaseBrowser.auth.getSession();
      if (passwordRecoverySessionMatches(afterUpdate, verified)) {
        await supabaseBrowser.auth.signOut({ scope: "local" });
      }
      recoverySessionRef.current = null;
      setSuccess(true);
      setTimeout(() => {
        router.push(signInHref);
      }, 2000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setSubmitting(false);
    }
  }

  return success ? (
    <RedirectionProgressModal message={RESET_SUCCESS_REDIRECT_MESSAGE} />
  ) : (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#f3f4f6] px-4 py-8 sm:px-5 sm:py-10">
      <div className={authCardClassName} style={interStyle}>
        <h1 className={titleClassName}>Set a new password</h1>
        <p className="mt-2 text-[14px] font-normal leading-5 text-[#64748b] sm:mt-2.5 sm:text-[16px] sm:leading-6">
          Choose a strong password for your account.
          {recoveryAccountEmail ? (
            <>
              {" "}
              This updates <span className="font-medium text-[#0f172a]">{recoveryAccountEmail}</span>
              .
            </>
          ) : null}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5 sm:mt-8 sm:space-y-6" noValidate>
          <PasswordInput
            id={newPasswordId}
            label="New password"
            value={newPassword}
            error={errors.newPassword}
            onChange={(value) => {
              setNewPassword(value);
              setFormError(null);
            }}
          />
          <PasswordInput
            id={confirmPasswordId}
            label="Confirm password"
            value={confirmPassword}
            error={errors.confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value);
              setFormError(null);
            }}
          />

          {formError ? (
            <p className={fieldErrorClassName} role="alert">
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !sessionReady || !recoveryReady}
            className={loginPrimaryButtonClass}
            style={{
              backgroundImage: !submitting && sessionReady && recoveryReady ? BRAAS_BUTTON_GRADIENT : undefined,
              fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
            }}
          >
            {submitting ? "Updating…" : !sessionReady ? "Preparing…" : "Update password"}
          </button>

          <p className="text-center text-[13px] text-[#64748b] sm:text-[14px]">
            <Link href={forgotHref} className="font-medium text-[#104b83] hover:underline">
              Request a new reset link
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
