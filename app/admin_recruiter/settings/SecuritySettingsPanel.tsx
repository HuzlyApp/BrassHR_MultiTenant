"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import {
  authenticatorIssuer,
  cancelAuthenticatorEnrollment,
  enrollAuthenticator,
  formatAuthenticatorSecret,
  listAuthenticatorFactors,
  removeAuthenticator,
  verifyAuthenticatorCode,
  type AuthenticatorFactor,
} from "@/lib/auth/authenticator-mfa";
import { supabaseBrowser } from "@/lib/supabase-browser";

const inputClassName =
  "h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm tracking-[0.3em] text-[#111827] outline-none focus-visible:ring-2 focus-visible:ring-[#012352]/30 disabled:bg-[#F8FAFC]";

function SettingsSectionIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-[30px]">
      <h1 className="text-sm font-semibold leading-5 text-black">{title}</h1>
      <p className="text-[10px] leading-[15px] text-[#6B7280]">{subtitle}</p>
    </div>
  );
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export default function SecuritySettingsPanel() {
  const { user, organization } = useAccountData();
  const codeId = useId();
  const pendingFactorId = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState<AuthenticatorFactor | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [confirmOff, setConfirmOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const email = user?.email ?? "";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const factors = await listAuthenticatorFactors(supabaseBrowser);
        if (cancelled) return;
        setVerified(factors.find((factor) => factor.status === "verified") ?? null);
      } catch (err) {
        if (!cancelled) setError(messageFrom(err, "Could not load your authenticator."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      const id = pendingFactorId.current;
      pendingFactorId.current = null;
      if (!id) return;
      void cancelAuthenticatorEnrollment(supabaseBrowser, id).catch(() => undefined);
    };
  }, []);

  function clearEnrollment() {
    pendingFactorId.current = null;
    setEnrolling(false);
    setFactorId(null);
    setQrSrc(null);
    setSecret(null);
    setCode("");
    setCopied(false);
  }

  async function startEnrollment() {
    setBusy(true);
    setError(null);
    setNotice(null);
    setConfirmOff(false);
    try {
      const enrolled = await enrollAuthenticator(
        supabaseBrowser,
        authenticatorIssuer(organization?.name)
      );
      pendingFactorId.current = enrolled.factorId;
      setFactorId(enrolled.factorId);
      setQrSrc(enrolled.qrSrc);
      setSecret(enrolled.secret);
      setEnrolling(true);
    } catch (err) {
      setError(messageFrom(err, "Could not start authenticator setup."));
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnrollment() {
    const id = factorId;
    setBusy(true);
    setError(null);
    try {
      if (id) await cancelAuthenticatorEnrollment(supabaseBrowser, id);
      clearEnrollment();
    } catch (err) {
      setError(messageFrom(err, "Could not cancel authenticator setup."));
    } finally {
      setBusy(false);
    }
  }

  async function enableAuthenticator(event: FormEvent) {
    event.preventDefault();
    if (!factorId || code.length !== 6) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await verifyAuthenticatorCode(supabaseBrowser, factorId, code);
      pendingFactorId.current = null;
      let enabled: AuthenticatorFactor = {
        id: factorId,
        friendlyName: "Authenticator app",
        status: "verified",
        createdAt: null,
      };
      try {
        const factors = await listAuthenticatorFactors(supabaseBrowser);
        enabled = factors.find((factor) => factor.status === "verified") ?? enabled;
      } catch {
        // The code already matched. Keep the authenticator on even if the refresh fails.
      }
      setVerified(enabled);
      clearEnrollment();
      setNotice("Authenticator app is on. Sign-in will ask for a code from the app.");
    } catch (err) {
      setError(messageFrom(err, "That code did not match. Try the code currently on screen."));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!verified) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await removeAuthenticator(supabaseBrowser, verified.id);
      setVerified(null);
      setConfirmOff(false);
      setNotice("Authenticator app is off for this account.");
    } catch (err) {
      setError(messageFrom(err, "Could not turn off the authenticator."));
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.replace(/\s+/g, ""));
      setCopied(true);
    } catch {
      setCopied(false);
      setError("Could not copy the key. Select it and copy it manually.");
    }
  }

  return (
    <section>
      <SettingsSectionIntro
        title="Security"
        subtitle="Sign-in and account protection for your organization."
      />

      <div className="max-w-[634px] rounded-xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
        <h2 className="text-sm font-semibold leading-5 text-black">Authenticator app</h2>
        <p className="mt-1 text-[13px] leading-5 text-[#6B7280]">
          Add an authenticator app for the account you are signed in with. After it is on, sign-in
          asks for a 6-digit code from that app.
        </p>
        {email ? <p className="mt-2 text-xs text-[#374151]">{email}</p> : null}

        {error ? (
          <p role="alert" className="mt-4 text-sm text-[#B91C1C]">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-4 text-sm text-[#166534]">
            {notice}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-5 h-28 rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
        ) : enrolling && qrSrc && secret ? (
          <form onSubmit={(event) => void enableAuthenticator(event)} className="mt-5 flex flex-col gap-4">
            <p className="text-[13px] leading-5 text-[#374151]">
              Scan this QR code with your authenticator app. If you can&apos;t scan it, enter the key
              instead.
            </p>
            <img
              src={qrSrc}
              alt="Authenticator QR code"
              width={180}
              height={180}
              className="h-[180px] w-[180px] rounded-lg border border-[#E5E7EB] bg-white object-contain p-2"
            />
            <div>
              <p className="text-xs font-medium text-[#374151]">Setup key</p>
              <p className="mt-1 break-all font-mono text-sm text-[#111827]">{formatAuthenticatorSecret(secret)}</p>
              <button
                type="button"
                onClick={() => void copySecret()}
                className="mt-2 text-xs font-medium text-[#012352] underline"
              >
                {copied ? "Copied" : "Copy key"}
              </button>
            </div>
            <div>
              <label htmlFor={codeId} className="mb-1.5 block text-xs font-medium text-[#374151]">
                Verification code
              </label>
              <input
                id={codeId}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                className={inputClassName}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="h-9 rounded-lg bg-[#012352] px-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Checking..." : "Enable authenticator"}
              </button>
              <button
                type="button"
                onClick={() => void cancelEnrollment()}
                disabled={busy}
                className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#374151] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : verified ? (
          <div className="mt-5">
            <p className="text-sm font-medium text-[#166534]">Authenticator app is on.</p>
            <p className="mt-1 text-[13px] leading-5 text-[#6B7280]">
              Sign-in asks for a code from {verified.friendlyName ?? "your authenticator app"}.
            </p>
            {confirmOff ? (
              <div className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3">
                <p className="text-sm text-[#7F1D1D]">
                  Turning this off removes the authenticator from this account.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void turnOff()}
                    disabled={busy}
                    className="h-9 rounded-lg bg-[#B91C1C] px-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busy ? "Turning off..." : "Turn off"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmOff(false)}
                    disabled={busy}
                    className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#374151]"
                  >
                    Keep on
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setConfirmOff(true);
                }}
                className="mt-4 h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#374151]"
              >
                Turn off authenticator
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void startEnrollment()}
            disabled={busy}
            className="mt-5 h-9 rounded-lg bg-[#012352] px-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Starting..." : "Set up authenticator"}
          </button>
        )}
      </div>
    </section>
  );
}
