"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { writeStoredApplyLocation } from "@/lib/service-area/apply-location-client";
import { useServiceAreaPreview } from "@/lib/service-area/use-service-area-preview";
import { US_STATE_NAME_TO_CODE } from "@/lib/us-state-names";

type RelocateChoice = "onsite" | "relocate" | "remote";

type Props = {
  tenantSlug: string;
  jobToken: string;
  jobTitle: string;
  jobCity: string;
  continueHref: string;
};

export default function ApplyWorkLocationClient({
  tenantSlug,
  jobToken,
  jobTitle,
  jobCity,
  continueHref,
}: Props) {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [relocate, setRelocate] = useState<RelocateChoice | "">("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSent, setWaitlistSent] = useState(false);

  const location = useMemo(
    () =>
      city && state && relocate
        ? {
            city,
            state,
            postalCode,
            locationType: relocate === "remote" ? ("remote" as const) : ("onsite" as const),
            relocateToJobSite: relocate === "relocate",
          }
        : null,
    [city, state, postalCode, relocate]
  );

  const preview = useServiceAreaPreview(location, "apply", {
    jobToken,
    tenantSlug,
    publicClient: true,
  });

  const submitDisabled = !city || !state || !relocate || preview.loading || !preview.allowed;

  async function onContinue() {
    if (submitDisabled || !location) return;
    writeStoredApplyLocation(tenantSlug, jobToken, location);
    router.push(continueHref);
  }

  async function onWaitlist() {
    const email = waitlistEmail.trim();
    if (!email) return;
    await fetch("/api/service-area/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        city,
        state,
        source: "apply",
        tenantSlug,
        jobToken,
      }),
    }).catch(() => null);
    setWaitlistSent(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
      <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Apply</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{jobTitle}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Confirm where you will work this job. Home address, school, and travel city are not used.
        </p>

        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="work-city">
          Work city
        </label>
        <input
          id="work-city"
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="work-state">
          Work state
        </label>
        <select
          id="work-state"
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

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="work-zip">
          ZIP (optional)
        </label>
        <input
          id="work-zip"
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          value={postalCode}
          onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, "").slice(0, 5))}
        />

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-slate-700">
            Will you work on-site{jobCity ? ` at ${jobCity}` : ""}?
          </legend>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="relocate"
              checked={relocate === "onsite"}
              onChange={() => setRelocate("onsite")}
            />
            Yes
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="relocate"
              checked={relocate === "relocate"}
              onChange={() => setRelocate("relocate")}
            />
            Yes, I will relocate
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="relocate"
              checked={relocate === "remote"}
              onChange={() => setRelocate("remote")}
            />
            No, I would work remote from the location above
          </label>
        </fieldset>

        {preview.message ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {preview.message}
          </p>
        ) : null}

        <button
          type="button"
          className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={submitDisabled}
          onClick={() => void onContinue()}
        >
          Continue
        </button>

        {preview.message ? (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-600">Email me if this location opens.</p>
            <div className="mt-2 flex gap-2">
              <input
                type="email"
                className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
                placeholder="Email"
                value={waitlistEmail}
                onChange={(event) => setWaitlistEmail(event.target.value)}
              />
              <button
                type="button"
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
                onClick={() => void onWaitlist()}
              >
                Notify me
              </button>
            </div>
            {waitlistSent ? (
              <p className="mt-2 text-xs text-slate-500">We’ll email you if this location opens.</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}


