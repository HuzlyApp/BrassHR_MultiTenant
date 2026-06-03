"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { applicationPath } from "@/lib/tenant/with-tenant";

type Props = {
  tenantSlug: string | null;
};

type LookupResponse = {
  error?: string;
  applicationStatus?: string;
  statusLabel?: string;
  message?: string;
  requiresPasswordSetup?: boolean;
};

const unapprovedMessage =
  "Your application has not been approved yet. You will be able to access your applicant dashboard once your application has been approved.";

export default function ApplicantSignInCard({ tenantSlug }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<"email" | "password" | "setup">("email");
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function parseResponse(res: Response): Promise<LookupResponse> {
    return (await res.json().catch(() => ({}))) as LookupResponse;
  }

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const res = await fetch("/api/applicant-portal/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, tenantSlug }),
    });
    const payload = await parseResponse(res);
    setLoading(false);

    if (!res.ok) {
      setStatusLabel(payload.statusLabel ?? null);
      setError(payload.error || unapprovedMessage);
      return;
    }

    setStatusLabel(payload.statusLabel ?? "Approved");
    setNotice(payload.message ?? "Your application has been approved.");
    setMode(payload.requiresPasswordSetup ? "setup" : "password");
  }

  async function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Password fields do not match.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/applicant-portal/setup-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, confirmPassword, tenantSlug }),
    });
    const payload = await parseResponse(res);

    if (!res.ok) {
      setLoading(false);
      setError(payload.error || "Could not set your password.");
      return;
    }

    const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setMode("password");
      setError(signInError.message);
      return;
    }

    router.push(applicationPath("/application/applicant-dashboard", tenantSlug));
  }

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch("/api/applicant-portal/session", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    const payload = await parseResponse(res);
    setLoading(false);

    if (!res.ok) {
      await supabaseBrowser.auth.signOut();
      setError(payload.error || unapprovedMessage);
      return;
    }

    router.push(applicationPath("/application/applicant-dashboard", tenantSlug));
  }

  return (
    <section className="w-full max-w-[430px] rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-left shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
      <div className="mb-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Applicant Area
        </p>
        <h2 className="mt-1 text-[22px] font-semibold leading-7 text-slate-900">
          Sign in as an Applicant
        </h2>
        <p className="mt-2 text-[14px] leading-5 text-slate-500">
          Approved applicants can set up a password, view their application status, and message the
          tenant / recruiter.
        </p>
      </div>

      {statusLabel ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-700">
          <span className="font-semibold text-slate-900">Application Status:</span> {statusLabel}
          {statusLabel === "Approved" ? (
            <p className="mt-1 font-medium text-[#0f9f8f]">Your application has been approved.</p>
          ) : null}
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4 rounded-xl border border-[#99f6e4] bg-[#ecfeff] px-4 py-3 text-[14px] font-medium text-[#0f766e]">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {mode === "email" ? (
        <form onSubmit={handleLookup} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Registered email address"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-[var(--brand-primary)]"
          />
          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: "var(--brand-primary)" }}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl px-4 text-[16px] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Checking..." : "Sign in as Applicant"}
          </button>
        </form>
      ) : null}

      {mode === "setup" ? (
        <form onSubmit={handleSetup} className="space-y-3">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="new-password"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-[var(--brand-primary)]"
          />
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter password"
            autoComplete="new-password"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-[var(--brand-primary)]"
          />
          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: "var(--brand-primary)" }}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl px-4 text-[16px] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Saving..." : "Create password and continue"}
          </button>
        </form>
      ) : null}

      {mode === "password" ? (
        <form onSubmit={handlePasswordLogin} className="space-y-3">
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-[var(--brand-primary)]"
          />
          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: "var(--brand-primary)" }}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl px-4 text-[16px] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Signing in..." : "Sign in as Applicant"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPassword("");
              setConfirmPassword("");
              setMode("email");
            }}
            className="w-full text-center text-[13px] font-semibold text-slate-500 hover:text-slate-700"
          >
            Use a different email
          </button>
        </form>
      ) : null}
    </section>
  );
}
