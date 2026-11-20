"use client";

import Image from "next/image";
import Link from "next/link";
import RedirectionProgressModal from "@/app/components/RedirectionProgressModal";
import { PasswordVisibilityToggle } from "@/app/components/PasswordVisibilityToggle";
import SignupStepper, { resolveSignupStepperPhase } from "@/app/components/SignupStepper";
import SearchableSelectField from "@/app/tenant-onboarding/SearchableSelectField";
import { INDUSTRY_OPTIONS } from "@/app/tenant-onboarding/constants";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { PERSON_NAME_MAX_LENGTH } from "@/lib/person-name";
import type { SignupStateOption } from "@/lib/signup/owner-signup";
import { getStateCodeFromName } from "@/lib/us-state-names";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import {
  brandingToCssVars,
  defaultTenantBranding,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";
import { OWNER_SIGNUP_EMAIL_TAKEN_MESSAGE } from "@/lib/tenant/tenant-email-uniqueness";
import {
  clearTenantSignupDraft,
  readTenantSignupDraft,
  writeTenantSignupDraft,
} from "@/lib/signup/tenant-signup-draft";
import { ADMIN_LAUNCH_PAD_ROUTE } from "@/lib/signup/smb-post-signup";
import { formatPhoneNumber } from "@/lib/phone";
import { phoneValidationMessage } from "@/lib/tenant/business-info-validation";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };
const NAVY = "#012352";
const LABEL = "#6B7280";

const FALLBACK_STATE_OPTIONS = [
  "California",
  "Arizona",
  "Texas",
  "New York",
  "Florida",
  "Illinois",
  "Washington",
];

type SignupForm = {
  firstName: string;
  lastName: string;
  workEmail: string;
  phone: string;
  companyName: string;
  companyWebsite: string;
  /** Primary industry (first selected). Kept for draft/API compatibility. */
  industry: string;
  /** All selected industries for multi-select signup. */
  industries: string[];
  isStaffingCompany: boolean | null;
  city: string;
  state: string;
  jobTitle: string;
  zipCode: string;
  address1: string;
  address2: string;
  hqState: string;
  primaryCity: string;
  primaryState: string;
};

type SignupStep = "personal" | "company";

type PasswordRule = {
  label: string;
  passed: boolean;
};

const initialForm: SignupForm = {
  firstName: "",
  lastName: "",
  workEmail: "",
  phone: "",
  companyName: "",
  companyWebsite: "",
  industry: "",
  industries: [],
  isStaffingCompany: null,
  city: "",
  state: "",
  jobTitle: "",
  zipCode: "",
  address1: "",
  address2: "",
  hqState: "",
  primaryCity: "",
  primaryState: "",
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function checkOwnerSignupEmailAvailable(email: string): Promise<boolean> {
  const res = await fetch(`/api/auth/signup/check-email?email=${encodeURIComponent(email)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not validate email");
  const payload = (await res.json()) as { available?: boolean };
  return payload.available === true;
}

function getPasswordRules(password: string): PasswordRule[] {
  return [
    { label: "At least 12 characters", passed: password.length >= 12 },
    { label: "One uppercase letter", passed: /[A-Z]/.test(password) },
    { label: "One lowercase letter", passed: /[a-z]/.test(password) },
    { label: "One number", passed: /\d/.test(password) },
  ];
}

function FieldLabel({
  children,
  required = false,
  optional = false,
}: {
  children: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="mb-2 flex w-full items-center justify-between">
      <label className="block text-[12px] font-normal leading-4" style={{ ...interStyle, color: LABEL }}>
        {children}
        {required ? <span className="ml-0.5 text-[#E11D48]">*</span> : null}
      </label>
      {optional ? (
        <span className="text-[10px] font-normal leading-[15px] text-[#94A3B8]" style={interStyle}>
          Optional
        </span>
      ) : null}
    </div>
  );
}

const inputClass =
  "h-9 w-full rounded-lg border bg-white px-2.5 text-[12px] font-normal leading-4 text-black outline-none transition placeholder:text-[#94A3B8]";

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  optional,
  type = "text",
  error,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  type?: "text" | "email";
  error?: string | null;
  maxLength?: number;
}) {
  return (
    <div className="w-full">
      <FieldLabel required={required} optional={optional}>
        {label}
      </FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        style={interStyle}
        className={`${inputClass} ${
          error
            ? "border-[#E11D48] focus:border-[#E11D48] focus:ring-2 focus:ring-[#E11D48]/15"
            : "border-[#CBD5E1] focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B41]/20"
        }`}
      />
      {error ? (
        <p className="mt-1.5 text-[12px] leading-4 text-[#E11D48]" style={interStyle}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="w-full">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={interStyle}
          className={`${inputClass} pr-10 ${
            error
              ? "border-[#E11D48] focus:border-[#E11D48] focus:ring-2 focus:ring-[#E11D48]/15"
              : "border-[#CBD5E1] focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B41]/20"
          }`}
        />
        <PasswordVisibilityToggle
          visible={visible}
          onToggle={() => setVisible((current) => !current)}
          label={label}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-[12px] leading-4 text-[#E11D48]" style={interStyle}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function StaffingOption({
  selected,
  title,
  subtitle,
  onSelect,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-1 flex-col gap-2.5 rounded-lg border p-2 text-left transition ${
        selected ? "border-[#E5E7EB] bg-[#F3F4F6]" : "border-[#E5E7EB] bg-white"
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
            selected ? "border-[#012352] bg-[#012352]" : "border-[#CBD5E1] bg-white"
          }`}
        >
          {selected ? <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} /> : null}
        </span>
        <span className="text-[12px] font-normal leading-4 text-[#374151]" style={interStyle}>
          {title}
        </span>
      </span>
      <span className="text-[12px] font-normal leading-4 text-[#374151]" style={interStyle}>
        {subtitle}
      </span>
    </button>
  );
}

