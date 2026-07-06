"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { getAccountDisplayName, formatRoleLabel } from "@/lib/account/display-name";
import { syncAccountChecklist } from "@/lib/account/fetch-account-data";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { FIELD, FieldLabel, SelectField, US_STATES } from "./account-form-fields";
import { StaffProfilePhotoUpload } from "./StaffProfilePhotoUpload";
import {
  AccountErrorBanner,
  AccountLoadingSkeleton,
  AccountSaveButton,
  AccountSuccessBanner,
} from "./AccountFormStatus";

export default function PersonalTab() {
  const { user, profile, organization, settings, checklist, loading, error, refresh } =
    useAccountData();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [address, setAddress] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [emailChangeNotice, setEmailChangeNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!profile && !user) return;
    setFirstName(profile?.first_name ?? "");
    setLastName(profile?.last_name ?? "");
    setWorkEmail(user?.email ?? profile?.email ?? "");
    setJobTitle(profile?.job_title ?? "");
    setPhone(profile?.phone ?? user?.phone ?? "");
    setPhotoUrl(profile?.avatar_url ?? null);
    setCity(profile?.city ?? "");
    setState(profile?.state ?? "");
    setZipCode(profile?.zip_code ?? "");
    setAddress(profile?.address_line1 ?? "");
  }, [profile, user]);

  const displayName = getAccountDisplayName(profile, user);
  const roleLabel = formatRoleLabel(profile?.role);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    setEmailChangeNotice(null);

    try {
      const trimmedEmail = workEmail.trim();
      const emailChanged = trimmedEmail && trimmedEmail !== (user.email ?? "");

      const { error: profileError } = await supabaseBrowser
        .from("users")
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone: phone.trim() || null,
          job_title: jobTitle.trim() || null,
          address_line1: address.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          zip_code: zipCode.trim() || null,
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
          full_name: [firstName, lastName].filter(Boolean).join(" ").trim() || null,
          email: trimmedEmail,
          phone: phone.trim() || null,
          avatar_url: photoUrl,
          role: profile?.role ?? null,
          job_title: jobTitle.trim() || null,
          organization_id: profile?.organization_id ?? null,
          address_line1: address.trim() || null,
          address_line2: profile?.address_line2 ?? null,
          city: city.trim() || null,
          state: state.trim() || null,
          zip_code: zipCode.trim() || null,
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
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 sm:p-6">
        <AccountLoadingSkeleton rows={6} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-[#E5E7EB] bg-white p-5 sm:p-6">
      {error ? <AccountErrorBanner message={error} /> : null}
      {saveError ? <AccountErrorBanner message={saveError} /> : null}
      {saveSuccess ? <AccountSuccessBanner message={saveSuccess} /> : null}
      {emailChangeNotice ? <AccountSuccessBanner message={emailChangeNotice} /> : null}

      <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex min-w-0 items-center gap-4">
          <StaffProfilePhotoUpload
            displayName={displayName}
            photoUrl={photoUrl}
            onPhotoUpdated={setPhotoUrl}
            variant="card"
          />
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold text-[#012352]">{displayName}</p>
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
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block">
              <FieldLabel>Last Name</FieldLabel>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={FIELD}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Work Email</FieldLabel>
              <input
                type="email"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block">
              <FieldLabel>Job Title</FieldLabel>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className={FIELD}
              />
            </label>
          </div>

          <label className="block">
            <FieldLabel>Phone</FieldLabel>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={FIELD}
            />
          </label>

          <StaffProfilePhotoUpload
            displayName={displayName}
            photoUrl={photoUrl}
            onPhotoUpdated={setPhotoUrl}
          />

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-[1.15fr_1.15fr_0.85fr]">
            <label className="block">
              <FieldLabel>City</FieldLabel>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={FIELD} />
            </label>
            <SelectField label="State" value={state} onChange={setState}>
              <option value="">Select state</option>
              {US_STATES.map((stateOption) => (
                <option key={stateOption} value={stateOption}>
                  {stateOption}
                </option>
              ))}
            </SelectField>
            <label className="block">
              <FieldLabel>Zip Code</FieldLabel>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className={FIELD}
              />
            </label>
          </div>

          <label className="block">
            <FieldLabel>Address</FieldLabel>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={FIELD}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <AccountSaveButton saving={saving} />
        </div>
      </section>
    </form>
  );
}
