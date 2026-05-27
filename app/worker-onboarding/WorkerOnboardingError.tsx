"use client";

import Link from "next/link";
import type { WorkerOnboardingEntryErrorCode } from "@/lib/onboarding/resolve-worker-onboarding-entry";

export default function WorkerOnboardingError({
  code,
  message,
  tenantSlug,
}: {
  code: WorkerOnboardingEntryErrorCode;
  message: string;
  tenantSlug?: string | null;
}) {
  const homeHref = tenantSlug ? `/?tenant=${encodeURIComponent(tenantSlug)}` : "/";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          {code === "NOT_PUBLISHED"
            ? "Onboarding not available"
            : code === "TENANT_NOT_FOUND"
              ? "Organization not found"
              : "Start your application"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        <Link
          href={homeHref}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Back to welcome page
        </Link>
      </div>
    </main>
  );
}