export default function SignupPage() {
  const [form, setForm] = useState<SignupForm>(initialForm);
  const [step, setStep] = useState<SignupStep>("personal");
  const [password, setPassword] = useState("");
  const [verifyPassword, setVerifyPassword] = useState("");
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [personalSubmitAttempted, setPersonalSubmitAttempted] = useState(false);
  const [companySubmitAttempted, setCompanySubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stateRows, setStateRows] = useState<SignupStateOption[]>([]);
  const [stateOptions, setStateOptions] = useState<string[]>(FALLBACK_STATE_OPTIONS);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [emailCheckStatus, setEmailCheckStatus] = useState<"idle" | "checking" | "taken" | "available">(
    "idle"
  );
  const emailCheckRequestId = useRef(0);
  const [brand, setBrand] = useState<TenantBranding>(() => defaultTenantBranding());
  const [redirecting, setRedirecting] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);

  useLayoutEffect(() => {
    const draft = readTenantSignupDraft();
    if (draft) {
      setForm({ ...initialForm, ...draft.form });
      setStep(draft.step === "company" ? "company" : "personal");
      setPassword(draft.password);
      setVerifyPassword(draft.verifyPassword);
    }
    setDraftHydrated(true);
  }, []);

  useLayoutEffect(() => {
    if (!draftHydrated || redirecting) return;
    writeTenantSignupDraft({
      form,
      step,
      password,
      verifyPassword,
      termsAccepted: true,
    });
  }, [draftHydrated, form, step, password, verifyPassword, redirecting]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [step]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/tenant-branding?slug=braas-hr", { cache: "no-store" });
        const payload = (await res.json()) as { branding?: TenantBranding };
        if (alive && payload.branding) setBrand(payload.branding);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const previousHtmlBg = document.documentElement.style.backgroundColor;
    const previousBodyBg = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = "#F3F4F6";
    document.body.style.backgroundColor = "#F3F4F6";
    return () => {
      document.documentElement.style.backgroundColor = previousHtmlBg;
      document.body.style.backgroundColor = previousBodyBg;
    };
  }, []);

  useEffect(() => {
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
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedStateCode = useMemo(() => {
    const fromRows = stateRows.find((row) => row.name === form.state)?.code;
    return fromRows ?? getStateCodeFromName(form.state) ?? "";
  }, [form.state, stateRows]);

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
  }, [selectedStateCode]);

  useEffect(() => {
    const email = form.workEmail.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      setEmailCheckStatus("idle");
      return;
    }

    const requestId = ++emailCheckRequestId.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        setEmailCheckStatus("checking");
        try {
          const res = await fetch(`/api/auth/signup/check-email?email=${encodeURIComponent(email)}`);
          const payload = (await res.json()) as { available?: boolean };
          if (emailCheckRequestId.current !== requestId) return;
          if (!res.ok) {
            setEmailCheckStatus("idle");
            return;
          }
          setEmailCheckStatus(
            payload.available === false ? "taken" : payload.available === true ? "available" : "idle"
          );
        } catch {
          if (emailCheckRequestId.current === requestId) setEmailCheckStatus("idle");
        }
      })();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [form.workEmail]);

  const emailTaken = emailCheckStatus === "taken";
  const emailError = emailTaken
    ? OWNER_SIGNUP_EMAIL_TAKEN_MESSAGE
    : touchedEmail && form.workEmail.trim() && !isValidEmail(form.workEmail)
      ? "Enter a valid email"
      : null;

  const phoneError = useMemo(() => {
    if (!personalSubmitAttempted && !form.phone.trim()) return null;
    return phoneValidationMessage(form.phone, { required: false });
  }, [form.phone, personalSubmitAttempted]);

  const effectiveCityOptions = useMemo(() => {
    const city = form.city.trim();
    if (!city || cityOptions.includes(city)) return cityOptions;
    return [...cityOptions, city].sort((a, b) => a.localeCompare(b));
  }, [cityOptions, form.city]);

  const passwordRules = useMemo(() => getPasswordRules(password), [password]);
  const passwordIsStrongEnough = passwordRules.every((rule) => rule.passed);
  const passwordsMatch = password.length > 0 && password === verifyPassword;
  const verifyPasswordError =
    (personalSubmitAttempted || verifyPassword.trim()) && password !== verifyPassword
      ? "Passwords do not match."
      : null;
  const passwordError =
    personalSubmitAttempted && password && !passwordIsStrongEnough
      ? "Password must be at least 12 characters with upper, lower, and a number."
      : null;

  const canContinuePersonal =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    isValidEmail(form.workEmail) &&
    !emailTaken &&
    !phoneError &&
    passwordIsStrongEnough &&
    passwordsMatch;

  const selectedIndustries =
    form.industries.length > 0
      ? form.industries
      : form.industry.trim()
        ? [form.industry.trim()]
        : [];
  const primaryIndustry = selectedIndustries[0] ?? "";

  const canCreateAccount =
    form.companyName.trim().length > 0 &&
    selectedIndustries.length > 0 &&
    form.isStaffingCompany !== null &&
    form.state.trim().length > 0 &&
    form.city.trim().length > 0;

  const update = <K extends keyof SignupForm>(key: K, value: SignupForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const continueToCompany = () => {
    setTouchedEmail(true);
    setPersonalSubmitAttempted(true);
    setSubmitError(null);

    void (async () => {
      const snapshot = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.workEmail.trim().toLowerCase(),
        phone: form.phone,
        password,
        verifyPassword,
      };

      if (!snapshot.firstName || !snapshot.lastName) return;
      if (!isValidEmail(snapshot.email)) return;

      const phoneOk = !phoneValidationMessage(snapshot.phone, { required: false });
      if (!phoneOk) return;

      const rules = getPasswordRules(snapshot.password);
      if (!rules.every((rule) => rule.passed) || snapshot.password !== snapshot.verifyPassword) {
        return;
      }

      setEmailCheckStatus("checking");
      try {
        const emailAvailable = await checkOwnerSignupEmailAvailable(snapshot.email);
        setEmailCheckStatus(emailAvailable ? "available" : "taken");
        if (!emailAvailable) return;
      } catch {
        setEmailCheckStatus("idle");
        setSubmitError("Could not validate email. Check your connection and try again.");
        return;
      }

      setStep("company");
    })();
  };

  const createAccount = () => {
    setCompanySubmitAttempted(true);
    if (!canCreateAccount || submitting) return;

    void (async () => {
      setSubmitting(true);
      setSubmitError(null);
      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            workEmail: form.workEmail,
            phone: form.phone,
            companyName: form.companyName,
            companyWebsite: form.companyWebsite,
            industry: primaryIndustry,
            industries: selectedIndustries,
            isStaffingCompany: form.isStaffingCompany,
            jobTitle: form.jobTitle.trim() || "Owner",
            city: form.city,
            state: form.state,
            zipCode: form.zipCode,
            address1: form.address1,
            address2: form.address2,
            hqState: form.state,
            primaryCity: form.city,
            primaryState: form.state,
            password,
          }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          waitlisted?: boolean;
        };
        if (!res.ok) {
          setSubmitError(payload.error ?? "Could not create your account. Try again.");
          setSubmitting(false);
          return;
        }

        const email = form.workEmail.trim().toLowerCase();
        const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setSubmitError(
            signInError.message ||
              "Account created, but sign-in failed. Use Sign In to continue to tenant setup."
          );
          setSubmitting(false);
          return;
        }

        const {
          data: { session },
        } = await supabaseBrowser.auth.getSession();
        if (!session) {
          setSubmitError("Account created, but your session could not be started. Try Sign In.");
          setSubmitting(false);
          return;
        }

        try {
          localStorage.setItem(
            "braasOwnerSignupDraft",
            JSON.stringify({
              ...form,
              passwordSet: true,
              companyName: form.companyName,
              companyWebsite: form.companyWebsite,
              industry: primaryIndustry,
              industries: selectedIndustries,
              isStaffingCompany: form.isStaffingCompany,
              phone: form.phone,
            })
          );
          // Explicit handoff for tenant-onboarding industry tags (survives draft clears).
          sessionStorage.setItem(
            "braasSignupIndustries",
            JSON.stringify(selectedIndustries)
          );
          sessionStorage.setItem("braasSignupCompanyName", form.companyName.trim());
        } catch {
          /* ignore storage errors */
        }

        if (payload.waitlisted) {
          setRedirecting(true);
          clearTenantSignupDraft();
          window.setTimeout(() => {
            window.location.assign("/signup/waitlist");
          }, 80);
          return;
        }

        // Both editions provision their workspace before opening Launch Pad.
        const provisionRes = await fetch("/api/auth/signup/provision-smb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: form.companyName,
            companyWebsite: form.companyWebsite,
            industry: primaryIndustry,
            industries: selectedIndustries,
            city: form.city,
            state: form.state,
            phone: form.phone,
            isStaffingCompany: form.isStaffingCompany,
          }),
        });
        const provisionPayload = (await provisionRes.json().catch(() => ({}))) as {
          error?: string;
          redirectTo?: string;
        };
        if (!provisionRes.ok) {
          setSubmitError(
            provisionPayload.error ?? "Account created, but workspace setup failed. Try Sign In."
          );
          setSubmitting(false);
          return;
        }
        setRedirecting(true);
        clearTenantSignupDraft();
        window.setTimeout(() => {
          window.location.assign(provisionPayload.redirectTo ?? ADMIN_LAUNCH_PAD_ROUTE);
        }, 80);
        return;
      } catch {
        setSubmitError("Something went wrong. Please try again.");
        setSubmitting(false);
      }
    })();
  };

  const title = step === "personal" ? "Create your account" : "Your Company";
  const subtitle =
    step === "personal"
      ? "Takes about a minute"
      : "We use this to set your edition and check service area.";

  return (
    <TenantBrandingProvider branding={brand}>
    <main
      className="min-h-screen w-full overflow-x-hidden bg-[#F3F4F6]"
      style={{ ...(brandingToCssVars(brand) as CSSProperties), backgroundColor: "#F3F4F6" }}
    >
      {redirecting ? <RedirectionProgressModal /> : null}

      <section className="mx-auto flex min-h-screen w-full max-w-[1440px] items-start justify-center px-5 py-10 sm:px-10 sm:py-16 lg:px-20 lg:py-20">
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (step === "personal") continueToCompany();
            else createAccount();
          }}
          className="flex w-full max-w-[400px] flex-col gap-[30px]"
        >
          <div className="flex w-full flex-col gap-2.5">
            <div className="flex h-[115px] w-full items-center justify-center">
              <Image
                src={brand.signupLogoUrl}
                alt={brand.companyName}
                width={160}
                height={82}
                priority
                className="h-[82px] w-[160px] object-contain"
              />
            </div>

            <div className="flex w-full flex-col items-center gap-1 text-center">
              <h1 className="w-full text-[24px] font-semibold leading-8 text-black" style={interStyle}>
                {title}
              </h1>
              <p className="w-full text-[14px] font-normal leading-5 text-[#6B7280]" style={interStyle}>
                {subtitle}
              </p>
            </div>

            <div className="w-full py-[30px]">
              <SignupStepper
                phase={resolveSignupStepperPhase({ formStep: step, redirecting })}
                className="!mt-0"
              />
            </div>
          </div>

          {submitError ? (
            <p
              className="rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-3.5 py-3 text-[12px] leading-4 text-[#BE123C]"
              style={interStyle}
            >
              {submitError}
            </p>
          ) : null}

          {step === "personal" ? (
            <>
              <div className="flex w-full flex-col gap-6 rounded-xl border border-[#E5E7EB] bg-white px-5 py-[30px]">
                <div className="flex gap-3.5">
                  <TextField
                    label="First Name"
                    required
                    value={form.firstName}
                    onChange={(value) => update("firstName", value)}
                    placeholder="First Name"
                    maxLength={PERSON_NAME_MAX_LENGTH}
                    error={
                      personalSubmitAttempted && !form.firstName.trim() ? "First name is required." : null
                    }
                  />
                  <TextField
                    label="Last Name"
                    required
                    value={form.lastName}
                    onChange={(value) => update("lastName", value)}
                    placeholder="Last Name"
                    maxLength={PERSON_NAME_MAX_LENGTH}
                    error={
                      personalSubmitAttempted && !form.lastName.trim() ? "Last name is required." : null
                    }
                  />
                </div>

                <TextField
                  label="Work Email"
                  required
                  type="email"
                  value={form.workEmail}
                  onChange={(value) => {
                    setTouchedEmail(true);
                    update("workEmail", value);
                  }}
                  placeholder="you@company.com"
                  error={emailError}
                />

                <div className="w-full">
                  <FieldLabel>Mobile Phone</FieldLabel>
                  <div className="flex w-full items-center">
                    <div className="flex h-9 shrink-0 items-center gap-2 rounded-l-lg border border-r-0 border-[#CBD5E1] bg-white py-2 pl-2.5 pr-1">
                      <Image
                        src="/icons/braas-HR/tenant-onboarding/flag-usa.svg"
                        alt=""
                        width={24}
                        height={16}
                        className="h-4 w-6 rounded-[1px] object-cover"
                      />
                      <span className="flex items-center gap-1 text-[12px] leading-4 text-black" style={interStyle}>
                        +1
                        <ChevronDown className="h-[18px] w-[18px] text-[#6B7280]" aria-hidden />
                      </span>
                    </div>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) => update("phone", formatPhoneNumber(event.target.value))}
                      placeholder="202 555 0123"
                      style={interStyle}
                      className={`h-9 min-w-0 flex-1 rounded-r-lg border bg-white px-2.5 text-[12px] leading-4 text-black outline-none transition placeholder:text-[#94A3B8] ${
                        phoneError
                          ? "border-[#E11D48] focus:border-[#E11D48] focus:ring-2 focus:ring-[#E11D48]/15"
                          : "border-[#CBD5E1] focus:border-[#BC8B41] focus:ring-2 focus:ring-[#BC8B41]/20"
                      }`}
                    />
                  </div>
                  {phoneError ? (
                    <p className="mt-1.5 text-[12px] leading-4 text-[#E11D48]" style={interStyle}>
                      {phoneError}
                    </p>
                  ) : null}
                </div>

                <PasswordField label="Password" value={password} onChange={setPassword} error={passwordError} />
                <PasswordField
                  label="Verify Password"
                  value={verifyPassword}
                  onChange={setVerifyPassword}
                  error={verifyPasswordError}
                />

                {personalSubmitAttempted && password && !passwordIsStrongEnough ? (
                  <ul className="space-y-1">
                    {passwordRules.map((rule) => (
                      <li
                        key={rule.label}
                        className={`text-[12px] leading-4 ${rule.passed ? "text-[#16A34A]" : "text-[#6B7280]"}`}
                        style={interStyle}
                      >
                        {rule.passed ? "✓" : "•"} {rule.label}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <button
                  type="button"
                  onClick={continueToCompany}
                  disabled={emailCheckStatus === "checking"}
                  className="inline-flex h-10 w-full items-center justify-center rounded-lg px-3.5 text-[14px] font-semibold leading-5 text-white transition disabled:opacity-60"
                  style={{ ...interStyle, backgroundColor: NAVY }}
                >
                  Submit and Continue
                </button>
              </div>

              <div className="flex w-full flex-col gap-6">
                <div className="flex w-full items-center gap-1 py-1">
                  <div className="h-px flex-1 bg-[#E5E7EB]" />
                  <span className="px-1 text-[10px] font-semibold leading-[15px] text-black" style={interStyle}>
                    OR
                  </span>
                  <div className="h-px flex-1 bg-[#E5E7EB]" />
                </div>

                <div className="flex items-center justify-center gap-2.5">
                  {[
                    { src: "/icons/braas-HR/tenant-onboarding/social-google.svg", label: "Google" },
                    { src: "/icons/braas-HR/tenant-onboarding/social-apple.svg", label: "Apple" },
                    { src: "/icons/braas-HR/tenant-onboarding/social-x.svg", label: "X" },
                  ].map((social) => (
                    <button
                      key={social.label}
                      type="button"
                      aria-label={`${social.label} sign up (coming soon)`}
                      title="Coming soon"
                      className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[#E5E7EB] bg-white p-2.5"
                    >
                      <Image src={social.src} alt="" width={20} height={20} className="h-5 w-5 object-contain" />
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-2">
                  <span className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
                    Already have an account?
                  </span>
                  <Link
                    href="/login"
                    className="text-[12px] font-semibold leading-4"
                    style={{ ...interStyle, color: NAVY }}
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="flex w-full flex-col gap-6 rounded-xl border border-[#E5E7EB] bg-white px-5 py-[30px]">
              <TextField
                label="Company Name"
                required
                value={form.companyName}
                onChange={(value) => update("companyName", value)}
                placeholder="Company Name"
                error={
                  companySubmitAttempted && !form.companyName.trim() ? "Company name is required." : null
                }
              />

              <TextField
                label="Company Website"
                optional
                value={form.companyWebsite}
                onChange={(value) => update("companyWebsite", value)}
                placeholder="www.example.com"
              />

              <SearchableSelectField
                label="Industry"
                dense
                required
                multiple
                values={selectedIndustries}
                onValuesChange={(next) => {
                  setForm((prev) => ({
                    ...prev,
                    industries: next,
                    industry: next[0] ?? "",
                  }));
                }}
                options={[...INDUSTRY_OPTIONS]}
                placeholder="Select industry"
                searchPlaceholder="Search industry"
                error={
                  companySubmitAttempted && selectedIndustries.length === 0
                    ? "Select at least one industry."
                    : null
                }
              />

              <div className="w-full">
                <p className="mb-2 text-[12px] font-normal leading-4 text-[#374151]" style={interStyle}>
                  Are you a staffing company?
                </p>
                <div className="flex gap-3.5">
                  <StaffingOption
                    selected={form.isStaffingCompany === false}
                    title="No"
                    subtitle="We manage our own team"
                    onSelect={() => update("isStaffingCompany", false)}
                  />
                  <StaffingOption
                    selected={form.isStaffingCompany === true}
                    title="Yes"
                    subtitle="We place workers"
                    onSelect={() => update("isStaffingCompany", true)}
                  />
                </div>
                {companySubmitAttempted && form.isStaffingCompany === null ? (
                  <p className="mt-1.5 text-[12px] leading-4 text-[#E11D48]" style={interStyle}>
                    Select an option.
                  </p>
                ) : null}
              </div>

              <div className="flex gap-3.5">
                <div className="min-w-0 flex-1">
                  <SearchableSelectField
                    label="State"
                    dense
                    required
                    value={form.state}
                    onChange={(value) => {
                      setForm((prev) => ({ ...prev, state: value, city: "" }));
                    }}
                    options={stateOptions}
                    placeholder="Select state"
                    error={companySubmitAttempted && !form.state.trim() ? "State is required." : null}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <SearchableSelectField
                    label="City"
                    dense
                    required
                    allowCustom
                    value={form.city}
                    onChange={(value) => update("city", value)}
                    options={effectiveCityOptions}
                    placeholder={
                      !form.state ? "Select state first" : citiesLoading ? "Loading..." : "Select city"
                    }
                    disabled={!form.state || citiesLoading}
                    loading={citiesLoading}
                    error={companySubmitAttempted && !form.city.trim() ? "City is required." : null}
                  />
                </div>
              </div>

              <div className="flex gap-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitError(null);
                    setStep("personal");
                  }}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border px-3.5 text-[14px] font-semibold leading-5 transition"
                  style={{ ...interStyle, color: NAVY, borderColor: NAVY, backgroundColor: "#FFFFFF" }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={createAccount}
                  disabled={submitting}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-lg px-3.5 text-[14px] font-semibold leading-5 text-white transition disabled:opacity-60"
                  style={{ ...interStyle, backgroundColor: NAVY }}
                >
                  {submitting ? "Creating..." : "Create an account"}
                </button>
              </div>
            </div>
          )}
        </form>
      </section>
    </main>
    </TenantBrandingProvider>
  );
}
