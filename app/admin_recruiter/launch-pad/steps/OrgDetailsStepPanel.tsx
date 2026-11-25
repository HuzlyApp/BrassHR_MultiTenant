"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import toast from "react-hot-toast";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import SettingsSelect from "@/app/admin_recruiter/settings/SettingsSelect";
import AddressAutocompleteField from "@/app/components/signup/AddressAutocompleteField";
import SearchableSelectField from "@/app/tenant-onboarding/SearchableSelectField";
import {
  EMPLOYEE_COUNT_OPTIONS,
  INDUSTRY_OPTIONS,
} from "@/app/admin_recruiter/account/components/account-form-fields";
import { industryLabelForKey } from "@/lib/ai-catalog/industry-catalog";
import type { AddressSuggestion } from "@/lib/mapbox/address-validation-types";
import { useAddressAutocomplete } from "@/lib/mapbox/use-address-autocomplete";
import { normalizeBusinessZipInput } from "@/lib/tenant/business-info-validation";
import { getStateNameFromCode } from "@/lib/us-state-names";
import { interStyle } from "../constants";
import { LaunchPadStepActions } from "../LaunchPadStepHeader";

const EMPLOYEE_OPTIONS = EMPLOYEE_COUNT_OPTIONS.map((size) => ({ value: size, label: size }));
const COUNTRY_OPTIONS = [
  { value: "United States", label: "United States" },
  { value: "Canada", label: "Canada" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Other", label: "Other" },
];

function countryFromPlaceName(placeName: string): string {
  const tail = placeName.split(",").map((part) => part.trim()).filter(Boolean).at(-1) ?? "";
  if (!tail) return "";
  const match = COUNTRY_OPTIONS.find(
    (option) =>
      option.value.toLowerCase() === tail.toLowerCase() ||
      (option.value === "United States" &&
        (tail === "USA" || tail === "US" || tail.toLowerCase() === "united states of america")) ||
      (option.value === "United Kingdom" && (tail === "UK" || tail === "GB"))
  );
  return match?.value ?? (tail ? "Other" : "");
}

const launchPadSelectVars = {
  "--brand-primary": "#012352",
  "--brand-secondary": "#012352",
} as CSSProperties;

const LAUNCH_PAD_NAVY = "#012352";
const fieldClass =
  "h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[14px] text-[#0F172A] outline-none focus:border-[#012352]";
const selectTriggerClass =
  "h-9 w-full justify-between rounded-lg border border-[#E5E7EB] bg-white px-3 pr-3 text-[14px] text-black hover:bg-white focus-visible:border-[#012352] focus-visible:outline-none";

function SectionBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#012352] text-[13px] font-semibold leading-none text-white">
      {n}
    </span>
  );
}

function FieldLabel({
  children,
  optional,
}: {
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <span className="text-[12px] font-normal leading-4 text-black" style={interStyle}>
        {children}
      </span>
      {optional ? (
        <span className="text-[11px] text-[#9CA3AF]" style={interStyle}>
          Optional
        </span>
      ) : null}
    </div>
  );
}

