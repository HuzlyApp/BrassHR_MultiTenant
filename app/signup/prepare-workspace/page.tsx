"use client";

import { useEffect, useRef, useState } from "react";
import { ADMIN_LAUNCH_PAD_ROUTE, OWNER_WORKSPACE_PREPARATION_ROUTE } from "@/lib/signup/smb-post-signup";

/** Recover unfinished signups and old continuation links without the retired wizard. */
export default function PrepareWorkspacePage() {
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/auth/signup/provision-smb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (res.status === 401) {
          window.location.replace(
            "/admin?next=" + encodeURIComponent(OWNER_WORKSPACE_PREPARATION_ROUTE)
          );
          return;
        }
        const payload = await res.json() as { error?: string; code?: string };
        if (res.status === 403 && payload.code === "WAITLIST_PENDING") {
          window.location.replace("/signup/waitlist");
          return;
        }
        if (!res.ok) throw new Error(payload.error ?? "Could not prepare your workspace.");
        window.location.replace(ADMIN_LAUNCH_PAD_ROUTE);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not prepare your workspace.");
      }
    })();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F4F4F4] p-8 text-[#012352]">
      <h1 className="text-xl font-semibold">Preparing your Launch Pad</h1>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button type="button" className="rounded bg-[#012352] px-4 py-2 text-white" onClick={() => window.location.reload()}>
            Try again
          </button>
        </>
      ) : <p role="status">Your workspace will be ready shortly.</p>}
    </main>
  );
}
