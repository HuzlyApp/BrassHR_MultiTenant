"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { getAccountDisplayName } from "@/lib/account/display-name";
import { syncAccountChecklist } from "@/lib/account/fetch-account-data";
import { resolvePersonalProfileFields } from "@/lib/account/resolve-personal-profile-fields";
import {
  filterCandidateFieldInput,
  validateCandidateFieldInput,
} from "@/lib/admin/worker-profile-field-client";
import {
  isPersonNameTooLong,
  PERSON_NAME_MAX_LENGTH,
  personNameTooLongMessage,
} from "@/lib/person-name";
import { formatPhoneNumber } from "@/lib/phone";
import { isValidStep1Zip5, step1ZipStateMessage } from "@/lib/onboardingStep1Validation";
import {
  addressValidationMessage,
  normalizeBusinessZipInput,
  phoneValidationMessage,
} from "@/lib/tenant/business-info-validation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { FIELD, FieldLabel, SelectField, US_STATES } from "./account-form-fields";
import { StaffProfilePhotoUpload } from "./StaffProfilePhotoUpload";
import {
  AccountErrorBanner,
  AccountLoadingSkeleton,
  AccountSuccessBanner,
} from "./AccountFormStatus";
import AccountCheckbox from "./AccountCheckbox";

type DepartmentOption = { id: string; name: string };

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
      <div className="border-b border-[#E5E7EB] px-5 py-3.5">
        <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function RequiredMark() {
  return <span className="text-red-500"> *</span>;
}

