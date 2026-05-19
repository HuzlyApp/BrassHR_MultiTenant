"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

/** Next.js navigation export; useSuspense-compatible split for `useSearchParams`. */

function TenantHostNotFoundInner() {
  const params = useSearchParams();
  const attempted = params.get("subdomain")?.trim();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
      <p className="text-2xl font-semibold text-slate-900">This organization site isn’t available</p>
      {attempted ? (
        <p className="max-w-md text-sm text-slate-600">
          We couldn’t find an active tenant for{" "}
          <span className="font-mono text-slate-800">{attempted}</span>. Double-check the address or continue from your
          main site.
        </p>
      ) : (
        <p className="max-w-md text-sm text-slate-600">
          That subdomain isn’t linked to an active organization yet.
        </p>
      )}
      <Link href="/" className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">
        Main site
      </Link>
    </main>
  );
}

export default function TenantHostNotFoundPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">
          Checking organization…
        </div>
      }
    >
      <TenantHostNotFoundInner />
    </Suspense>
  );
}
