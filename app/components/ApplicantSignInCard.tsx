"use client";

import { useEffect } from "react";
import { useApplicantSignIn } from "@/lib/applicant-portal/use-applicant-sign-in";

type Props = {
  tenantSlug: string | null;
};

export default function ApplicantSignInCard({ tenantSlug }: Props) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    mode,
    error,
    loading,
    handleLookup,
    handleSetup,
    handlePasswordLogin,
    resetToEmail,
    setError,
    signInReady,
    completeSignIn,
  } = useApplicantSignIn(tenantSlug);

  useEffect(() => {
    if (signInReady) {
      completeSignIn(false);
    }
  }, [signInReady, completeSignIn]);

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

      {mode === "email" ? (
        <form onSubmit={handleLookup} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => {
              setError(null);
              setEmail(event.target.value);
            }}
            placeholder="Registered email address"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-[var(--brand-primary)]"
          />
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-700">
              {error}
            </div>
          ) : null}
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
            onChange={(event) => {
              setError(null);
              setPassword(event.target.value);
            }}
            placeholder="Password"
            autoComplete="new-password"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-[var(--brand-primary)]"
          />
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => {
              setError(null);
              setConfirmPassword(event.target.value);
            }}
            placeholder="Re-enter password"
            autoComplete="new-password"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-[var(--brand-primary)]"
          />
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-700">
              {error}
            </div>
          ) : null}
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
            onChange={(event) => {
              setError(null);
              setPassword(event.target.value);
            }}
            placeholder="Password"
            autoComplete="current-password"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-[var(--brand-primary)]"
          />
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-medium text-red-700">
              {error}
            </div>
          ) : null}
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
            onClick={resetToEmail}
            className="w-full text-center text-[13px] font-semibold text-slate-500 hover:text-slate-700"
          >
            Use a different email
          </button>
        </form>
      ) : null}
    </section>
  );
}
