"use client";

import { useEffect } from "react";

/** Full navigation avoids RSC payload errors after server-side tenant validation. */
export default function WorkerOnboardingRedirect({ url }: { url: string }) {
  useEffect(() => {
    window.location.assign(url);
  }, [url]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <p className="text-sm text-slate-600">Starting your application…</p>
    </main>
  );
}
