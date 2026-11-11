"use client";

import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { PERSON_NAME_MAX_LENGTH } from "@/lib/person-name";
import { formatPhoneNumber } from "@/lib/phone";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { workerAvatarInitial, workerBrandedAvatarStyle } from "./WorkerPortalUserAvatar";
import {
  WORKER_BTN_OUTLINE,
  WORKER_BTN_PRIMARY,
  WORKER_BTN_PRIMARY_SM,
} from "./worker-portal-buttons";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SCHEDULE_SUBTITLE_CLASS,
  WORKER_SCHEDULE_SUBTITLE_STYLE,
  WORKER_SCHEDULE_TITLE_CLASS,
  WORKER_SCHEDULE_TITLE_STYLE,
} from "./worker-schedule-typography";

type ProfileForm = {
  firstName: string;
  lastName: string;
  preferredName: string;
  email: string;
  phone: string;
  birthdate: string;
  jobTitle: string;
  departmentId: string;
  employeeId: string;
  location: string;
  bio: string;
};

type DepartmentOption = { id: string; name: string };

type FieldErrors = Partial<Record<keyof ProfileForm, string>>;

const EMPTY_FORM: ProfileForm = {
  firstName: "",
  lastName: "",
  preferredName: "",
  email: "",
  phone: "",
  birthdate: "",
  jobTitle: "",
  departmentId: "",
  employeeId: "",
  location: "",
  bio: "",
};

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#64748B]";

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-[#374151]">
      {children}
    </label>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold text-[#0F172A]">{children}</h2>;
}

export function WorkerUserSettingsProfilePanel() {
  const branding = useTenantBranding();
  const { sessionReady, authHeaders, setProfilePhotoUrl } = useApplicantPortal();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [baseline, setBaseline] = useState<ProfileForm>(EMPTY_FORM);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionReady) return;
    let alive = true;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = await authHeaders();
        if (!headers) throw new Error("You need to sign in again.");
        const res = await fetch("/api/applicant-portal/user-settings", {
          headers,
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => ({}))) as {
          profile?: ProfileForm & { profilePhotoUrl?: string | null; displayName?: string };
          departments?: DepartmentOption[];
          error?: string;
        };
        if (!res.ok) throw new Error(payload.error || "Could not load settings.");
        if (!alive) return;

        const next: ProfileForm = {
          firstName: payload.profile?.firstName ?? "",
          lastName: payload.profile?.lastName ?? "",
          preferredName: payload.profile?.preferredName ?? "",
          email: payload.profile?.email ?? "",
          phone: payload.profile?.phone ?? "",
          birthdate: payload.profile?.birthdate ?? "",
          jobTitle: payload.profile?.jobTitle ?? "",
          departmentId: payload.profile?.departmentId ?? "",
          employeeId: payload.profile?.employeeId ?? "",
          location: payload.profile?.location ?? "",
          bio: payload.profile?.bio ?? "",
        };
        setForm(next);
        setBaseline(next);
        setDepartments(payload.departments ?? []);
        setPhotoUrl(payload.profile?.profilePhotoUrl ?? null);
        setDisplayName(payload.profile?.displayName ?? "");
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load settings.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authHeaders, sessionReady]);

  function updateField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleCancel() {
    setForm(baseline);
    setFieldErrors({});
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch("/api/applicant-portal/user-settings", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ section: "profile", ...form }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        profile?: ProfileForm & { profilePhotoUrl?: string | null; displayName?: string };
        departments?: DepartmentOption[];
        fieldErrors?: FieldErrors;
        error?: string;
      };
      if (!res.ok) {
        if (payload.fieldErrors) setFieldErrors(payload.fieldErrors);
        throw new Error(payload.error || "Could not save profile.");
      }
      const next: ProfileForm = {
        firstName: payload.profile?.firstName ?? form.firstName,
        lastName: payload.profile?.lastName ?? form.lastName,
        preferredName: payload.profile?.preferredName ?? form.preferredName,
        email: payload.profile?.email ?? form.email,
        phone: payload.profile?.phone ?? form.phone,
        birthdate: payload.profile?.birthdate ?? form.birthdate,
        jobTitle: payload.profile?.jobTitle ?? form.jobTitle,
        departmentId: payload.profile?.departmentId ?? form.departmentId,
        employeeId: payload.profile?.employeeId ?? form.employeeId,
        location: payload.profile?.location ?? form.location,
        bio: payload.profile?.bio ?? form.bio,
      };
      setForm(next);
      setBaseline(next);
      if (payload.departments) setDepartments(payload.departments);
      toast.success("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoSelected(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    const localPreview = URL.createObjectURL(file);
    setPhotoUrl(localPreview);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/applicant-portal/profile-photo", {
        method: "POST",
        headers,
        body: formData,
      });
      const payload = (await res.json().catch(() => ({}))) as {
        profilePhotoUrl?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not upload photo.");
      URL.revokeObjectURL(localPreview);
      const nextUrl = payload.profilePhotoUrl ?? null;
      setPhotoUrl(nextUrl);
      setProfilePhotoUrl(nextUrl);
      toast.success("Photo updated.");
    } catch (err) {
      URL.revokeObjectURL(localPreview);
      setPhotoUrl(null);
      setError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemovePhoto() {
    if (!photoUrl || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch("/api/applicant-portal/profile-photo", {
        method: "DELETE",
        headers,
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not remove photo.");
      setPhotoUrl(null);
      setProfilePhotoUrl(null);
      toast.success("Photo removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo.");
    } finally {
      setUploading(false);
    }
  }

  const avatarName =
    displayName ||
    [form.firstName, form.lastName].filter(Boolean).join(" ").trim() ||
    "Worker";

  return (
    <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} pb-10`}>
      <div className="mb-5">
        <h1 className={WORKER_SCHEDULE_TITLE_CLASS} style={WORKER_SCHEDULE_TITLE_STYLE}>
          Profile
        </h1>
        <p className={WORKER_SCHEDULE_SUBTITLE_CLASS} style={WORKER_SCHEDULE_SUBTITLE_STYLE}>
          Manage your personal and professional information.
        </p>
      </div>

      <section className={`${WORKER_SCHEDULE_CARD_CLASS} p-5 sm:p-6`}>
        {loading ? (
          <div className="space-y-4">
            <div className="h-20 rounded-xl bg-[#F1F5F9] motion-safe:animate-pulse" />
            <div className="h-40 rounded-xl bg-[#F1F5F9] motion-safe:animate-pulse" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-semibold text-white"
                style={!photoUrl ? workerBrandedAvatarStyle(branding.primaryHex, branding.accentHex) : undefined}
              >
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  workerAvatarInitial(avatarName)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#64748B]">
                  Recommended size: 400 x 400px. JPG, JPEG, PNG (max 2MB)
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={WORKER_BTN_PRIMARY_SM}
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Uploading...
                      </>
                    ) : (
                      "Change Photo"
                    )}
                  </button>
                  <button
                    type="button"
                    className={WORKER_BTN_OUTLINE}
                    disabled={uploading || !photoUrl}
                    onClick={() => void handleRemovePhoto()}
                  >
                    Remove
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/jpg,image/webp"
                    className="sr-only"
                    onChange={(event) => void handlePhotoSelected(event.target.files?.[0])}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <SectionTitle>Personal Information</SectionTitle>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="settings-first-name">First Name</FieldLabel>
                  <input
                    id="settings-first-name"
                    className={FIELD_CLASS}
                    value={form.firstName}
                    maxLength={PERSON_NAME_MAX_LENGTH}
                    onChange={(event) => updateField("firstName", event.target.value)}
                  />
                  {fieldErrors.firstName ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.firstName}</p>
                  ) : null}
                </div>
                <div>
                  <FieldLabel htmlFor="settings-last-name">Last Name</FieldLabel>
                  <input
                    id="settings-last-name"
                    className={FIELD_CLASS}
                    value={form.lastName}
                    maxLength={PERSON_NAME_MAX_LENGTH}
                    onChange={(event) => updateField("lastName", event.target.value)}
                  />
                  {fieldErrors.lastName ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.lastName}</p>
                  ) : null}
                </div>
                <div>
                  <FieldLabel htmlFor="settings-preferred-name">Preferred Name</FieldLabel>
                  <input
                    id="settings-preferred-name"
                    className={FIELD_CLASS}
                    value={form.preferredName}
                    maxLength={PERSON_NAME_MAX_LENGTH}
                    onChange={(event) => updateField("preferredName", event.target.value)}
                  />
                  {fieldErrors.preferredName ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.preferredName}</p>
                  ) : null}
                </div>
                <div>
                  <FieldLabel htmlFor="settings-email">Email Address</FieldLabel>
                  <input
                    id="settings-email"
                    type="email"
                    className={FIELD_CLASS}
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                  />
                  {fieldErrors.email ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
                  ) : null}
                </div>
                <div>
                  <FieldLabel htmlFor="settings-phone">Phone Number</FieldLabel>
                  <div className="flex overflow-hidden rounded-lg border border-[#D1D5DB] focus-within:border-[color:var(--brand-primary)]">
                    <span className="inline-flex items-center border-r border-[#E5E7EB] bg-[#F8FAFC] px-3 text-sm font-medium text-[#334155]">
                      +1
                    </span>
                    <input
                      id="settings-phone"
                      className="h-10 min-w-0 flex-1 border-0 bg-white px-3 text-sm text-[#0F172A] outline-none"
                      value={form.phone}
                      onChange={(event) => updateField("phone", formatPhoneNumber(event.target.value))}
                    />
                  </div>
                  {fieldErrors.phone ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
                  ) : null}
                </div>
                <div>
                  <FieldLabel htmlFor="settings-birthdate">Birthdate</FieldLabel>
                  <input
                    id="settings-birthdate"
                    type="date"
                    className={FIELD_CLASS}
                    value={form.birthdate}
                    onChange={(event) => updateField("birthdate", event.target.value)}
                  />
                  {fieldErrors.birthdate ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.birthdate}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <SectionTitle>Professional Information</SectionTitle>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="settings-job-title">Job Title</FieldLabel>
                  <input
                    id="settings-job-title"
                    className={FIELD_CLASS}
                    value={form.jobTitle}
                    onChange={(event) => updateField("jobTitle", event.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="settings-department">Department</FieldLabel>
                  <select
                    id="settings-department"
                    className={FIELD_CLASS}
                    value={form.departmentId}
                    onChange={(event) => updateField("departmentId", event.target.value)}
                  >
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.departmentId ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.departmentId}</p>
                  ) : null}
                </div>
                <div>
                  <FieldLabel htmlFor="settings-employee-id">Employee ID</FieldLabel>
                  <input
                    id="settings-employee-id"
                    className={FIELD_CLASS}
                    value={form.employeeId}
                    disabled
                    readOnly
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="settings-location">Location</FieldLabel>
                  <input
                    id="settings-location"
                    className={FIELD_CLASS}
                    value={form.location}
                    placeholder="City, State"
                    onChange={(event) => updateField("location", event.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel htmlFor="settings-bio">Bio</FieldLabel>
                  <textarea
                    id="settings-bio"
                    rows={4}
                    className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
                    value={form.bio}
                    maxLength={1000}
                    onChange={(event) => updateField("bio", event.target.value)}
                  />
                  {fieldErrors.bio ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.bio}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse justify-end gap-2 border-t border-[#E5E7EB] pt-5 sm:flex-row">
              <button type="button" className={WORKER_BTN_OUTLINE} onClick={handleCancel} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className={WORKER_BTN_PRIMARY} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
