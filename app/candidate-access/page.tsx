"use client";

import { FormEvent, useEffect, useState } from "react";

export default function CandidateAccessPage() {
  const [link, setLink] = useState<{ tokenHash: string; type: string; tenant: string; setup: boolean } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    setLink({ tokenHash: fragment.get("token_hash") || "", type: fragment.get("type") || "email", setup: fragment.get("setup") === "1",
      tenant: new URLSearchParams(window.location.search).get("tenant") || "" });
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!link?.tokenHash || !link.tenant) { setError("This access link is incomplete. Open the newest email link."); return; }
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/applicant-portal/access", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...link, ...(password ? { password } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not open your portal.");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      window.location.assign(result.redirectTo);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not open your portal."); setLoading(false); }
  }
  const signup = link?.type === "invite" || link?.setup;
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
    <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">{signup ? "Set up your applicant portal" : "Open your applicant portal"}</h1>
      <p className="text-sm text-slate-600">View your applications and track their progress.</p>
      {signup && <>
        <label className="block text-sm">Password<input className="mt-2 w-full rounded-lg border p-3" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="block text-sm">Confirm password<input className="mt-2 w-full rounded-lg border p-3" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>
      </>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={!link || loading} className="w-full rounded-lg bg-teal-600 p-3 font-semibold text-white disabled:opacity-50">{loading ? "Opening portal…" : signup ? "Create password and continue" : "Sign in"}</button>
    </form>
  </main>;
}