export default function PersonalTab() {
  const { user, profile, organization, settings, checklist, loading, error, refresh } =
    useAccountData();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [sameAsAddress1, setSameAsAddress1] = useState(false);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [companyEin, setCompanyEin] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [emailChangeNotice, setEmailChangeNotice] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [birthdateError, setBirthdateError] = useState<string | null>(null);
  const [jobTitleError, setJobTitleError] = useState<string | null>(null);

  const resolvedFields = useMemo(
    () => resolvePersonalProfileFields(profile, organization),
    [profile, organization]
  );

  useEffect(() => {
    if (!profile && !user && !organization) return;
    setFirstName(resolvedFields.firstName);
    setLastName(resolvedFields.lastName);
    setPreferredName(resolvedFields.preferredName);
    setWorkEmail(user?.email ?? resolvedFields.workEmail);
    setPhone(resolvedFields.phone);
    setBirthdate(resolvedFields.birthdate);
    setJobTitle(resolvedFields.jobTitle);
    setDepartmentId(resolvedFields.departmentId);
    setEmployeeId(resolvedFields.employeeId);
    setWorkLocation(resolvedFields.workLocation);
    setBio(resolvedFields.bio);
    setPhotoUrl(profile?.avatar_url ?? null);
    setAddress(resolvedFields.address);
    setAddressLine2(resolvedFields.addressLine2);
    setSameAsAddress1(
      Boolean(
        resolvedFields.address &&
          resolvedFields.addressLine2 &&
          resolvedFields.address === resolvedFields.addressLine2
      )
    );
    setCity(resolvedFields.city);
    setState(resolvedFields.state);
    setZipCode(resolvedFields.zipCode);
    setCompanyEin(resolvedFields.companyEin);
    setCompanyPhone(resolvedFields.companyPhone);
    setCompanyEmail(resolvedFields.companyEmail);
    setCompanyWebsite(resolvedFields.companyWebsite);
  }, [profile, user, organization, resolvedFields]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/departments", { cache: "no-store" });
        const payload = (await res.json().catch(() => ({}))) as {
          departments?: Array<{ id?: string; name?: string }>;
        };
        if (!res.ok || !alive) return;
        setDepartments(
          (payload.departments ?? [])
            .map((row) => ({
              id: typeof row.id === "string" ? row.id : "",
              name: typeof row.name === "string" ? row.name.trim() : "",
            }))
            .filter((row) => row.id && row.name)
        );
      } catch {
        /* optional */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const displayName = getAccountDisplayName(profile, user);

  function resetFromResolved() {
    setFirstName(resolvedFields.firstName);
    setLastName(resolvedFields.lastName);
    setPreferredName(resolvedFields.preferredName);
    setWorkEmail(user?.email ?? resolvedFields.workEmail);
    setPhone(resolvedFields.phone);
    setBirthdate(resolvedFields.birthdate);
    setJobTitle(resolvedFields.jobTitle);
    setDepartmentId(resolvedFields.departmentId);
    setEmployeeId(resolvedFields.employeeId);
    setWorkLocation(resolvedFields.workLocation);
    setBio(resolvedFields.bio);
    setPhotoUrl(profile?.avatar_url ?? null);
    setAddress(resolvedFields.address);
    setAddressLine2(resolvedFields.addressLine2);
    setSameAsAddress1(
      Boolean(
        resolvedFields.address &&
          resolvedFields.addressLine2 &&
          resolvedFields.address === resolvedFields.addressLine2
      )
    );
    setCity(resolvedFields.city);
    setState(resolvedFields.state);
    setZipCode(resolvedFields.zipCode);
    setSaveError(null);
    setSaveSuccess(null);
    setEmailChangeNotice(null);
    setPhoneError(null);
    setAddressError(null);
    setZipError(null);
    setBirthdateError(null);
    setJobTitleError(null);
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    setEmailChangeNotice(null);
    setPhoneError(null);
    setAddressError(null);
    setZipError(null);
    setBirthdateError(null);
    setJobTitleError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setSaveError("First name and last name are required.");
      setSaving(false);
      return;
    }

    if (isPersonNameTooLong(firstName) || isPersonNameTooLong(lastName) || isPersonNameTooLong(preferredName)) {
      setSaveError(
        personNameTooLongMessage(
          isPersonNameTooLong(firstName)
            ? "First name"
            : isPersonNameTooLong(lastName)
              ? "Last name"
              : "Preferred name"
        )
      );
      setSaving(false);
      return;
    }

    if (!birthdate.trim()) {
      setBirthdateError("Birthdate is required.");
      setSaving(false);
      return;
    }

    if (!jobTitle.trim()) {
      setJobTitleError("Job title is required.");
      setSaving(false);
      return;
    }

    const nextPhoneError = phone.trim()
      ? phoneValidationMessage(phone, { required: false })
      : null;
    const nextAddressError = address.trim()
      ? addressValidationMessage(address, { required: false })
      : null;
    let nextZipError: string | null = null;
    if (zipCode.trim()) {
      if (!isValidStep1Zip5(zipCode)) {
        nextZipError = "Enter a valid 5-digit ZIP code.";
      } else if (state.trim()) {
        nextZipError = step1ZipStateMessage(zipCode, state);
      }
    }

    setPhoneError(nextPhoneError);
    setAddressError(nextAddressError);
    setZipError(nextZipError);

    if (nextPhoneError || nextAddressError || nextZipError) {
      setSaving(false);
      return;
    }

    let phoneToSave: string | null = null;
    if (phone.trim()) {
      const phoneCheck = validateCandidateFieldInput("phone", phone);
      if (!phoneCheck.ok) {
        setPhoneError(phoneCheck.error);
        setSaving(false);
        return;
      }
      phoneToSave = formatPhoneNumber(phoneCheck.value);
    }

    const zipToSave = zipCode.trim() ? normalizeBusinessZipInput(zipCode).slice(0, 5) : null;
    const address2ToSave = sameAsAddress1
      ? address.trim() || null
      : addressLine2.trim() || null;

    try {
      const trimmedEmail = workEmail.trim();
      const emailChanged = trimmedEmail && trimmedEmail !== (user.email ?? "");

      const { error: profileError } = await supabaseBrowser
        .from("users")
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          preferred_name: preferredName.trim() || null,
          phone: phoneToSave,
          birthdate: birthdate.trim() || null,
          job_title: jobTitle.trim() || null,
          department_id: departmentId.trim() || null,
          employee_id: employeeId.trim() || null,
          work_location: workLocation.trim() || null,
          bio: bio.trim() || null,
          address_line1: address.trim() || null,
          address_line2: address2ToSave,
          city: city.trim() || null,
          state: state.trim() || null,
          zip_code: zipToSave,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      if (emailChanged) {
        const { error: emailError } = await supabaseBrowser.auth.updateUser({
          email: trimmedEmail,
        });
        if (emailError) throw emailError;
        setEmailChangeNotice(
          "A confirmation email may be sent to verify your new address before it takes effect."
        );
      }

      await refresh();
      const refreshed = await syncAccountChecklist(supabaseBrowser, {
        user,
        profile: {
          ...(profile ?? { id: user.id }),
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          preferred_name: preferredName.trim() || null,
          full_name: [firstName, lastName].filter(Boolean).join(" ").trim() || null,
          email: trimmedEmail,
          phone: phoneToSave,
          birthdate: birthdate.trim() || null,
          avatar_url: photoUrl,
          role: profile?.role ?? null,
          job_title: jobTitle.trim() || null,
          department_id: departmentId.trim() || null,
          employee_id: employeeId.trim() || null,
          work_location: workLocation.trim() || null,
          bio: bio.trim() || null,
          organization_id: profile?.organization_id ?? null,
          address_line1: address.trim() || null,
          address_line2: address2ToSave,
          city: city.trim() || null,
          state: state.trim() || null,
          zip_code: zipToSave,
          created_at: profile?.created_at ?? null,
          updated_at: new Date().toISOString(),
        },
        organization,
        settings,
        checklist,
      });
      if (refreshed) await refresh();

      setSaveSuccess("Profile saved successfully.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
        <AccountLoadingSkeleton rows={8} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">Profile</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Manage your personal and professional information.
        </p>
      </div>

      {error ? <AccountErrorBanner message={error} /> : null}
      {saveError ? <AccountErrorBanner message={saveError} /> : null}
      {saveSuccess ? <AccountSuccessBanner message={saveSuccess} /> : null}
      {emailChangeNotice ? <AccountSuccessBanner message={emailChangeNotice} /> : null}

      <section className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-5">
        <StaffProfilePhotoUpload
          displayName={displayName}
          photoUrl={photoUrl}
          onPhotoUpdated={setPhotoUrl}
          variant="hero"
        />
      </section>

      <SectionCard title="Personal Information">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>
              First Name
              <RequiredMark />
            </FieldLabel>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={PERSON_NAME_MAX_LENGTH}
              className={FIELD}
              required
            />
          </label>
          <label className="block">
            <FieldLabel>
              Last Name
              <RequiredMark />
            </FieldLabel>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={PERSON_NAME_MAX_LENGTH}
              className={FIELD}
              required
            />
          </label>
          <label className="block">
            <FieldLabel>Preferred Name</FieldLabel>
            <input
              type="text"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              maxLength={PERSON_NAME_MAX_LENGTH}
              className={FIELD}
            />
          </label>
          <label className="block">
            <FieldLabel>Email Address</FieldLabel>
            <input
              type="email"
              value={workEmail}
              onChange={(e) => setWorkEmail(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="block">
            <FieldLabel>Phone Number</FieldLabel>
            <div
              className={`flex overflow-hidden rounded-md border bg-white focus-within:border-[color:var(--brand-primary)] focus-within:ring-1 focus-within:ring-[color:var(--brand-primary)] ${
                phoneError ? "border-[#FCA5A5]" : "border-[#D1D5DB]"
              }`}
            >
              <span className="inline-flex items-center border-r border-[#E5E7EB] bg-[#F8FAFC] px-3 text-sm font-medium text-[#334155]">
                +1
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(filterCandidateFieldInput("phone", e.target.value));
                  if (phoneError) setPhoneError(null);
                }}
                className="h-11 min-w-0 flex-1 border-0 bg-white px-3 text-sm text-[#111827] outline-none"
                autoComplete="tel"
              />
            </div>
            {phoneError ? <p className="mt-1 text-xs text-[#B91C1C]">{phoneError}</p> : null}
          </label>
          <label className="block">
            <FieldLabel>
              Birthdate
              <RequiredMark />
            </FieldLabel>
            <input
              type="date"
              value={birthdate}
              onChange={(e) => {
                setBirthdate(e.target.value);
                if (birthdateError) setBirthdateError(null);
              }}
              onClick={(e) => {
                const input = e.currentTarget;
                try {
                  input.showPicker?.();
                } catch {
                  /* unsupported / already open */
                }
              }}
              className={`${FIELD} cursor-pointer${birthdateError ? " border-[#FCA5A5] focus:border-[#EF4444] focus:ring-[#EF4444]" : ""}`}
            />
            {birthdateError ? <p className="mt-1 text-xs text-[#B91C1C]">{birthdateError}</p> : null}
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Professional Information">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>
              Job Title
              <RequiredMark />
            </FieldLabel>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => {
                setJobTitle(e.target.value);
                if (jobTitleError) setJobTitleError(null);
              }}
              className={`${FIELD}${jobTitleError ? " border-[#FCA5A5] focus:border-[#EF4444] focus:ring-[#EF4444]" : ""}`}
            />
            {jobTitleError ? <p className="mt-1 text-xs text-[#B91C1C]">{jobTitleError}</p> : null}
          </label>
          <SelectField label="Department" value={departmentId} onChange={setDepartmentId}>
            <option value="">Select department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </SelectField>
          <label className="block">
            <FieldLabel>Employee ID</FieldLabel>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="block">
            <FieldLabel>Location</FieldLabel>
            <input
              type="text"
              value={workLocation}
              onChange={(e) => setWorkLocation(e.target.value)}
              placeholder="City, State"
              className={FIELD}
            />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel>Bio</FieldLabel>
            <textarea
              rows={4}
              value={bio}
              maxLength={1000}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#111827] outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-1 focus:ring-[color:var(--brand-primary)]"
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Company Contact Details">
        <div className="flex flex-col gap-5">
          <label className="block max-w-xs">
            <FieldLabel>Company EIN</FieldLabel>
            <input type="text" value={companyEin} readOnly disabled className={FIELD} />
          </label>

          <label className="block">
            <FieldLabel>Address Line 1</FieldLabel>
            <input
              type="text"
              value={address}
              onChange={(e) => {
                const next = filterCandidateFieldInput("address", e.target.value);
                setAddress(next);
                if (sameAsAddress1) setAddressLine2(next);
                if (addressError) setAddressError(null);
              }}
              className={`${FIELD}${addressError ? " border-[#FCA5A5] focus:border-[#EF4444] focus:ring-[#EF4444]" : ""}`}
              autoComplete="address-line1"
            />
            {addressError ? <p className="mt-1 text-xs text-[#B91C1C]">{addressError}</p> : null}
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <FieldLabel>Address Line 2 (Optional)</FieldLabel>
              <label className="inline-flex items-center gap-2 text-sm text-[#374151]">
                <AccountCheckbox
                  checked={sameAsAddress1}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSameAsAddress1(checked);
                    if (checked) setAddressLine2(address);
                  }}
                />
                Same as address 1
              </label>
            </div>
            <input
              type="text"
              value={addressLine2}
              onChange={(e) => {
                setSameAsAddress1(false);
                setAddressLine2(filterCandidateFieldInput("address", e.target.value));
              }}
              disabled={sameAsAddress1}
              className={FIELD}
              autoComplete="address-line2"
            />
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-3">
            <label className="block">
              <FieldLabel>City</FieldLabel>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={FIELD} />
            </label>
            <SelectField label="State / Province" value={state} onChange={setState}>
              <option value="">Select state</option>
              {US_STATES.map((stateOption) => (
                <option key={stateOption} value={stateOption}>
                  {stateOption}
                </option>
              ))}
            </SelectField>
            <label className="block">
              <FieldLabel>Zip / Postal Code</FieldLabel>
              <input
                type="text"
                inputMode="numeric"
                value={zipCode}
                onChange={(e) => {
                  setZipCode(normalizeBusinessZipInput(e.target.value).slice(0, 5));
                  if (zipError) setZipError(null);
                }}
                className={`${FIELD}${zipError ? " border-[#FCA5A5] focus:border-[#EF4444] focus:ring-[#EF4444]" : ""}`}
              />
              {zipError ? <p className="mt-1 text-xs text-[#B91C1C]">{zipError}</p> : null}
            </label>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-3">
            <label className="block">
              <FieldLabel>Company Phone</FieldLabel>
              <input type="text" value={companyPhone} readOnly disabled className={FIELD} />
            </label>
            <label className="block">
              <FieldLabel>Company Email</FieldLabel>
              <input type="text" value={companyEmail} readOnly disabled className={FIELD} />
            </label>
            <label className="block">
              <FieldLabel>Website</FieldLabel>
              <input type="text" value={companyWebsite} readOnly disabled className={FIELD} />
            </label>
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-col-reverse justify-end gap-2 pt-1 sm:flex-row">
        <button
          type="button"
          onClick={resetFromResolved}
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-md border border-[#D1D5DB] bg-white px-5 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-md px-5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--brand-primary, #012352)" }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
