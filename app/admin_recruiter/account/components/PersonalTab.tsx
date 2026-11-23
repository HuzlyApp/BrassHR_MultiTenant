"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import AddressAutocompleteField from "@/app/components/signup/AddressAutocompleteField";
import SuccessModal from "@/app/components/SuccessModal";
import SearchableSelectField from "@/app/tenant-onboarding/SearchableSelectField";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { accountRoleLabel, getAccountDisplayName } from "@/lib/account/display-name";
import { syncAccountChecklist } from "@/lib/account/fetch-account-data";
import {
  EMAIL_CHANGE_SUCCESS_MESSAGE,
  normalizeAccountEmail,
  validateEmailChange,
} from "@/lib/account/email-change";
import {
  PHONE_CHANGE_SUCCESS_MESSAGE,
  normalizeAccountPhone,
  validatePhoneChange,
} from "@/lib/account/phone-change";
import { resolvePersonalProfileFields } from "@/lib/account/resolve-personal-profile-fields";
import { isLimitedStaffConsoleRole } from "@/lib/admin/staff-directory-types";
import {
  filterCandidateFieldInput,
} from "@/lib/admin/worker-profile-field-client";
import type { LoginAuthErrorPayload } from "@/lib/auth/login-api-errors";
import {
  LOGIN_OTP_RESEND_COOLDOWN_SECONDS,
  LOGIN_OTP_TTL_SECONDS,
} from "@/lib/auth/login-otp-constants";
import type { AddressSuggestion } from "@/lib/mapbox/address-validation-types";
import { useAddressAutocomplete } from "@/lib/mapbox/use-address-autocomplete";
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
} from "@/lib/tenant/business-info-validation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { getStateCodeFromName, getStateNameFromCode } from "@/lib/us-state-names";
import AccountOtpModal from "./AccountOtpModal";
import { FIELD, FieldLabel, SelectField } from "./account-form-fields";
import { StaffProfilePhotoUpload } from "./StaffProfilePhotoUpload";
import {
  AccountErrorBanner,
  AccountLoadingSkeleton,
  AccountSuccessBanner,
} from "./AccountFormStatus";
import AccountCheckbox from "./AccountCheckbox";

