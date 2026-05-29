"use client";

import { useEffect, useState } from "react";
import AccountTenantHeader from "./AccountTenantHeader";
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
};

const BUSINESS_TYPES = ["Staffing", "Healthcare", "Home Care", "Other"];
const EMPLOYEE_RANGES = ["1-10", "10-30", "30-50", "50-100", "100+"];

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

      <section className="w-full max-w-2xl rounded-lg border border-[#E5E7EB] bg-white px-4 py-5 sm:px-6 sm:py-6">
        <h2 className="text-lg font-semibold leading-7 text-[#012352]">Business Information</h2>

        <div className="mt-2.5 flex flex-col gap-5">
          <label className="block">
            <FieldLabel>Company Name</FieldLabel>
            <input type="text" defaultValue="ABC Company" className={FIELD} />
          </label>

          <AddressField
            label="Business Address"
            defaultValue="123 Maple Street, Springfield, IL 62704, USA"
          />

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <SelectField label="Business Type" defaultValue="Staffing">
              {BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </SelectField>
            <SelectField label="Number of Employees" defaultValue="10-30">
              {EMPLOYEE_RANGES.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <SelectField label="City" defaultValue="Los Angeles">
              <option>Los Angeles</option>
              <option>San Francisco</option>
              <option>San Diego</option>
            </SelectField>
            <SelectField label="State" defaultValue="California">
              {US_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Zip Code</FieldLabel>
              <input type="text" defaultValue="40170" className={FIELD} />
            </label>
            <label className="block">
              <FieldLabel>EIN Number</FieldLabel>
              <input type="text" defaultValue="902231829" className={FIELD} />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
