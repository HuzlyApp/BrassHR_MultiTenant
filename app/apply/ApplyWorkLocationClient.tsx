"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import SearchableSelectField from "@/app/tenant-onboarding/SearchableSelectField";
import { useUsLocationOptions } from "@/lib/location/use-us-location-options";
import { writeStoredApplyLocation } from "@/lib/service-area/apply-location-client";
import { useServiceAreaPreview } from "@/lib/service-area/use-service-area-preview";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";

type RelocateChoice = "onsite" | "relocate" | "remote";

type Props = {
  tenantSlug: string;
  jobToken: string;
  jobTitle: string;
  jobCity: string;
  continueHref: string;
};

const inputClass =
  "mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]";

const radioClass =
  "h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--brand-checkbox,var(--brand-primary))]";

export default function ApplyWorkLocationClient({
  tenantSlug,
  jobToken,
  jobTitle,
  jobCity,
  continueHref,
}: Props) {
  const router = useRouter();
  const branding = useTenantBranding();
  const [city, setCity] = useState("");
  const [stateLabel, setStateLabel] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [relocate, setRelocate] = useState<RelocateChoice | "">("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSent, setWaitlistSent] = useState(false);

  const {
    stateOptions,
    cityOptions,
    locationLoading,
    citiesLoading,
    selectedStateCode,
    displayStateValue,
  } = useUsLocationOptions(stateLabel);

  const effectiveCityOptions = useMemo(() => {
    const current = city.trim();
    if (!current || cityOptions.includes(current)) return cityOptions;
    return [...cityOptions, current].sort((a, b) => a.localeCompare(b));
  }, [city, cityOptions]);

  useEffect(() => {
    const current = city.trim();
    if (!current || cityOptions.length === 0) return;
    if (cityOptions.includes(current)) return;
    const match = cityOptions.find(
      (option) => option.toLowerCase() === current.toLowerCase()
    );
    if (match) setCity(match);
  }, [city, cityOptions]);

  const location = useMemo(
    () =>
      city.trim() && selectedStateCode && relocate
        ? {
            city: city.trim(),
            state: selectedStateCode,
            postalCode: postalCode.trim() || undefined,
            locationType: relocate === "remote" ? ("remote" as const) : ("onsite" as const),
            relocateToJobSite: relocate === "relocate" || relocate === "onsite",
          }
        : null,
    [city, selectedStateCode, postalCode, relocate]
  );

  const preview = useServiceAreaPreview(location, "apply", {
    jobToken,
    tenantSlug,
    publicClient: true,
  });

  const submitDisabled =
    !city.trim() || !selectedStateCode || !relocate || preview.loading || !preview.allowed;

  const shellStyle = useMemo(
    () =>
      ({
        ...brandingToCssVars(branding),
        fontFamily: "var(--brand-font-body)",
      }) as CSSProperties,
    [branding]
  );

  function handleStateChange(value: string) {
    setStateLabel(value);
    setCity("");
  }

  async function onContinue() {
    if (submitDisabled || !location) return;
    writeStoredApplyLocation(tenantSlug, jobToken, location);
    router.push(continueHref);
  }

  async function onWaitlist() {
    const email = waitlistEmail.trim();
    if (!email || !selectedStateCode) return;
    await fetch("/api/service-area/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        city: city.trim(),
        state: selectedStateCode,
        source: "apply",
        tenantSlug,
        jobToken,
      }),
    }).catch(() => null);
    setWaitlistSent(true);
  }

  return (
    <main className="min-h-screen bg-white px-5 py-8 sm:px-8 sm:py-10" style={shellStyle}>
      <section className="mx-auto w-full max-w-lg">
        <p
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: "var(--brand-muted)", fontFamily: "var(--brand-font-body)" }}
        >
          Apply
        </p>
        <h1
          className="mt-2 text-xl font-semibold sm:text-2xl"
          style={{ color: "var(--brand-heading)", fontFamily: "var(--brand-font-heading)" }}
        >
          {jobTitle}
        </h1>
        <p className="mt-2 text-sm text-slate-600" style={{ fontFamily: "var(--brand-font-body)" }}>
          Confirm where you will work this job. Home address, school, and travel city are not used.
        </p>

        <div className="mt-6 space-y-4">
          <SearchableSelectField
            label="Work state"
            required
            compact
            loading={locationLoading}
            disabled={locationLoading}
            value={displayStateValue}
            onChange={handleStateChange}
            placeholder="Search state"
            searchPlaceholder="Type to search states"
            options={stateOptions}
            emptyMessage="No states found. Try another search."
          />

          <SearchableSelectField
            label="Work city"
            required
            compact
            loading={citiesLoading}
            disabled={!displayStateValue || citiesLoading || (!cityOptions.length && !city.trim())}
            value={city}
            onChange={setCity}
            placeholder={
              !displayStateValue
                ? "Select state first"
                : citiesLoading
                  ? "Loading…"
                  : "Search city"
            }
            searchPlaceholder="Type to search cities"
            options={effectiveCityOptions}
            emptyMessage="No cities found. Try another search."
          />

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#0f172a]" htmlFor="work-zip">
              ZIP (optional)
            </label>
            <input
              id="work-zip"
              inputMode="numeric"
              autoComplete="postal-code"
              className={inputClass}
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="Code"
            />
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-slate-800">
            Will you work on-site{jobCity ? ` at ${jobCity}` : ""}?
          </legend>
          {(
            [
              { value: "onsite", label: "Yes" },
              { value: "relocate", label: "Yes, I will relocate" },
              { value: "remote", label: "No, I would work remote from the location above" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className="mt-2.5 flex cursor-pointer items-center gap-2.5 text-sm text-slate-700"
            >
              <input
                type="radio"
                name="relocate"
                className={radioClass}
                checked={relocate === option.value}
                onChange={() => setRelocate(option.value)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        {preview.message ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {preview.message}
          </p>
        ) : null}

        <button
          type="button"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary)" }}
          disabled={submitDisabled}
          onClick={() => void onContinue()}
        >
          {preview.loading ? "Checking…" : "Continue"}
        </button>

        {preview.message ? (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-600">Email me if this location opens.</p>
            <div className="mt-2 flex gap-2">
              <input
                type="email"
                className={inputClass}
                placeholder="Email"
                value={waitlistEmail}
                onChange={(event) => setWaitlistEmail(event.target.value)}
              />
              <button
                type="button"
                className="h-11 shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-[color:var(--brand-primary)] hover:text-[color:var(--brand-primary)]"
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
