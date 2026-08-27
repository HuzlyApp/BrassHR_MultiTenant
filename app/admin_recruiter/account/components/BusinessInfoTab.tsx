"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { syncAccountChecklist } from "@/lib/account/fetch-account-data";
import { formatPhoneNumber } from "@/lib/phone";
import type { SignupStateOption } from "@/lib/signup/owner-signup";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  isBusinessInfoValid,
  normalizeBusinessZipInput,
  normalizeEinInput,
  validateBusinessInfoForm,
  type BusinessInfoFieldErrors,
  type BusinessInfoFieldKey,
} from "@/lib/tenant/business-info-validation";
import { getStateCodeFromName, getStateNameFromCode } from "@/lib/us-state-names";
import SearchableSelectField from "@/app/tenant-onboarding/SearchableSelectField";
import AccountTenantHeader from "./AccountTenantHeader";
import {
  AddressField,
  EMPLOYEE_COUNT_OPTIONS,
  INDUSTRY_OPTIONS,
  SelectField,
  TextField,
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

  const [stateRows, setStateRows] = useState<SignupStateOption[]>([]);
  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [locationLoading, setLocationLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(false);

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
    setBusinessPhone(organization.phone ? formatPhoneNumber(organization.phone) : "");
    setBusinessEmail(organization.email ?? "");
    setZipCode(organization.postal_code ?? "");
    setEin(organization.ein ?? "");
  }, [organization]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error: statesError } = await supabaseBrowser
          .from("signup_us_states")
          .select("code, name")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });

        if (!active || statesError || !data?.length) return;

        const states = data.map((row) => ({
          code: String(row.code),
          name: String(row.name),
        }));
        setStateRows(states);
        setStateOptions(states.map((row) => row.name));
      } finally {
        if (active) setLocationLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedStateCode = useMemo(() => {
    const fromRows = stateRows.find((row) => row.name === state)?.code;
    if (fromRows) return fromRows;
    const fromName = getStateCodeFromName(state);
    if (fromName) return fromName;
    const trimmed = state.trim().toUpperCase();
    if (trimmed.length === 2 && getStateNameFromCode(trimmed)) return trimmed;
    return "";
  }, [state, stateRows]);

  useEffect(() => {
    if (!selectedStateCode || selectedStateCode.length !== 2) {
      setCityOptions([]);
      setCitiesLoading(false);
      return;
    }

    let active = true;
    setCitiesLoading(true);
    void (async () => {
      try {
        const { data, error: citiesError } = await supabaseBrowser
          .from("signup_us_cities")
          .select("city_name")
          .eq("state_code", selectedStateCode)
          .order("sort_order", { ascending: true })
          .order("city_name", { ascending: true });

        if (!active) return;
        if (citiesError) {
          setCityOptions([]);
          return;
        }

        setCityOptions((data ?? []).map((row) => String(row.city_name)));
      } catch {
        if (active) setCityOptions([]);
      } finally {
        if (active) setCitiesLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedStateCode]);

  // Normalize a stored state code (e.g. "AZ") to the full name once options load.
  useEffect(() => {
    const raw = state.trim();
    if (!raw || stateOptions.length === 0) return;
    if (stateOptions.includes(raw)) return;
    const fromCode = getStateNameFromCode(raw);
    if (fromCode && stateOptions.includes(fromCode) && fromCode !== raw) {
      setState(fromCode);
    }
  }, [state, stateOptions]);

  const effectiveCityOptions = useMemo(() => {
    const current = city.trim();
    if (!current || cityOptions.includes(current)) return cityOptions;
    return [...cityOptions, current].sort((a, b) => a.localeCompare(b));
  }, [city, cityOptions]);

  const effectiveStateOptions = useMemo(() => {
    const current = state.trim();
    if (!current) return stateOptions;
    if (stateOptions.includes(current)) return stateOptions;
    const fromCode = getStateNameFromCode(current);
    if (fromCode && stateOptions.includes(fromCode)) return stateOptions;
    return [...stateOptions, fromCode || current].sort((a, b) => a.localeCompare(b));
  }, [state, stateOptions]);

  const displayStateValue = useMemo(() => {
    const raw = state.trim();
    if (!raw) return "";
    if (stateOptions.includes(raw) || effectiveStateOptions.includes(raw)) return raw;
    const fromCode = getStateNameFromCode(raw);
    if (fromCode && (stateOptions.includes(fromCode) || effectiveStateOptions.includes(fromCode))) {
      return fromCode;
    }
    return raw;
  }, [effectiveStateOptions, state, stateOptions]);

  const stateOptionsUnavailable = !locationLoading && stateOptions.length === 0;
  const cityOptionsUnavailable =
    Boolean(displayStateValue) && !citiesLoading && effectiveCityOptions.length === 0;

  const formInput = useMemo(
    () => ({
      companyName,
      industry,
      companySize,
      state: displayStateValue || state,
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
      displayStateValue,
      ein,
      industry,
      state,
      zipCode,
    ]
  );

  const validationContext = useMemo(
    () => ({
      stateCode: selectedStateCode || undefined,
      stateName: displayStateValue || state || undefined,
      allowedStateNames: effectiveStateOptions.length > 0 ? effectiveStateOptions : stateOptions,
      allowedCityNames: effectiveCityOptions.length > 0 ? effectiveCityOptions : undefined,
    }),
    [
      displayStateValue,
      effectiveCityOptions,
      effectiveStateOptions,
      selectedStateCode,
      state,
      stateOptions,
    ]
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

  const handleStateChange = (value: string) => {
    setState(value);
    setCity("");
    if (!submitAttempted) return;
    revalidateField("state", { ...formInput, state: value, city: "" });
    revalidateField("city", { ...formInput, state: value, city: "" });
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
          state: displayStateValue || state,
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
              <SearchableSelectField
                label="State"
                required
                loading={locationLoading}
                disabled={locationLoading || stateOptionsUnavailable}
                value={displayStateValue}
                onChange={handleStateChange}
                placeholder={
                  locationLoading
                    ? "Loading…"
                    : stateOptionsUnavailable
                      ? "No states found"
                      : "Search state"
                }
                searchPlaceholder="Type to search states"
                options={effectiveStateOptions}
                error={submitAttempted ? fieldErrors.state : null}
                emptyMessage="No states found. Try another search."
              />
              <SearchableSelectField
                label="City"
                required
                disabled={!displayStateValue || stateOptionsUnavailable || cityOptionsUnavailable}
                loading={citiesLoading}
                value={city}
                onChange={(value) => updateField("city", value, setCity)}
                placeholder={
                  stateOptionsUnavailable || cityOptionsUnavailable
                    ? "No cities found"
                    : !displayStateValue
                      ? "Select state first"
                      : citiesLoading
                        ? "Loading…"
                        : "Search city"
                }
                searchPlaceholder="Type to search cities"
                options={effectiveCityOptions}
                error={submitAttempted ? fieldErrors.city : null}
                emptyMessage="No cities found. Try another search."
              />
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
                onChange={(value) => updateField("phone", formatPhoneNumber(value), setBusinessPhone)}
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
