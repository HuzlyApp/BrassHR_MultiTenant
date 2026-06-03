"use client";

import { useEffect, useState } from "react";
import AccountTenantHeader from "./AccountTenantHeader";
import {
  AddressField,
  CITY_OPTIONS,
  EMPLOYEE_COUNT_OPTIONS,
  INDUSTRY_OPTIONS,
  SelectField,
  TextField,
  US_STATES,
} from "./account-form-fields";

type HeaderProfile = {
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  profile_photo: string | null;
};

export default function BusinessInfoTab() {
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

  const ownerName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || "Mark Sutton";

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 sm:p-6">
      <AccountTenantHeader
        ownerName={ownerName}
        ownerRole={profile?.role || "Account Owner"}
        ownerPhoto={profile?.profile_photo}
        loading={loading}
      />

      <section className="mt-6 w-full max-w-2xl">
        <h2 className="text-lg font-semibold leading-7 text-[#012352]">Business Information</h2>
        <p className="mt-1 text-sm text-[#64748B]">Add your business info.</p>

        <div className="mt-6 flex flex-col gap-5">
          <TextField
            label="Company Name"
            defaultValue="ABC Company"
            required
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SelectField label="Industry" defaultValue="Staffing" required>
              {INDUSTRY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectField>
            <SelectField label="Number of Employees" defaultValue="10-30" required>
              {EMPLOYEE_COUNT_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SelectField label="City" defaultValue="Los Angeles" required>
              {CITY_OPTIONS.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </SelectField>
            <SelectField label="State" defaultValue="California" required>
              {US_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </SelectField>
          </div>

          <AddressField
            label="Business Address"
            defaultValue="123 Maple Street, Springfield, IL 62704, USA"
            required
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              label="Business Phone"
              defaultValue="(201) 512-2366"
              type="tel"
            />
            <TextField
              label="Business Email Address"
              defaultValue="info@abccompany.com"
              type="email"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField label="Zip Code" defaultValue="40170" required />
            <TextField label="EIN Number" defaultValue="902231829" />
          </div>
        </div>
      </section>
    </div>
  );
}
