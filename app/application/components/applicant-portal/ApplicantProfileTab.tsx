"use client";

import { FormEvent, useEffect, useState } from "react";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import {
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SECTION_TITLE_CLASS,
  WORKER_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";

type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  jobRole: string;
  displayName: string;
};

type FieldErrors = Partial<Record<keyof Profile, string>>;

const EMPTY_PROFILE: Profile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  jobRole: "",
  displayName: "",
};

function Field({
  label,
  value,
  onChange,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 w-full rounded-lg border px-3 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)] ${
          error ? "border-red-300" : "border-[#D1D5DB]"
        }`}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function ApplicantProfileTab() {
  const { sessionReady, authHeaders } = useApplicantPortal();
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!sessionReady) return;

    let alive = true;
    setLoading(true);

    void (async () => {
      try {
        const headers = await authHeaders();
        if (!headers) return;
        const res = await fetch("/api/applicant-portal/profile", { headers, cache: "no-store" });
        const payload = (await res.json().catch(() => ({}))) as { profile?: Profile; error?: string };
        if (!res.ok) throw new Error(payload.error || "Could not load profile.");
        if (!alive) return;
        setProfile(payload.profile ?? EMPTY_PROFILE);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load profile.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authHeaders, sessionReady]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    setFieldErrors({});
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch("/api/applicant-portal/profile", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        profile?: Profile;
        error?: string;
        fieldErrors?: FieldErrors;
      };
      if (!res.ok) {
        if (payload.fieldErrors) setFieldErrors(payload.fieldErrors);
        throw new Error(payload.error || "Could not save profile.");
      }
      setProfile(payload.profile ?? profile);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!sessionReady || loading) {
    return <DashboardPageLoader label="Loading profile..." className="min-h-[360px]" />;
  }

  return (
    <div className="px-8 py-6">
      <div className={`${WORKER_SCHEDULE_CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
            My Profile
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">Update your contact and address information.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}
          {saved ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Profile saved successfully.
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="First name"
              value={profile.firstName}
              onChange={(value) => setProfile((current) => ({ ...current, firstName: value }))}
              required
              error={fieldErrors.firstName}
            />
            <Field
              label="Last name"
              value={profile.lastName}
              onChange={(value) => setProfile((current) => ({ ...current, lastName: value }))}
              required
              error={fieldErrors.lastName}
            />
            <Field
              label="Email"
              value={profile.email}
              onChange={(value) => setProfile((current) => ({ ...current, email: value }))}
              required
              error={fieldErrors.email}
            />
            <Field
              label="Phone"
              value={profile.phone}
              onChange={(value) => setProfile((current) => ({ ...current, phone: value }))}
              required
              error={fieldErrors.phone}
            />
            <div className="md:col-span-2">
              <Field
                label="Street address"
                value={profile.address1}
                onChange={(value) => setProfile((current) => ({ ...current, address1: value }))}
                required
                error={fieldErrors.address1}
              />
            </div>
            <div className="md:col-span-2">
              <Field
                label="Address line 2"
                value={profile.address2}
                onChange={(value) => setProfile((current) => ({ ...current, address2: value }))}
                error={fieldErrors.address2}
              />
            </div>
            <Field
              label="City"
              value={profile.city}
              onChange={(value) => setProfile((current) => ({ ...current, city: value }))}
              required
              error={fieldErrors.city}
            />
            <Field
              label="State"
              value={profile.state}
              onChange={(value) => setProfile((current) => ({ ...current, state: value }))}
              required
              error={fieldErrors.state}
            />
            <Field
              label="ZIP code"
              value={profile.zip}
              onChange={(value) => setProfile((current) => ({ ...current, zip: value }))}
              required
              error={fieldErrors.zip}
            />
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Role</label>
              <input
                value={profile.jobRole || "Applicant"}
                disabled
                className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 text-sm text-[#64748B]"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
