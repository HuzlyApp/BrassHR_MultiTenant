"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import SearchableSelectField from "@/app/tenant-onboarding/SearchableSelectField";
import { SERVICE_AREA_COPY } from "@/lib/service-area/copy";
import {
  BRAAS_PRIMARY,
  BRAAS_SECONDARY,
} from "@/lib/tenant/tenant-branding";
import { getStateCodeFromName, US_STATE_NAME_TO_CODE } from "@/lib/us-state-names";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" } as const;

const FIELD_INPUT_CLASS =
  "h-12 w-full rounded-lg border bg-white px-3.5 text-sm font-normal leading-6 text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--waitlist-primary)_22%,transparent)] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:opacity-70";

export default function SignupWaitlistPage() {
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const stateOptions = useMemo(
    () => Object.keys(US_STATE_NAME_TO_CODE).sort((a, b) => a.localeCompare(b)),
    []
  );

  const brandVars = {
    "--waitlist-primary": BRAAS_PRIMARY,
    "--waitlist-secondary": BRAAS_SECONDARY,
  } as CSSProperties;

  async function updateLocation() {
    setSaving(true);
    setMessage(null);
    const stateCode =
      getStateCodeFromName(stateName) ||
      (stateName.trim().length === 2 ? stateName.trim().toUpperCase() : "");
    const res = await fetch("/api/signup/primary-location", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: city.trim(), state: stateCode || stateName.trim() }),
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

  const canUpdate = Boolean(city.trim() && stateName.trim()) && !saving;

  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{
        ...brandVars,
        ...interStyle,
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--waitlist-secondary) 6%, white) 0%, #F8FAFC 45%, #FFFFFF 100%)",
      }}
    >
      <section className="w-full max-w-[480px] rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-[0_12px_40px_rgba(16,75,131,0.08)] outline-none ring-0">
        <Image
          src="/icons/braas-HR/BrassHR-logo.svg"
          alt="BrassHR"
          width={140}
          height={56}
          priority
          className="mx-auto h-12 w-auto object-contain"
        />

        <h1
          className="mt-7 text-center text-[24px] font-semibold leading-8 tracking-normal text-[#0F172A]"
          style={{ fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif" }}
        >
          Thanks for signing up
        </h1>
        <p className="mt-3 text-center text-sm leading-6 text-[#64748B]">
          {SERVICE_AREA_COPY.signup_waitlist}
        </p>
        <p className="mt-2 text-center text-sm leading-6 text-[#64748B]">
          If your primary work location changes, update it below and we&apos;ll check availability
          again.
        </p>

        <div className="mt-7 space-y-5">
          <SearchableSelectField
            label="Primary work state"
            value={stateName}
            onChange={(value) => {
              setStateName(value);
              setCity("");
            }}
            options={stateOptions}
            placeholder="Search state"
            searchPlaceholder="Type to search states"
            emptyMessage="No states found. Try another search."
            compact
          />

          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-[#0F172A]"
              htmlFor="waitlist-work-city"
            >
              Primary work city
            </label>
            <input
              id="waitlist-work-city"
              className={FIELD_INPUT_CLASS}
              style={{
                borderColor: BRAAS_PRIMARY,
              }}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="City"
              autoComplete="address-level2"
              disabled={!stateName.trim()}
            />
          </div>
        </div>

        {message ? (
          <p
            className="mt-4 rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-3.5 py-3 text-sm leading-5 text-[#BE123C]"
            role="status"
          >
            {message}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
            style={canUpdate ? { backgroundColor: BRAAS_PRIMARY } : undefined}
            disabled={!canUpdate}
            onClick={() => void updateLocation()}
          >
            {saving ? "Updating…" : "Update location"}
          </button>
          <Link
            href="/"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white px-5 text-sm font-medium text-[#334155] no-underline transition hover:bg-[#F8FAFC]"
          >
            Done
          </Link>
        </div>
      </section>
    </main>
  );
}
