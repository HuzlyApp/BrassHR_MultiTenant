"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { syncAccountChecklist } from "@/lib/account/fetch-account-data";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  isBusinessInfoValid,
  normalizeBusinessZipInput,
  normalizeEinInput,
  validateBusinessInfoForm,
  type BusinessInfoFieldErrors,
  type BusinessInfoFieldKey,
} from "@/lib/tenant/business-info-validation";
import AccountTenantHeader from "./AccountTenantHeader";
import { getStateCodeFromName } from "@/lib/us-state-names";
import {
  AddressField,
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
  const [fieldErrors, setFieldErrors] = useState<BusinessInfoFieldErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

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

  const formInput = useMemo(
    () => ({
      companyName,
      industry,
      companySize,
      state,
      city,
      address,
      phone: businessPhone,
      email: businessEmail,
      zipCode,
      ein,
    }),
    [
      address,
      businessEmail,
      businessPhone,
      city,
      companyName,
      companySize,
      ein,
      industry,
      state,
      zipCode,
    ]
  );

  const validationContext = useMemo(
    () => ({
      stateCode: getStateCodeFromName(state),
      allowedStateNames: [...US_STATES],
    }),
    [state]
  );

  const revalidateField = (field: BusinessInfoFieldKey, nextInput = formInput) => {
    const nextErrors = validateBusinessInfoForm(nextInput, validationContext);
    setFieldErrors((prev) => ({
      ...prev,
      [field]: nextErrors[field] ?? undefined,
    }));
  };

  const updateField = <K extends keyof typeof formInput>(
    field: K,
    value: (typeof formInput)[K],
    setter: (value: (typeof formInput)[K]) => void
  ) => {
    setter(value);
    if (!submitAttempted) return;
    revalidateField(field as BusinessInfoFieldKey, { ...formInput, [field]: value });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!organization?.id) {
      setSaveError("No organization is linked to your account yet.");
      return;
    }

    setSubmitAttempted(true);
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    const errors = validateBusinessInfoForm(formInput, validationContext);
    setFieldErrors(errors);
    if (!isBusinessInfoValid(formInput, validationContext)) {
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/business-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          industry,
          companySize,
          city,
          state,
          address,
          phone: businessPhone,
          email: businessEmail,
          zipCode,
          ein,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        errors?: BusinessInfoFieldErrors;
      };

      if (!res.ok) {
        if (payload.errors) setFieldErrors(payload.errors);
        throw new Error(payload.error ?? "Failed to save business information");
      }

      if (legalName.trim() || subdomain.trim() || website.trim()) {
        await supabaseBrowser
          .from("tenants")
          .update({
            legal_name: legalName.trim() || null,
            subdomain: subdomain.trim() || null,
            website: website.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", organization.id);
      }

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
              onChange={(value) => updateField("companyName", value, setCompanyName)}
              required
              error={submitAttempted ? fieldErrors.companyName : null}
            />
            <TextField label="Legal Name" value={legalName} onChange={setLegalName} />
            <TextField label="Subdomain" value={subdomain} onChange={setSubdomain} />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <SelectField
                label="Industry"
                value={industry}
                onChange={(value) => updateField("industry", value, setIndustry)}
                required
                error={submitAttempted ? fieldErrors.industry : null}
              >
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
                onChange={(value) => updateField("companySize", value, setCompanySize)}
                required
                error={submitAttempted ? fieldErrors.companySize : null}
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
              <SelectField
                label="City"
                value={city}
                onChange={(value) => updateField("city", value, setCity)}
                required
                error={submitAttempted ? fieldErrors.city : null}
              >
                <option value="">Select city</option>
                {["Los Angeles", "San Francisco", "San Diego", "Phoenix", "Houston", "Chicago", "New York", "Miami"].map((cityOption) => (
                  <option key={cityOption} value={cityOption}>
                    {cityOption}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="State"
                value={state}
                onChange={(value) => updateField("state", value, setState)}
                required
                error={submitAttempted ? fieldErrors.state : null}
              >
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
              onChange={(value) => updateField("address", value, setAddress)}
              required
              error={submitAttempted ? fieldErrors.address : null}
            />

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextField
                label="Business Phone"
                value={businessPhone}
                onChange={(value) => updateField("phone", value, setBusinessPhone)}
                type="tel"
                required
                error={submitAttempted ? fieldErrors.phone : null}
              />
              <TextField
                label="Business Email Address"
                value={businessEmail}
                onChange={(value) => updateField("email", value, setBusinessEmail)}
                type="email"
                required
                error={submitAttempted ? fieldErrors.email : null}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextField
                label="Zip Code"
                value={zipCode}
                onChange={(value) =>
                  updateField(
                    "zipCode",
                    normalizeBusinessZipInput(value).slice(0, 5),
                    setZipCode
                  )
                }
                required
                error={submitAttempted ? fieldErrors.zipCode : null}
              />
              <TextField
                label="EIN Number"
                value={ein}
                onChange={(value) => updateField("ein", normalizeEinInput(value), setEin)}
                error={submitAttempted ? fieldErrors.ein : null}
              />
            </div>

            <div className="flex justify-end">
              <AccountSaveButton saving={saving} disabled={saving} />
            </div>
          </div>
        )}
      </section>
    </form>
  );
}
