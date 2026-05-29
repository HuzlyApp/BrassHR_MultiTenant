"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import {
  AddressField,
  FIELD,
  FieldLabel,
  SelectField,
  US_STATES,
} from "./account-form-fields";

type HeaderProfile = {
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  profile_photo: string | null;
  email: string | null;
};

export default function PersonalTab() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<HeaderProfile | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/header-data", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { profile?: HeaderProfile | null };
        if (active) setProfile(payload.profile ?? null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    "Mark Sutton";
  const roleLabel = profile?.role || "Account Owner";
  const firstName = profile?.first_name || "Sean";
  const lastName = profile?.last_name || "Doe";
  const workEmail = profile?.email || "seandoe@abc-company.com";

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 sm:p-6">
      <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
            {profile?.profile_photo ? (
              <Image
                src={profile.profile_photo}
                alt=""
                width={72}
                height={72}
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon className="h-8 w-8 text-[#CBD5E1]" strokeWidth={1.25} aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold text-[#012352]">
              {loading ? "Loading…" : displayName}
            </p>
            <p className="mt-0.5 text-sm text-[#64748B]">{roleLabel}</p>
          </div>
        </div>
        <span className="inline-flex h-9 shrink-0 items-center rounded-full border border-[#E2E8F0] bg-white px-4 text-sm font-normal text-[#64748B]">
          Active
        </span>
      </div>

      <section className="w-full max-w-2xl rounded-lg border border-[#E5E7EB] bg-white px-4 py-5 sm:px-6 sm:py-6">
        <h2 className="text-lg font-semibold leading-7 text-[#012352]">Basic Information</h2>

        <div className="mt-2.5 flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>First Name</FieldLabel>
              <input type="text" defaultValue={firstName} className={FIELD} />
            </label>
            <label className="block">
              <FieldLabel>Last Name</FieldLabel>
              <input type="text" defaultValue={lastName} className={FIELD} />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Work Email</FieldLabel>
              <input type="email" defaultValue={workEmail} className={FIELD} />
            </label>
            <label className="block">
              <FieldLabel>Job Title</FieldLabel>
              <input type="text" defaultValue="Owner" className={FIELD} />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-[1.15fr_1.15fr_0.85fr]">
            <SelectField label="City" defaultValue="Los Angeles">
              <option>Los Angeles</option>
              <option>San Francisco</option>
              <option>San Diego</option>
            </SelectField>
            <SelectField label="State" defaultValue="California" required>
              {US_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </SelectField>
            <label className="block">
              <FieldLabel>Zip Code</FieldLabel>
              <input type="text" defaultValue="40170" className={FIELD} />
            </label>
          </div>

          <AddressField
            label="Address"
            defaultValue="123 Maple Street, Springfield, IL 62704, USA"
          />
        </div>
      </section>
    </div>
  );
}
