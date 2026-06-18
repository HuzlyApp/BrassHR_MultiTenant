"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import {
  AddressField,
  FIELD,
  FieldLabel,
  SelectField,
  TextField,
  US_STATES,
} from "../account/components/account-form-fields";
import AccountCheckbox from "../account/components/AccountCheckbox";
import type { FacilityFormInput, FacilityListItem } from "@/lib/facilities/types";

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

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setErrors({});
    setDuplicateFacility(null);
    setAssigningDuplicate(false);
    setAssignToCandidate(true);
  }, [open]);

  if (!open) return null;

  function updateField<K extends keyof FacilityFormInput>(key: K, value: FacilityFormInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    if (duplicateFacility) setDuplicateFacility(null);
  }

  function validateClient(): boolean {
    const nextErrors: Partial<Record<keyof FacilityFormInput, string>> = {};
    if (!form.name.trim()) nextErrors.name = "Facility name is required.";
    if (!form.streetAddress.trim()) nextErrors.streetAddress = "Street address is required.";
    if (!form.city.trim()) nextErrors.city = "City is required.";
    if (!form.state.trim()) nextErrors.state = "State is required.";
    if (!form.zipCode.trim()) nextErrors.zipCode = "ZIP code is required.";
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
          />
          {errors.name ? <p className="-mt-3 text-sm text-red-600">{errors.name}</p> : null}

          <AddressField
            label="Primary Address / Street Address"
            required
            value={form.streetAddress}
            onChange={(value) => updateField("streetAddress", value)}
          />
          {errors.streetAddress ? (
            <p className="-mt-3 text-sm text-red-600">{errors.streetAddress}</p>
          ) : null}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <TextField label="City" required value={form.city} onChange={(value) => updateField("city", value)} />
              {errors.city ? <p className="mt-1 text-sm text-red-600">{errors.city}</p> : null}
            </div>
            <div>
              <SelectField
                label="State"
                required
                value={form.state}
                onChange={(value) => updateField("state", value)}
              >
                <option value="">Select state</option>
                {US_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </SelectField>
              {errors.state ? <p className="mt-1 text-sm text-red-600">{errors.state}</p> : null}
            </div>
            <div>
              <TextField
                label="ZIP Code"
                required
                value={form.zipCode}
                onChange={(value) => updateField("zipCode", value)}
              />
              {errors.zipCode ? <p className="mt-1 text-sm text-red-600">{errors.zipCode}</p> : null}
            </div>
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
              onChange={(value) => updateField("phone", value)}
            />
            <TextField
              label="Email"
              type="email"
              value={form.email ?? ""}
              onChange={(value) => updateField("email", value)}
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
