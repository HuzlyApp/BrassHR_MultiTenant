"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { syncAccountChecklist } from "@/lib/account/fetch-account-data";
import { supabaseBrowser } from "@/lib/supabase-browser";
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
import {
  AccountErrorBanner,
  AccountLoadingSkeleton,
  AccountSaveButton,
  AccountSuccessBanner,
} from "./AccountFormStatus";

export default function BusinessInfoTab() {
  const { user, profile, organization, settings, checklist, loading, error, refresh } =
    useAccountData();

  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [ein, setEin] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    setCompanyName(organization.name ?? "");
    setLegalName(organization.legal_name ?? "");
    setSubdomain(organization.subdomain ?? "");
    setWebsite(organization.website ?? "");
    setIndustry(organization.industry ?? "");
    setCompanySize(organization.company_size ?? "");
    setCity(organization.city ?? "");
    setState(organization.state ?? "");
    setAddress(organization.address_line_1 ?? "");
    setBusinessPhone(organization.phone ?? "");
    setBusinessEmail(organization.email ?? "");
    setZipCode(organization.postal_code ?? "");
    setEin(organization.ein ?? "");
  }, [organization]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!organization?.id) {
      setSaveError("No organization is linked to your account yet.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const { error: updateError } = await supabaseBrowser
        .from("tenants")
        .update({
          name: companyName.trim() || organization.name,
          legal_name: legalName.trim() || null,
          subdomain: subdomain.trim() || null,
          website: website.trim() || null,
          industry: industry.trim() || null,
          company_size: companySize.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          address_line_1: address.trim() || null,
          phone: businessPhone.trim() || null,
          email: businessEmail.trim() || null,
          postal_code: zipCode.trim() || null,
          ein: ein.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organization.id);

      if (updateError) throw updateError;

      await refresh();
      await syncAccountChecklist(supabaseBrowser, {
        user,
        profile,
        organization: {
          ...organization,
          name: companyName.trim() || organization.name,
        },
        settings,
        checklist,
      });
      await refresh();
      setSaveSuccess("Business information saved.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save business information");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 sm:p-6">
        <AccountLoadingSkeleton rows={8} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-[#E5E7EB] bg-white p-5 sm:p-6">
      {error ? <AccountErrorBanner message={error} /> : null}
      {saveError ? <AccountErrorBanner message={saveError} /> : null}
      {saveSuccess ? <AccountSuccessBanner message={saveSuccess} /> : null}

      <AccountTenantHeader />

      <section className="mt-6 w-full max-w-2xl">
        <h2 className="text-lg font-semibold leading-7 text-[#012352]">Business Information</h2>
        <p className="mt-1 text-sm text-[#64748B]">Add your business info.</p>

        {!organization ? (
          <p className="mt-4 text-sm text-[#64748B]">
            Your account is not linked to an organization yet. Complete tenant onboarding to add
            business details.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-5">
            <TextField
              label="Company Name"
              value={companyName}
              onChange={setCompanyName}
              required
            />
            <TextField label="Legal Name" value={legalName} onChange={setLegalName} />
            <TextField label="Subdomain" value={subdomain} onChange={setSubdomain} />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <SelectField label="Industry" value={industry} onChange={setIndustry} required>
                <option value="">Select industry</option>
                {INDUSTRY_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Number of Employees"
                value={companySize}
                onChange={setCompanySize}
                required
              >
                <option value="">Select size</option>
                {EMPLOYEE_COUNT_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </SelectField>
            </div>

            <TextField label="Website" value={website} onChange={setWebsite} type="url" />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <SelectField label="City" value={city} onChange={setCity} required>
                <option value="">Select city</option>
                {CITY_OPTIONS.map((cityOption) => (
                  <option key={cityOption} value={cityOption}>
                    {cityOption}
                  </option>
                ))}
              </SelectField>
              <SelectField label="State" value={state} onChange={setState} required>
                <option value="">Select state</option>
                {US_STATES.map((stateOption) => (
                  <option key={stateOption} value={stateOption}>
                    {stateOption}
                  </option>
                ))}
              </SelectField>
            </div>

            <AddressField
              label="Business Address"
              value={address}
              onChange={setAddress}
              required
            />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextField
                label="Business Phone"
                value={businessPhone}
                onChange={setBusinessPhone}
                type="tel"
              />
              <TextField
                label="Business Email Address"
                value={businessEmail}
                onChange={setBusinessEmail}
                type="email"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextField label="Zip Code" value={zipCode} onChange={setZipCode} required />
              <TextField label="EIN Number" value={ein} onChange={setEin} />
            </div>

            <div className="flex justify-end">
              <AccountSaveButton saving={saving} />
            </div>
          </div>
        )}
      </section>
    </form>
  );
}