export function OrgDetailsStepPanel({
  onBack,
  onSkip,
  onComplete,
}: {
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const { organization, refresh } = useAccountData();
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("United States");
  const [ein, setEin] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addressAutocomplete = useAddressAutocomplete(address, {
    city,
    state,
    zipCode: postalCode,
  });

  const handleSelectAddressSuggestion = (suggestion: AddressSuggestion) => {
    const components = addressAutocomplete.selectSuggestion(suggestion);
    const stateName = components.state
      ? getStateNameFromCode(components.state) ?? components.state
      : "";
    if (components.address1) setAddress(components.address1);
    if (components.city) setCity(components.city);
    if (stateName) setState(stateName);
    if (components.zipCode) {
      setPostalCode(normalizeBusinessZipInput(components.zipCode).slice(0, 10));
    }
    const nextCountry = countryFromPlaceName(suggestion.placeName);
    if (nextCountry) setCountry(nextCountry);
  };

  useEffect(() => {
    setLegalName(organization?.legal_name ?? "");
    setTradeName(organization?.name ?? "");
    setAddress(organization?.address_line_1 ?? "");
    setCity(organization?.city ?? "");
    setState(organization?.state ?? "");
    setPostalCode(organization?.postal_code ?? "");
    setCountry(organization?.country?.trim() || "United States");
    setEin(organization?.ein ?? "");
    setCompanySize(organization?.company_size ?? "");
    if (organization?.industry?.trim()) {
      setIndustries((current) =>
        current.length > 0 ? current : [organization.industry!.trim()]
      );
    }
  }, [
    organization?.id,
    organization?.legal_name,
    organization?.name,
    organization?.address_line_1,
    organization?.city,
    organization?.state,
    organization?.postal_code,
    organization?.country,
    organization?.ein,
    organization?.company_size,
    organization?.industry,
  ]);

  useEffect(() => {
    if (!organization?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/tenant-industries", { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as {
          selectedIndustryKeys?: string[];
          catalog?: Array<{ key: string; label: string }>;
        };
        if (!response.ok || cancelled) return;
        const catalog = new Map((data.catalog ?? []).map((row) => [row.key, row.label]));
        const labels = (data.selectedIndustryKeys ?? [])
          .map((key) => catalog.get(key) || industryLabelForKey(key) || key)
          .filter(Boolean);
        if (labels.length > 0) setIndustries(labels);
      } catch {
        // Keep organization.industry fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

  const handleContinue = async () => {
    const trimmedLegalName = legalName.trim();
    const trimmedAddress = address.trim();
    const trimmedEin = ein.trim();
    if (!trimmedLegalName || !trimmedAddress || !trimmedEin || !companySize) {
      setError(
        "Legal name, address, EIN, and employee count are required. Use Skip if you want to finish this later."
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/launch-pad/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: trimmedLegalName,
          tradeName: tradeName.trim(),
          address: trimmedAddress,
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          country: country.trim(),
          ein: trimmedEin,
          companySize,
          industry: industries[0] ?? "",
          industries,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          data.error ??
            "Could not save yet. Finish remaining company fields in Settings, or skip for now."
        );
        return;
      }
      await refresh();
      toast.success("Organization details saved.");
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save organization details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full justify-center py-8">
      <div className="w-full max-w-[1104px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex flex-col gap-6 p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[18px] font-semibold leading-7 text-black" style={interStyle}>
              Organization Details
            </h2>
            <p className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
              Company information for payroll and compliance. Use Skip if you want to finish this
              later.
            </p>
          </div>

          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <SectionBadge n={1} />
              <h3 className="text-[14px] font-semibold text-black" style={interStyle}>
                Company Information
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col">
                <FieldLabel>
                  Company legal name <span className="text-[#DC2626]">*</span>
                </FieldLabel>
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Company name"
                  className={fieldClass}
                  style={interStyle}
                />
              </label>
              <label className="flex flex-col">
                <FieldLabel optional>DBA / Trade name</FieldLabel>
                <input
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="Acme"
                  className={fieldClass}
                  style={interStyle}
                />
              </label>
            </div>

            <div className="flex flex-col" style={launchPadSelectVars}>
              <AddressAutocompleteField
                variant="facility"
                label="Company address"
                required
                value={address}
                onChange={(value) => {
                  addressAutocomplete.resetVerification();
                  setAddress(value);
                }}
                onSelectSuggestion={handleSelectAddressSuggestion}
                suggestions={addressAutocomplete.suggestions}
                isLoading={addressAutocomplete.isLoading}
                isOpen={addressAutocomplete.isOpen}
                onFocus={addressAutocomplete.openSuggestions}
                onCloseSuggestions={addressAutocomplete.closeSuggestions}
                isVerified={addressAutocomplete.isAddressVerified}
                searchError={addressAutocomplete.searchError}
                placeholder="Start typing your street address"
                helperText="Search to auto-fill city, state, zip, and country"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col">
                <FieldLabel>City</FieldLabel>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className={fieldClass}
                  style={interStyle}
                />
              </label>
              <label className="flex flex-col">
                <FieldLabel>State</FieldLabel>
                <input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  className={fieldClass}
                  style={interStyle}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col">
                <FieldLabel>Zip</FieldLabel>
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Zip code"
                  className={fieldClass}
                  style={interStyle}
                />
              </label>
              <div className="flex flex-col">
                <FieldLabel>Country</FieldLabel>
                <SettingsSelect
                  aria-label="Country"
                  value={country}
                  options={COUNTRY_OPTIONS}
                  onChange={setCountry}
                  placeholder="Select country"
                  size="sm"
                  className="w-full"
                  accentHex={LAUNCH_PAD_NAVY}
                  triggerClassName={selectTriggerClass}
                />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <SectionBadge n={2} />
              <h3 className="text-[14px] font-semibold text-black" style={interStyle}>
                Business Details
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col">
                <FieldLabel>
                  EIN / Tax ID <span className="text-[#DC2626]">*</span>
                </FieldLabel>
                <input
                  value={ein}
                  onChange={(e) => setEin(e.target.value)}
                  placeholder="XX-XXXXXXX"
                  required
                  className={fieldClass}
                  style={interStyle}
                />
                <p className="mt-1.5 text-[11px] text-[#6B7280]" style={interStyle}>
                  Used for payroll and compliance. Private.
                </p>
              </label>
              <div className="flex flex-col">
                <FieldLabel>
                  Employee count <span className="text-[#DC2626]">*</span>
                </FieldLabel>
                <SettingsSelect
                  aria-label="Employee count"
                  value={companySize}
                  options={EMPLOYEE_OPTIONS}
                  onChange={setCompanySize}
                  placeholder="Select"
                  size="sm"
                  className="w-full"
                  accentHex={LAUNCH_PAD_NAVY}
                  triggerClassName={selectTriggerClass}
                />
              </div>
            </div>

            <div className="flex flex-col" style={launchPadSelectVars}>
              <SearchableSelectField
                label="Industry"
                dense
                multiple
                values={industries}
                onValuesChange={setIndustries}
                options={[...INDUSTRY_OPTIONS]}
                placeholder="Select Industry"
                searchPlaceholder="Search industry"
                emptyMessage="No industries found. Try another search."
              />
            </div>

            <p className="text-[12px] leading-4 text-[#6B7280]" style={interStyle}>
              You can edit this anytime in Settings &gt; Organization. This info stays private and is
              only used for payroll and compliance.
            </p>
          </section>

          {error ? (
            <p role="alert" className="text-[12px] text-[#DC2626]" style={interStyle}>
              {error}
            </p>
          ) : null}
        </div>

        <div className="border-t border-[#E5E7EB]">
          <LaunchPadStepActions
            onSkip={onSkip}
            onBack={onBack}
            onContinue={() => void handleContinue()}
            saving={saving}
            continueLabel="Save and Finish Setup"
          />
        </div>
      </div>
    </div>
  );
}
