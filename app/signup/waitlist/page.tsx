"use client";

import { useState } from "react";
import { SERVICE_AREA_COPY } from "@/lib/service-area/copy";
import { US_STATE_NAME_TO_CODE } from "@/lib/us-state-names";

export default function SignupWaitlistPage() {
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function updateLocation() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/signup/primary-location", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, state }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      allowed?: boolean;
      error?: string;
    };
    setSaving(false);
    if (!res.ok) {
      setMessage(payload.error || SERVICE_AREA_COPY.signup_waitlist);
      return;
    }
    if (payload.allowed) {
      window.location.assign("/your-trial");
      return;
    }
    setMessage(SERVICE_AREA_COPY.signup_waitlist);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Thanks for signing up</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{SERVICE_AREA_COPY.signup_waitlist}</p>
        <label className="mt-6 block text-sm font-medium text-slate-700">Primary work city</label>
        <input
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />
        <label className="mt-4 block text-sm font-medium text-slate-700">Primary work state</label>
        <select
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          value={state}
          onChange={(event) => setState(event.target.value)}
        >
          <option value="">Select state</option>
          {Object.entries(US_STATE_NAME_TO_CODE).map(([name, code]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50"
            disabled={saving || !city || !state}
            onClick={() => void updateLocation()}
          >
            Update location
          </button>
          <a href="/" className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm">
            Done
          </a>
        </div>
      </section>
    </main>
  );
}
