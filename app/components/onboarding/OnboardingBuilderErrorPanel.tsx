"use client";

import { AlertTriangle, RefreshCw, LogIn } from "lucide-react";
import Link from "next/link";

type BuilderErrorKind = "load" | "save" | "auth" | "tenant";

type ResolvedBuilderError = {
  kind: BuilderErrorKind;
  title: string;
  detail: string;
  signInHref?: string;
};

export function resolveBuilderErrorMessage(message: string): ResolvedBuilderError {
  const text = message.trim();
  const lower = text.toLowerCase();

  if (/staff role required/.test(lower)) {
    return {
      kind: "auth",
      title: "Sign in required",
      detail:
        "Sign in as a recruiter or admin to edit this workflow. If you opened a preview, sign in again.",
      signInHref: "/signin?role=admin_recruiter",
    };
  }

  if (/tenant/.test(lower) && /select|linked|required/.test(lower)) {
    return {
      kind: "tenant",
      title: "Pick a company",
      detail: text,
    };
  }

  if (
    /database|internet|fetch failed|connect timeout|reach the database|try again in a moment/.test(
      lower
    )
  ) {
    return {
      kind: "load",
      title: "Connection problem",
      detail:
        "We could not reach the server. Check your internet, then try again.",
    };
  }

  if (/unexpected error|could not load/.test(lower)) {
    return {
      kind: "load",
      title: "Could not load workflow",
      detail: "Something went wrong. Please try again.",
    };
  }

  if (/save failed|publish/.test(lower)) {
    return {
      kind: "save",
      title: "Could not save",
      detail: text,
    };
  }

  return {
    kind: "load",
    title: "Something went wrong",
    detail: text || "Please try again.",
  };
}

type OnboardingBuilderErrorPanelProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function OnboardingBuilderErrorPanel({
  message,
  onRetry,
  retryLabel = "Try again",
}: OnboardingBuilderErrorPanelProps) {
  const resolved = resolveBuilderErrorMessage(message);

  return (
    <div className="flex flex-1 items-center justify-center p-6 md:p-10">
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-[0_12px_40px_rgba(15,23,42,0.08)]"
        role="alert"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <AlertTriangle className="h-7 w-7" aria-hidden />
        </div>

        <h2 className="text-xl font-semibold text-slate-900">{resolved.title}</h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">{resolved.detail}</p>

        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-base font-semibold text-white transition hover:bg-slate-800"
            >
              <RefreshCw className="h-5 w-5" aria-hidden />
              {retryLabel}
            </button>
          ) : null}

          {resolved.signInHref ? (
            <Link
              href={resolved.signInHref}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-6 text-base font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              <LogIn className="h-5 w-5" aria-hidden />
              Sign in
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type OnboardingBuilderSaveErrorBannerProps = {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
};

export function OnboardingBuilderSaveErrorBanner({
  message,
  onRetry,
  onDismiss,
}: OnboardingBuilderSaveErrorBannerProps) {
  const resolved = resolveBuilderErrorMessage(message);

  return (
    <div
      className="mx-4 mb-3 mt-2 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-red-950 md:mx-5"
      role="alert"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-left">
          <p className="text-base font-semibold">{resolved.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-red-900/90">{resolved.detail}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-red-700 px-5 text-sm font-semibold text-white hover:bg-red-800"
            >
              Try again
            </button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-red-300 bg-white px-5 text-sm font-semibold text-red-900 hover:bg-red-100/50"
            >
              Dismiss
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
