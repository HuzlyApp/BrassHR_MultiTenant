"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import AddressAutocompleteField from "@/app/components/signup/AddressAutocompleteField";
import SearchableSelectField from "@/app/tenant-onboarding/SearchableSelectField";
import {
  AddressField,
  FIELD,
  FieldLabel,
  TextField,
} from "../account/components/account-form-fields";
import AccountCheckbox from "../account/components/AccountCheckbox";
import type { FacilityFormInput, FacilityListItem } from "@/lib/facilities/types";
import { useAddressAutocomplete } from "@/lib/mapbox/use-address-autocomplete";
import type { AddressSuggestion } from "@/lib/mapbox/address-validation-types";
import { formatPhoneNumber, normalizePhoneInput } from "@/lib/phone";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  emailValidationMessage,
  phoneValidationMessage,
} from "@/lib/tenant/business-info-validation";
import { getStateCodeFromName, getStateNameFromCode } from "@/lib/us-state-names";

type Props = {
  open: boolean;
  workerId?: string;
  onClose: () => void;
  onSuccess: (result: { assigned: boolean; facilityId?: string }) => void;
  onAssignExisting?: (facilityId: string) => Promise<void>;
};

const EMPTY_FORM: FacilityFormInput = {
  name: "",
  streetAddress: "",
  city: "",
  state: "",
  zipCode: "",
  mailingAddress: "",
  facilityType: "",
  phone: "",
  email: "",
  contactPerson: "",
  notes: "",
};

type StateRow = { code: string; name: string };