type DepartmentOption = { id: string; name: string };
type StateOption = { code: string; name: string };

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
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [stateRows, setStateRows] = useState<StateOption[]>([]);
  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [locationLoading, setLocationLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [firstNameError, setFirstNameError] = useState<string | null>(null);
  const [lastNameError, setLastNameError] = useState<string | null>(null);
  const [birthdateError, setBirthdateError] = useState<string | null>(null);
  const [jobTitleError, setJobTitleError] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const onNavigate = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const next = new URL(link.href, window.location.href);
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      if (!window.confirm("Discard unsaved profile changes?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onNavigate, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", onNavigate, true); };
  }, [dirty]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailOtpOpen, setEmailOtpOpen] = useState(false);
  const [emailOtpSubmitting, setEmailOtpSubmitting] = useState(false);
  const [emailOtpVerified, setEmailOtpVerified] = useState(false);
  const [emailOtpError, setEmailOtpError] = useState<LoginAuthErrorPayload | null>(null);
  const [emailOtpResendCount, setEmailOtpResendCount] = useState(0);
  const [emailOtpMaxResends, setEmailOtpMaxResends] = useState(5);
  const [emailOtpExpiresInSeconds, setEmailOtpExpiresInSeconds] = useState(LOGIN_OTP_TTL_SECONDS);
  const [emailOtpResendCooldownSeconds, setEmailOtpResendCooldownSeconds] = useState(
    LOGIN_OTP_RESEND_COOLDOWN_SECONDS
  );
  const [pendingEmail, setPendingEmail] = useState("");
  const [emailSuccessOpen, setEmailSuccessOpen] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneOtpOpen, setPhoneOtpOpen] = useState(false);
  const [phoneOtpSubmitting, setPhoneOtpSubmitting] = useState(false);
  const [phoneOtpVerified, setPhoneOtpVerified] = useState(false);
  const [phoneOtpError, setPhoneOtpError] = useState<LoginAuthErrorPayload | null>(null);
  const [phoneOtpResendCount, setPhoneOtpResendCount] = useState(0);
  const [phoneOtpMaxResends, setPhoneOtpMaxResends] = useState(5);
  const [phoneOtpExpiresInSeconds, setPhoneOtpExpiresInSeconds] = useState(LOGIN_OTP_TTL_SECONDS);
  const [phoneOtpResendCooldownSeconds, setPhoneOtpResendCooldownSeconds] = useState(
    LOGIN_OTP_RESEND_COOLDOWN_SECONDS
  );
  const [pendingPhone, setPendingPhone] = useState("");
  const [phoneSuccessOpen, setPhoneSuccessOpen] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);

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

  useEffect(() => {
    const raw = state.trim();
    if (!raw || stateOptions.length === 0) return;
    if (stateOptions.includes(raw)) return;
    const fromCode = getStateNameFromCode(raw);
    if (fromCode && stateOptions.includes(fromCode) && fromCode !== raw) {
      setState(fromCode);
    }
  }, [state, stateOptions]);

  const displayStateValue = useMemo(() => {
    const raw = state.trim();
    if (!raw) return "";
    if (stateOptions.includes(raw)) return raw;
    const fromCode = getStateNameFromCode(raw);
    if (fromCode && stateOptions.includes(fromCode)) return fromCode;
    return raw;
  }, [state, stateOptions]);

  const effectiveStateOptions = useMemo(() => {
    if (!displayStateValue || stateOptions.includes(displayStateValue)) return stateOptions;
    return [...stateOptions, displayStateValue].sort((a, b) => a.localeCompare(b));
  }, [displayStateValue, stateOptions]);

  const effectiveCityOptions = useMemo(() => {
    const current = city.trim();
    if (!current || cityOptions.includes(current)) return cityOptions;
    return [...cityOptions, current].sort((a, b) => a.localeCompare(b));
  }, [city, cityOptions]);

  const stateOptionsUnavailable = !locationLoading && stateOptions.length === 0;

  const addressAutocomplete = useAddressAutocomplete(address, {
    city,
    state: displayStateValue || state,
    zipCode,
  });

  const displayName = getAccountDisplayName(profile, user);
  const roleLabel = accountRoleLabel(profile);
  const isAdminConsole = !isLimitedStaffConsoleRole(profile?.role, profile?.is_admin);
  const canEditProfessionalFields = useMemo(() => {
    if (profile?.is_admin === true) return true;
    const key = (profile?.role ?? "").trim().toLowerCase();
    return (
      key === "admin" ||
      key === "owner" ||
      key === "god_admin" ||
      key === "hr" ||
      key === "manager" ||
      key === "recruiter" ||
      key === "client"
    );
  }, [profile?.is_admin, profile?.role]);

  function handleUserStateChange(value: string) {
    setState(value);
    setCity("");
    if (zipError) setZipError(null);
  }

  function handleSelectUserAddressSuggestion(suggestion: AddressSuggestion) {
    const components = addressAutocomplete.selectSuggestion(suggestion);
    const stateName = components.state
      ? getStateNameFromCode(components.state) ?? components.state
      : "";
    const nextAddress = components.address1 || address;
    setAddress(nextAddress);
    if (sameAsAddress1) setAddressLine2(nextAddress);
    if (components.city) setCity(components.city);
    if (stateName) setState(stateName);
    if (components.zipCode) {
      setZipCode(normalizeBusinessZipInput(components.zipCode).slice(0, 5));
    }
    if (addressError) setAddressError(null);
    if (zipError) setZipError(null);
  }

  function resetFromResolved() {
    setDirty(false);
    setFirstNameError(null);
    setLastNameError(null);
    setBirthdateError(null);
    setJobTitleError(null);
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
    setEmailError(null);
    setPhoneError(null);
    setAddressError(null);
    setZipError(null);
  }

  const accountEmail = (user?.email ?? profile?.email ?? "").trim();

  const parseAuthError = async (res: Response): Promise<LoginAuthErrorPayload> => {
    const json = (await res.json().catch(() => ({}))) as Partial<LoginAuthErrorPayload>;
    return {
      error: typeof json.error === "string" ? json.error : "Something went wrong. Try again.",
      code: json.code ?? "UNKNOWN",
      field: json.field ?? null,
      ...(typeof json.retryAfterSec === "number" ? { retryAfterSec: json.retryAfterSec } : {}),
    };
  };

  const requestEmailChangeOtp = async (newEmailValue: string) => {
    const res = await fetch("/api/account/email-change/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail: newEmailValue }),
    });
    if (!res.ok) throw await parseAuthError(res);

    const json = (await res.json()) as {
      resendCount?: number;
      maxResends?: number;
      expiresInSeconds?: number;
      resendAvailableInSeconds?: number;
      newEmail?: string;
    };

    setEmailOtpResendCount(typeof json.resendCount === "number" ? json.resendCount : 0);
    setEmailOtpMaxResends(typeof json.maxResends === "number" ? json.maxResends : 5);
    setEmailOtpExpiresInSeconds(
      typeof json.expiresInSeconds === "number" ? json.expiresInSeconds : LOGIN_OTP_TTL_SECONDS
    );
    setEmailOtpResendCooldownSeconds(
      typeof json.resendAvailableInSeconds === "number"
        ? json.resendAvailableInSeconds
        : LOGIN_OTP_RESEND_COOLDOWN_SECONDS
    );
    if (typeof json.newEmail === "string") {
      setPendingEmail(json.newEmail);
    }
  };

  async function handleUpdateEmailAddress() {
    if (!accountEmail) {
      toast.error("No email is available on this account to send a verification code.");
      return;
    }

    const validationError = validateEmailChange(workEmail, accountEmail);
    if (validationError) {
      setEmailError(validationError);
      toast.error(validationError);
      return;
    }

    setEmailBusy(true);
    setEmailError(null);
    setEmailOtpError(null);
    setEmailOtpVerified(false);
    try {
      const normalized = normalizeAccountEmail(workEmail);
      setPendingEmail(normalized);
      await requestEmailChangeOtp(normalized);
      setEmailOtpOpen(true);
    } catch (err) {
      if (err && typeof err === "object" && "error" in err && typeof err.error === "string") {
        setEmailError(err.error);
        toast.error(err.error);
      } else {
        toast.error("Could not start email update.");
      }
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleEmailOtpSendAgain() {
    setEmailOtpError(null);
    try {
      await requestEmailChangeOtp(pendingEmail || workEmail);
    } catch (err) {
      if (err && typeof err === "object" && "error" in err) {
        setEmailOtpError(err as LoginAuthErrorPayload);
        throw err;
      }
      const payload: LoginAuthErrorPayload = {
        error: "Could not send verification code. Try again.",
        code: "OTP_SEND_FAILED",
        field: null,
      };
      setEmailOtpError(payload);
      throw payload;
    }
  }

  async function handleEmailOtpVerify(codeValue: string) {
    setEmailOtpSubmitting(true);
    setEmailOtpError(null);
    try {
      const confirmRes = await fetch("/api/account/email-change/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeValue,
          newEmail: pendingEmail || workEmail,
        }),
      });
      if (!confirmRes.ok) throw await parseAuthError(confirmRes);

      const json = (await confirmRes.json().catch(() => ({}))) as { email?: string };
      setEmailOtpVerified(true);
      if (typeof json.email === "string") {
        setWorkEmail(json.email);
      }
      await supabaseBrowser.auth.refreshSession();
      await refresh();
      setEmailOtpOpen(false);
      setEmailOtpVerified(false);
      setPendingEmail("");
      setEmailSuccessOpen(true);
      toast.success(EMAIL_CHANGE_SUCCESS_MESSAGE);
    } catch (err) {
      if (err && typeof err === "object" && "error" in err && typeof err.error === "string") {
        setEmailOtpError(err as LoginAuthErrorPayload);
        setEmailOtpVerified(false);
      } else {
        setEmailOtpError({
          error: "Could not update email.",
          code: "UNKNOWN",
          field: null,
        });
        setEmailOtpVerified(false);
      }
    } finally {
      setEmailOtpSubmitting(false);
    }
  }

  const requestPhoneChangeOtp = async (newPhoneValue: string) => {
    const res = await fetch("/api/account/phone-change/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPhone: newPhoneValue }),
    });
    if (!res.ok) throw await parseAuthError(res);

    const json = (await res.json()) as {
      resendCount?: number;
      maxResends?: number;
      expiresInSeconds?: number;
      resendAvailableInSeconds?: number;
      newPhone?: string;
    };

    setPhoneOtpResendCount(typeof json.resendCount === "number" ? json.resendCount : 0);
    setPhoneOtpMaxResends(typeof json.maxResends === "number" ? json.maxResends : 5);
    setPhoneOtpExpiresInSeconds(
      typeof json.expiresInSeconds === "number" ? json.expiresInSeconds : LOGIN_OTP_TTL_SECONDS
    );
    setPhoneOtpResendCooldownSeconds(
      typeof json.resendAvailableInSeconds === "number"
        ? json.resendAvailableInSeconds
        : LOGIN_OTP_RESEND_COOLDOWN_SECONDS
    );
    if (typeof json.newPhone === "string") {
      setPendingPhone(json.newPhone);
    }
  };

  async function handleUpdatePhoneNumber() {
    if (!accountEmail) {
      toast.error("No email is available on this account to send a verification code.");
      return;
    }

    const validationError = validatePhoneChange(phone, resolvedFields.phone);
    if (validationError) {
      setPhoneError(validationError);
      toast.error(validationError);
      return;
    }

    setPhoneBusy(true);
    setPhoneError(null);
    setPhoneOtpError(null);
    setPhoneOtpVerified(false);
    try {
      const normalized = normalizeAccountPhone(phone);
      setPendingPhone(normalized);
      await requestPhoneChangeOtp(normalized);
      setPhoneOtpOpen(true);
    } catch (err) {
      if (err && typeof err === "object" && "error" in err && typeof err.error === "string") {
        setPhoneError(err.error);
        toast.error(err.error);
      } else {
        toast.error("Could not start phone update.");
      }
    } finally {
      setPhoneBusy(false);
    }
  }

  async function handlePhoneOtpSendAgain() {
    setPhoneOtpError(null);
    try {
      await requestPhoneChangeOtp(pendingPhone || phone);
    } catch (err) {
      if (err && typeof err === "object" && "error" in err) {
        setPhoneOtpError(err as LoginAuthErrorPayload);
        throw err;
      }
      const payload: LoginAuthErrorPayload = {
        error: "Could not send verification code. Try again.",
        code: "OTP_SEND_FAILED",
        field: null,
      };
      setPhoneOtpError(payload);
      throw payload;
    }
  }

  async function handlePhoneOtpVerify(codeValue: string) {
    setPhoneOtpSubmitting(true);
    setPhoneOtpError(null);
    try {
      const confirmRes = await fetch("/api/account/phone-change/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeValue,
          newPhone: pendingPhone || phone,
        }),
      });
      if (!confirmRes.ok) throw await parseAuthError(confirmRes);

      const json = (await confirmRes.json().catch(() => ({}))) as { phone?: string };
      setPhoneOtpVerified(true);
      if (typeof json.phone === "string") {
        setPhone(json.phone);
      }
      await refresh();
      setPhoneOtpOpen(false);
      setPhoneOtpVerified(false);
      setPendingPhone("");
      setPhoneSuccessOpen(true);
      toast.success(PHONE_CHANGE_SUCCESS_MESSAGE);
    } catch (err) {
      if (err && typeof err === "object" && "error" in err && typeof err.error === "string") {
        setPhoneOtpError(err as LoginAuthErrorPayload);
        setPhoneOtpVerified(false);
      } else {
        setPhoneOtpError({
          error: "Could not update phone number.",
          code: "UNKNOWN",
          field: null,
        });
        setPhoneOtpVerified(false);
      }
    } finally {
      setPhoneOtpSubmitting(false);
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    setEmailError(null);
    setPhoneError(null);
    setAddressError(null);
    setZipError(null);

    setFirstNameError(!firstName.trim() ? "First name is required." : null);
    setLastNameError(!lastName.trim() ? "Last name is required." : null);
    setBirthdateError(!birthdate.trim() ? "Birthdate is required." : null);
    setJobTitleError(canEditProfessionalFields && !jobTitle.trim() ? "Job title is required." : null);
    if (!firstName.trim() || !lastName.trim() || !birthdate.trim() || (canEditProfessionalFields && !jobTitle.trim())) {
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

    setAddressError(nextAddressError);
    setZipError(nextZipError);

    if (nextAddressError || nextZipError) {
      setSaving(false);
      return;
    }

    // Existing phone changes require OTP via "Update phone number".
    // First-time add (no saved phone yet) can still save with the profile form.
    let phoneToSave: string | null = null;
    if (resolvedFields.phone.trim()) {
      phoneToSave = formatPhoneNumber(resolvedFields.phone);
    } else if (phone.trim()) {
      const firstPhoneError = validatePhoneChange(phone, "");
      if (firstPhoneError) {
        setPhoneError(firstPhoneError);
        setSaving(false);
        return;
      }
      phoneToSave = normalizeAccountPhone(phone);
    }

    const zipToSave = zipCode.trim() ? normalizeBusinessZipInput(zipCode).slice(0, 5) : null;
    const address2ToSave = sameAsAddress1
      ? address.trim() || null
      : addressLine2.trim() || null;

    try {
      // Email changes require OTP via "Update email address" — keep auth email here.
      const trimmedEmail = accountEmail;

      const nextJobTitle = canEditProfessionalFields
        ? jobTitle.trim() || null
        : resolvedFields.jobTitle.trim() || null;
      const nextDepartmentId = canEditProfessionalFields
        ? departmentId.trim() || null
        : resolvedFields.departmentId.trim() || null;
      const nextEmployeeId = canEditProfessionalFields
        ? employeeId.trim() || null
        : resolvedFields.employeeId.trim() || null;
      const nextWorkLocation = canEditProfessionalFields
        ? workLocation.trim() || null
        : resolvedFields.workLocation.trim() || null;

      const { error: profileError } = await supabaseBrowser
        .from("users")
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          preferred_name: preferredName.trim() || null,
          phone: phoneToSave,
          birthdate: birthdate.trim() || null,
          job_title: nextJobTitle,
          department_id: nextDepartmentId,
          employee_id: nextEmployeeId,
          work_location: nextWorkLocation,
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
          job_title: nextJobTitle,
          department_id: nextDepartmentId,
          employee_id: nextEmployeeId,
          work_location: nextWorkLocation,
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
      setDirty(false);
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
    <>
    <form noValidate onSubmit={handleSubmit} onChange={() => setDirty(true)} className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">Profile</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Manage your personal and professional information.
        </p>
      </div>

      {error ? <AccountErrorBanner message={error} /> : null}
      {saveError ? <AccountErrorBanner message={saveError} /> : null}
      {saveSuccess ? <AccountSuccessBanner message={saveSuccess} /> : null}

      <section className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-5">
        <div
          className={
            isAdminConsole
              ? "flex flex-col gap-4 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between"
              : undefined
          }
        >
          <StaffProfilePhotoUpload
            displayName={displayName}
            photoUrl={photoUrl}
            onPhotoUpdated={setPhotoUrl}
            variant="hero"
          />
          {isAdminConsole ? (
            <div className="flex shrink-0 flex-col items-start gap-2 min-[640px]:items-end">
              <div className="text-left min-[640px]:text-right">
                <p className="text-lg font-semibold text-[#012352]">{displayName}</p>
                <p className="mt-0.5 text-sm text-[#64748B]">{roleLabel}</p>
              </div>
              <span className="inline-flex h-9 items-center rounded-full border border-[#E2E8F0] bg-white px-4 text-sm font-normal text-[#64748B]">
                Active
              </span>
            </div>
          ) : null}
        </div>
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
              onChange={(e) => { setFirstName(e.target.value); setFirstNameError(null); }}
              maxLength={PERSON_NAME_MAX_LENGTH}
              className={`${FIELD}${firstNameError ? " border-[#FCA5A5] focus:border-[#EF4444] focus:ring-[#EF4444]" : ""}`}
              required
              aria-invalid={Boolean(firstNameError)}
            />
            {firstNameError ? <p role="alert" className="mt-1 text-xs text-[#B91C1C]">{firstNameError}</p> : null}
          </label>
          <label className="block">
            <FieldLabel>
              Last Name
              <RequiredMark />
            </FieldLabel>
            <input
              type="text"
              value={lastName}
              onChange={(e) => { setLastName(e.target.value); setLastNameError(null); }}
              maxLength={PERSON_NAME_MAX_LENGTH}
              className={`${FIELD}${lastNameError ? " border-[#FCA5A5] focus:border-[#EF4444] focus:ring-[#EF4444]" : ""}`}
              required
              aria-invalid={Boolean(lastNameError)}
            />
            {lastNameError ? <p role="alert" className="mt-1 text-xs text-[#B91C1C]">{lastNameError}</p> : null}
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
          <div className="block">
            <FieldLabel>Email Address</FieldLabel>
            <div
              className={`flex overflow-hidden rounded-md border bg-white focus-within:border-[color:var(--brand-primary)] focus-within:ring-1 focus-within:ring-[color:var(--brand-primary)] ${
                emailError ? "border-[#FCA5A5]" : "border-[#D1D5DB]"
              }`}
            >
              <input
                type="email"
                value={workEmail}
                onChange={(e) => {
                  setWorkEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                className="h-11 min-w-0 flex-1 border-0 bg-white px-3 text-sm text-[#111827] outline-none"
                autoComplete="email"
              />
              {accountEmail ? (
                <button
                  type="button"
                  onClick={() => void handleUpdateEmailAddress()}
                  disabled={emailBusy || emailOtpSubmitting}
                  className="shrink-0 px-3 text-sm font-medium underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ color: "var(--brand-secondary, #012352)" }}
                >
                  {emailBusy ? "Sending..." : "Update email address"}
                </button>
              ) : null}
            </div>
            {accountEmail ? (
              <p className="mt-1 text-xs text-[#64748B]">
                We&apos;ll send a verification code to your current email before saving a new
                address.
              </p>
            ) : null}
            {emailError ? <p className="mt-1 text-xs text-[#B91C1C]">{emailError}</p> : null}
          </div>
          <div className="block">
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
              {resolvedFields.phone.trim() ? (
                <button
                  type="button"
                  onClick={() => void handleUpdatePhoneNumber()}
                  disabled={phoneBusy || phoneOtpSubmitting}
                  className="shrink-0 px-3 text-sm font-medium underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ color: "var(--brand-secondary, #012352)" }}
                >
                  {phoneBusy ? "Sending..." : "Update phone number"}
                </button>
              ) : null}
            </div>
            {resolvedFields.phone.trim() ? (
              <p className="mt-1 text-xs text-[#64748B]">
                We&apos;ll send a verification code to your email before saving a new phone number.
              </p>
            ) : null}
            {phoneError ? <p className="mt-1 text-xs text-[#B91C1C]">{phoneError}</p> : null}
          </div>
          <label className="block">
            <FieldLabel>Birthdate</FieldLabel>
            <input
              type="date"
              aria-invalid={Boolean(birthdateError)}
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
            {birthdateError ? <p role="alert" className="mt-1 text-xs text-[#B91C1C]">{birthdateError}</p> : null}
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Professional Information">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          {!canEditProfessionalFields ? (
            <p className="sm:col-span-2 text-xs text-[#64748B]">
              Only HR, Recruiter, or Manager can update job title, department, employee ID, and
              location. You can still edit your bio.
            </p>
          ) : null}
          <label className="block">
            <FieldLabel>Job Title</FieldLabel>
            <input
              type="text"
              value={jobTitle}
              disabled={!canEditProfessionalFields}
              aria-invalid={Boolean(jobTitleError)}
              onChange={(e) => {
                setJobTitle(e.target.value);
                if (jobTitleError) setJobTitleError(null);
              }}
              className={`${FIELD}${jobTitleError ? " border-[#FCA5A5] focus:border-[#EF4444] focus:ring-[#EF4444]" : ""} disabled:cursor-not-allowed disabled:bg-[#F8FAFC]`}
            />
            {jobTitleError ? <p role="alert" className="mt-1 text-xs text-[#B91C1C]">{jobTitleError}</p> : null}
          </label>
          <SelectField
            label="Department"
            value={departmentId}
            onChange={setDepartmentId}
            disabled={!canEditProfessionalFields}
          >
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
              disabled={!canEditProfessionalFields}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={`${FIELD} disabled:cursor-not-allowed disabled:bg-[#F8FAFC]`}
            />
          </label>
          <label className="block">
            <FieldLabel>Location</FieldLabel>
            <input
              type="text"
              value={workLocation}
              disabled={!canEditProfessionalFields}
              onChange={(e) => setWorkLocation(e.target.value)}
              placeholder="City, State"
              className={`${FIELD} disabled:cursor-not-allowed disabled:bg-[#F8FAFC]`}
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

      <SectionCard title="Your Address">
        <div className="flex flex-col gap-5">
          <AddressAutocompleteField
            variant="facility"
            label="Address Line 1"
            value={address}
            onChange={(value) => {
              const next = filterCandidateFieldInput("address", value);
              setAddress(next);
              if (sameAsAddress1) setAddressLine2(next);
              addressAutocomplete.resetVerification();
              if (addressError) setAddressError(null);
            }}
            onSelectSuggestion={handleSelectUserAddressSuggestion}
            suggestions={addressAutocomplete.suggestions}
            isLoading={addressAutocomplete.isLoading}
            isOpen={addressAutocomplete.isOpen}
            onFocus={addressAutocomplete.openSuggestions}
            onCloseSuggestions={addressAutocomplete.closeSuggestions}
            isVerified={addressAutocomplete.isAddressVerified}
            searchError={addressAutocomplete.searchError}
            placeholder="Start typing your street address"
            helperText="Your personal address — separate from company location"
            error={addressError}
          />

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
            <SearchableSelectField
              label="City"
              allowCustom
              disabled={!displayStateValue || stateOptionsUnavailable}
              loading={citiesLoading}
              value={city}
              onChange={setCity}
              placeholder={
                stateOptionsUnavailable
                  ? "No states found"
                  : !displayStateValue
                    ? "Select state first"
                    : citiesLoading
                      ? "Loading…"
                      : "Search or enter city"
              }
              searchPlaceholder="Type any city"
              options={effectiveCityOptions}
              emptyMessage="Type a city name and press Enter."
            />
            <SearchableSelectField
              label="State / Province"
              loading={locationLoading}
              disabled={locationLoading || stateOptionsUnavailable}
              value={displayStateValue}
              onChange={handleUserStateChange}
              placeholder={
                locationLoading
                  ? "Loading…"
                  : stateOptionsUnavailable
                    ? "No states found"
                    : "Search state"
              }
              searchPlaceholder="Type to search states"
              options={effectiveStateOptions}
              emptyMessage="No states found. Try another search."
            />
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

    <AccountOtpModal
      open={emailOtpOpen}
      email={accountEmail}
      submitting={emailOtpSubmitting}
      verified={emailOtpVerified}
      authError={emailOtpError}
      resendCount={emailOtpResendCount}
      maxResends={emailOtpMaxResends}
      expiresInSeconds={emailOtpExpiresInSeconds}
      resendCooldownSeconds={emailOtpResendCooldownSeconds}
      onClose={() => {
        if (emailOtpSubmitting) return;
        setEmailOtpOpen(false);
        setEmailOtpError(null);
        setEmailOtpVerified(false);
      }}
      onClearError={() => setEmailOtpError(null)}
      onVerify={handleEmailOtpVerify}
      onSendAgain={handleEmailOtpSendAgain}
    />

    <SuccessModal
      open={emailSuccessOpen}
      onClose={() => setEmailSuccessOpen(false)}
      title="Email updated"
      message={EMAIL_CHANGE_SUCCESS_MESSAGE}
      autoCloseMs={4000}
    />

    <AccountOtpModal
      open={phoneOtpOpen}
      email={accountEmail}
      submitting={phoneOtpSubmitting}
      verified={phoneOtpVerified}
      authError={phoneOtpError}
      resendCount={phoneOtpResendCount}
      maxResends={phoneOtpMaxResends}
      expiresInSeconds={phoneOtpExpiresInSeconds}
      resendCooldownSeconds={phoneOtpResendCooldownSeconds}
      onClose={() => {
        if (phoneOtpSubmitting) return;
        setPhoneOtpOpen(false);
        setPhoneOtpError(null);
        setPhoneOtpVerified(false);
      }}
      onClearError={() => setPhoneOtpError(null)}
      onVerify={handlePhoneOtpVerify}
      onSendAgain={handlePhoneOtpSendAgain}
    />

    <SuccessModal
      open={phoneSuccessOpen}
      onClose={() => setPhoneSuccessOpen(false)}
      title="Phone updated"
      message={PHONE_CHANGE_SUCCESS_MESSAGE}
      autoCloseMs={4000}
    />
  </>
  );
}