export default function CreateFacilityModal({
  open,
  workerId,
  onClose,
  onSuccess,
  onAssignExisting,
}: Props) {
  const [form, setForm] = useState<FacilityFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FacilityFormInput, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [duplicateFacility, setDuplicateFacility] = useState<FacilityListItem | null>(null);
  const [assigningDuplicate, setAssigningDuplicate] = useState(false);
  const [assignToCandidate, setAssignToCandidate] = useState(true);
  const [stateRows, setStateRows] = useState<StateRow[]>([]);
  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [locationLoading, setLocationLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(false);

  const addressAutocomplete = useAddressAutocomplete(form.streetAddress, {
    city: form.city,
    state: form.state,
    zipCode: form.zipCode,
  });

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setErrors({});
    setDuplicateFacility(null);
    setAssigningDuplicate(false);
    setAssignToCandidate(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabaseBrowser
          .from("signup_us_states")
          .select("code, name")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });

        if (!active || error || !data?.length) return;

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
  }, [open]);

  const selectedStateCode = useMemo(() => {
    const fromRows = stateRows.find((row) => row.name === form.state)?.code;
    if (fromRows) return fromRows;
    const fromName = getStateCodeFromName(form.state);
    if (fromName) return fromName;
    const trimmed = form.state.trim().toUpperCase();
    if (trimmed.length === 2 && getStateNameFromCode(trimmed)) return trimmed;
    return "";
  }, [form.state, stateRows]);

  useEffect(() => {
    if (!open || !selectedStateCode || selectedStateCode.length !== 2) {
      setCityOptions([]);
      setCitiesLoading(false);
      return;
    }

    let active = true;
    setCitiesLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabaseBrowser
          .from("signup_us_cities")
          .select("city_name")
          .eq("state_code", selectedStateCode)
          .order("sort_order", { ascending: true })
          .order("city_name", { ascending: true });

        if (!active) return;
        if (error) {
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
  }, [open, selectedStateCode]);

  const effectiveCityOptions = useMemo(() => {
    const current = form.city.trim();
    if (!current || cityOptions.includes(current)) return cityOptions;
    return [...cityOptions, current].sort((a, b) => a.localeCompare(b));
  }, [form.city, cityOptions]);

  const effectiveStateOptions = useMemo(() => {
    const current = form.state.trim();
    if (!current) return stateOptions;
    if (stateOptions.includes(current)) return stateOptions;
    const fromCode = getStateNameFromCode(current);
    if (fromCode && stateOptions.includes(fromCode)) return stateOptions;
    return [...stateOptions, fromCode || current].sort((a, b) => a.localeCompare(b));
  }, [form.state, stateOptions]);

  const displayStateValue = useMemo(() => {
    const raw = form.state.trim();
    if (!raw) return "";
    if (stateOptions.includes(raw) || effectiveStateOptions.includes(raw)) return raw;
    const fromCode = getStateNameFromCode(raw);
    if (fromCode && (stateOptions.includes(fromCode) || effectiveStateOptions.includes(fromCode))) {
      return fromCode;
    }
    return raw;
  }, [effectiveStateOptions, form.state, stateOptions]);

  const stateOptionsUnavailable = !locationLoading && stateOptions.length === 0;
  const cityOptionsUnavailable =
    Boolean(displayStateValue) && !citiesLoading && effectiveCityOptions.length === 0;

  if (!open) return null;

  function updateField<K extends keyof FacilityFormInput>(key: K, value: FacilityFormInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    if (duplicateFacility) setDuplicateFacility(null);
  }

  function handleStateChange(value: string) {
    setForm((current) => ({ ...current, state: value, city: "" }));
    setErrors((current) => ({ ...current, state: undefined, city: undefined }));
    if (duplicateFacility) setDuplicateFacility(null);
  }

  function handleSelectAddressSuggestion(suggestion: AddressSuggestion) {
    const components = addressAutocomplete.selectSuggestion(suggestion);
    const stateName = components.state
      ? getStateNameFromCode(components.state) ?? components.state
      : "";

    setForm((current) => ({
      ...current,
      streetAddress: components.address1 || current.streetAddress,
      city: components.city || current.city,
      state: stateName || current.state,
      zipCode: components.zipCode || current.zipCode,
    }));
    setErrors((current) => ({
      ...current,
      streetAddress: undefined,
      city: undefined,
      state: undefined,
      zipCode: undefined,
    }));
    if (duplicateFacility) setDuplicateFacility(null);
  }

  function validateClient(): boolean {
    const nextErrors: Partial<Record<keyof FacilityFormInput, string>> = {};
    if (!form.name.trim()) nextErrors.name = "Facility name is required.";
    if (!form.streetAddress.trim()) nextErrors.streetAddress = "Street address is required.";
    if (!displayStateValue.trim()) nextErrors.state = "State is required.";
    if (!form.city.trim()) nextErrors.city = "City is required.";
    if (!form.zipCode.trim()) nextErrors.zipCode = "ZIP code is required.";

    const phoneError = phoneValidationMessage(form.phone ?? "", { required: false });
    if (phoneError) nextErrors.phone = phoneError;

    const emailError = emailValidationMessage(form.email ?? "", { required: false });
    if (emailError) nextErrors.email = emailError;

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validateClient()) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        state: displayStateValue || form.state,
        phone: form.phone ? normalizePhoneInput(form.phone) : "",
        email: form.email?.trim().toLowerCase() ?? "",
        assignToWorker: workerId ? assignToCandidate : false,
      };
      if (workerId) payload.workerId = workerId;

      const res = await fetch("/api/admin/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        duplicate?: boolean;
        facility?: FacilityListItem & { id?: string };
        assigned?: boolean;
        message?: string;
      };

      if (res.status === 409 && json.duplicate && json.facility) {
        setDuplicateFacility(json.facility);
        return;
      }

      if (!res.ok) {
        console.error("[CreateFacilityModal] create failed", json);
        toast.error(json.error || json.message || "Failed to create facility.");
        return;
      }

      toast.success(
        json.assigned
          ? "Facility created and assigned successfully."
          : "Facility created successfully."
      );
      onSuccess({ assigned: Boolean(json.assigned), facilityId: json.facility?.id });
      onClose();
    } catch (error) {
      console.error("[CreateFacilityModal] create error", error);
      toast.error("Failed to create facility.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignDuplicate() {
    if (!duplicateFacility || !onAssignExisting) return;
    setAssigningDuplicate(true);
    try {
      await onAssignExisting(duplicateFacility.id);
      toast.success("Existing facility assigned successfully.");
      onSuccess({ assigned: true });
      onClose();
    } catch (error) {
      console.error("[CreateFacilityModal] assign duplicate error", error);
      toast.error(error instanceof Error ? error.message : "Failed to assign facility.");
    } finally {
      setAssigningDuplicate(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-facility-title"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_18px_38px_rgba(2,8,23,0.2)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-8 py-6">
          <h2 id="create-facility-title" className="text-2xl font-semibold leading-none text-[#1F2937]">
            Create Facility
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white"
            aria-label="Close create facility modal"
          >
            <X className="h-7 w-7" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-8 py-6">
          {duplicateFacility ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <div className="font-medium">This facility already exists.</div>
              <div className="mt-2">
                <div>{duplicateFacility.name}</div>
                <div className="text-amber-800">{duplicateFacility.primaryAddress}</div>
              </div>
              <button
                type="button"
                onClick={handleAssignDuplicate}
                disabled={assigningDuplicate}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-(--brand-primary) px-4 text-sm font-medium text-white disabled:opacity-60"
              >
                {assigningDuplicate ? "Assigning..." : "Assign existing facility instead"}
              </button>
            </div>
          ) : null}

          <TextField
            label="Facility Name"
            required
            value={form.name}
            onChange={(value) => updateField("name", value)}
            error={errors.name}
          />

          <AddressAutocompleteField
            variant="facility"
            label="Primary Address / Street Address"
            required
            value={form.streetAddress}
            onChange={(value) => updateField("streetAddress", value)}
            onSelectSuggestion={handleSelectAddressSuggestion}
            suggestions={addressAutocomplete.suggestions}
            isLoading={addressAutocomplete.isLoading}
            isOpen={addressAutocomplete.isOpen}
            onFocus={addressAutocomplete.openSuggestions}
            onCloseSuggestions={addressAutocomplete.closeSuggestions}
            isVerified={addressAutocomplete.isAddressVerified}
            searchError={addressAutocomplete.searchError}
            placeholder="Start typing your street address"
            helperText="Start typing to search"
            error={errors.streetAddress}
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
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
              error={errors.state}
              emptyMessage="No states found. Try another search."
            />
            <SearchableSelectField
              label="City"
              required
              disabled={!displayStateValue || stateOptionsUnavailable || cityOptionsUnavailable}
              loading={citiesLoading}
              value={form.city}
              onChange={(value) => updateField("city", value)}
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
              error={errors.city}
              emptyMessage="No cities found. Try another search."
            />
            <TextField
              label="ZIP Code"
              required
              value={form.zipCode}
              onChange={(value) => updateField("zipCode", value.replace(/\D/g, "").slice(0, 5))}
              error={errors.zipCode}
            />
          </div>

          <AddressField
            label="Secondary Address / Mailing Address"
            value={form.mailingAddress ?? ""}
            onChange={(value) => updateField("mailingAddress", value)}
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField
              label="Facility Type"
              value={form.facilityType ?? ""}
              onChange={(value) => updateField("facilityType", value)}
            />
            <TextField
              label="Phone Number"
              type="tel"
              value={form.phone ?? ""}
              onChange={(value) => updateField("phone", formatPhoneNumber(value))}
              placeholder="(555) 555-5555"
              error={errors.phone}
            />
            <TextField
              label="Email"
              type="email"
              value={form.email ?? ""}
              onChange={(value) => updateField("email", value)}
              error={errors.email}
            />
            <TextField
              label="Contact Person"
              value={form.contactPerson ?? ""}
              onChange={(value) => updateField("contactPerson", value)}
            />
          </div>

          <label className="block">
            <FieldLabel>Notes</FieldLabel>
            <textarea
              value={form.notes ?? ""}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={4}
              className={`${FIELD} min-h-[96px] resize-y py-3`}
            />
          </label>

          {workerId ? (
            <label className="flex cursor-pointer items-center gap-3">
              <AccountCheckbox
                checked={assignToCandidate}
                onChange={(event) => setAssignToCandidate(event.target.checked)}
              />
              <span className="text-sm leading-5 text-[#374151]">
                Assign this facility to the current applicant after creating
              </span>
            </label>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#E5E7EB] bg-white px-8 py-5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#D1D5DB] px-4 text-sm font-medium text-[#374151]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-(--brand-primary) px-5 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create Facility"}
          </button>
        </div>
      </form>
    </div>
  );
}
