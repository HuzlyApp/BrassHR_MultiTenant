"use client";

import Image from "next/image";
import Link from "next/link";
import RedirectionProgressModal from "@/app/components/RedirectionProgressModal";
import { PasswordVisibilityToggle } from "@/app/components/PasswordVisibilityToggle";
import SignupStepper, { resolveSignupStepperPhase } from "@/app/components/SignupStepper";
import SearchableSelectField from "@/app/tenant-onboarding/SearchableSelectField";
import { Check, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { SignupStateOption } from "@/lib/signup/owner-signup";
import { zipCodeValidationMessage } from "@/lib/tenant/business-info-validation";
import {
  signupAddress1ValidationMessage,
  signupAddress2ValidationMessage,
  signupAddressVerificationMessage,
} from "@/lib/signup/owner-signup";
import { getStateCodeFromName, getStateNameFromCode } from "@/lib/us-state-names";
import AddressAutocompleteField from "@/app/components/signup/AddressAutocompleteField";
import type { AddressSuggestion } from "@/lib/mapbox/address-validation-types";
import { useAddressAutocomplete } from "@/lib/mapbox/use-address-autocomplete";
import {
  brandingAuthButtonStyle,
  brandingToCssVars,
  defaultTenantBranding,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";
import { FaApple } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { FcGoogle } from "react-icons/fc";

const BRAAS_BLUE = "#104b83";
const interStyle = { fontFamily: "Inter, Arial, sans-serif" };
const signupInputTypographyStyle = {
  fontFamily: "Inter, Arial, sans-serif",
  fontWeight: 400,
  letterSpacing: "0",
} as const;
const signupInputClass =
  `h-[48px] w-full rounded-[6px] border bg-white px-[12px] text-[14px] font-normal leading-[22px] tracking-normal placeholder:text-[14px] placeholder:leading-[22px] min-[1440px]:h-[56px] min-[1440px]:px-[14px] min-[1440px]:text-[16px] min-[1440px]:leading-[24px] min-[1440px]:placeholder:text-[16px] min-[1440px]:placeholder:leading-[24px]`;
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
  jobTitle: string;
  city: string;
  state: string;
  zipCode: string;
  address1: string;
  address2: string;
};

type SignupStep = "details" | "password";

type PasswordRule = {
  label: string;
  passed: boolean;
};

const initialForm: SignupForm = {
  firstName: "",
  lastName: "",
  workEmail: "",
  jobTitle: "",
  city: "",
  state: "",
  zipCode: "",
  address1: "",
  address2: "",
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getPasswordRules(password: string): PasswordRule[] {
  return [
    { label: "Password must be at least 8 characters long.", passed: password.length >= 8 },
    { label: "Password must contain at least one upper case.", passed: /[A-Z]/.test(password) },
    { label: "One lower case letter.", passed: /[a-z]/.test(password) },
    { label: "Password must contain at least one number.", passed: /\d/.test(password) },
  ];
}

function getPasswordStrength(score: number) {
  if (score >= 4) {
    return { label: "Strong", color: "#16a34a", filledSegments: 4 };
  }
  if (score === 3) {
    return { label: "Medium", color: "#d89b35", filledSegments: 3 };
  }
  return { label: "Weak", color: "#ef4565", filledSegments: score > 0 ? Math.max(score, 1) : 0 };
}

function FieldLabel({ children, required = false }: { children: string; required?: boolean }) {
  return (
    <label className="mb-[8px] block text-[13px] font-normal leading-[18px] tracking-normal text-[#0f172a] min-[1440px]:mb-[10px] min-[1440px]:text-[14px] min-[1440px]:leading-[20px]" style={interStyle}>
      {children}
      {required ? <span className="ml-1 text-[#ef4565]">*</span> : null}
    </label>
  );
}

function PasswordRuleList({ rules }: { rules: PasswordRule[] }) {
  return (
    <div className="mt-[24px] space-y-[8px]">
      {rules.map((rule) => (
        <div key={rule.label} className="flex items-center gap-[10px] text-[12px] font-normal leading-[16px] text-[#475569]" style={interStyle}>
          <span
            className={`flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full ${
              rule.passed ? "text-[#0d9488]" : "text-[#ef4565]"
            }`}
          >
            {rule.passed ? <Check className="h-[13px] w-[13px]" strokeWidth={2.5} /> : <X className="h-[13px] w-[13px]" strokeWidth={2.5} />}
          </span>
          {rule.label}
        </div>
      ))}
    </div>
  );
}

function PasswordStrengthMeter({ score }: { score: number }) {
  const strength = getPasswordStrength(score);

  return (
    <div className="mt-[12px]">
      <div className="grid grid-cols-4 gap-[3px]">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className="h-[4px] rounded-full"
            style={{ backgroundColor: index < strength.filledSegments ? strength.color : "#e4e9f0" }}
            aria-hidden
          />
        ))}
      </div>
      <div className="mt-[6px] flex items-center justify-end gap-[8px]">
        <span className="text-[12px] font-normal leading-[16px]" style={{ ...interStyle, color: strength.color }}>
          {strength.label}
        </span>
        <span className="flex h-[14px] w-[14px] items-center justify-center rounded-full border border-[#b5c0cf] text-[10px] leading-none text-[#94a3b8]">
          i
        </span>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  type?: "text" | "email";
  error?: string | null;
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={signupInputTypographyStyle}
        className={`${signupInputClass} outline-none transition placeholder:text-[#b5c0cf] ${
          error
            ? "border-[#ff5c7a] text-[#f01846] focus:border-[#ff5c7a] focus:ring-2 focus:ring-[#ff5c7a]/20"
            : "border-[#d7e0ea] text-[#0f172a] focus:border-[#d89b35] focus:ring-2 focus:ring-[#d89b35]/20"
        }`}
      />
      {error ? (
        <p className="mt-[8px] text-[14px] font-normal leading-[20px] text-[#f01846]" style={interStyle}>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <FieldLabel required>{label}</FieldLabel>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={signupInputTypographyStyle}
          className={`${signupInputClass} border border-[#d7e0ea] pr-12 text-[#0f172a] outline-none transition placeholder:text-[#b5c0cf] focus:border-[#d89b35] focus:ring-2 focus:ring-[#d89b35]/20`}
        />
        <PasswordVisibilityToggle
          visible={visible}
          onToggle={() => setVisible((current) => !current)}
          label={label}
        />
      </div>
    </div>
  );
}

function SocialButton({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-[34px] w-[34px] items-center justify-center rounded-[6px] border border-[#d7e0ea] bg-white text-[18px] text-black transition hover:bg-[#f8fafc]"
    >
      {children}
    </button>
  );
}

export default function SignupPage() {
  const [form, setForm] = useState<SignupForm>(initialForm);
  const [step, setStep] = useState<SignupStep>("details");
  const [password, setPassword] = useState("");
  const [verifyPassword, setVerifyPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedZip, setTouchedZip] = useState(false);
  const [touchedAddress1, setTouchedAddress1] = useState(false);
  const [touchedAddress2, setTouchedAddress2] = useState(false);
  const [detailsSubmitAttempted, setDetailsSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stateRows, setStateRows] = useState<SignupStateOption[]>([]);
  const [stateOptions, setStateOptions] = useState<string[]>(FALLBACK_STATE_OPTIONS);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [locationLoading, setLocationLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [emailCheckStatus, setEmailCheckStatus] = useState<"idle" | "checking" | "taken" | "available">("idle");
  const emailCheckRequestId = useRef(0);
  const [brand, setBrand] = useState<TenantBranding>(() => defaultTenantBranding());
  const [redirecting, setRedirecting] = useState(false);

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

  const signupButtonStyle = brandingAuthButtonStyle(true);

  useEffect(() => {
    const previousHtmlBg = document.documentElement.style.backgroundColor;
    const previousBodyBg = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = "#ffffff";
    document.body.style.backgroundColor = "#ffffff";

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
      } finally {
        if (active) setLocationLoading(false);
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

        const names = (data ?? []).map((row) => String(row.city_name));
        setCityOptions(names);
        setForm((prev) => {
          if (prev.city && names.length > 0 && !names.includes(prev.city)) {
            return { ...prev, city: "" };
          }
          return prev;
        });
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
          setEmailCheckStatus(payload.available === false ? "taken" : "available");
        } catch {
          if (emailCheckRequestId.current === requestId) setEmailCheckStatus("idle");
        }
      })();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [form.workEmail]);

  const workEmailNormalized = form.workEmail.trim().toLowerCase();
  const emailTaken = emailCheckStatus === "taken";
  const emailError = emailTaken
    ? "Email has been taken. Try another"
    : touchedEmail && form.workEmail.trim() && !isValidEmail(form.workEmail)
      ? "Enter valid email"
      : null;

  const zipValidationContext = useMemo(
    () => ({
      stateCode: selectedStateCode || undefined,
      stateName: form.state || undefined,
    }),
    [form.state, selectedStateCode]
  );

  const zipError = useMemo(() => {
    if (!detailsSubmitAttempted && !touchedZip) return null;
    return zipCodeValidationMessage(form.zipCode, zipValidationContext);
  }, [detailsSubmitAttempted, touchedZip, form.zipCode, zipValidationContext]);

  const zipIsValid = useMemo(
    () => !zipCodeValidationMessage(form.zipCode, zipValidationContext),
    [form.zipCode, zipValidationContext]
  );

  const effectiveCityOptions = useMemo(() => {
    const city = form.city.trim();
    if (!city || cityOptions.includes(city)) {
      return cityOptions;
    }
    return [...cityOptions, city].sort((a, b) => a.localeCompare(b));
  }, [cityOptions, form.city]);

  const addressAutocomplete = useAddressAutocomplete(form.address1, {
    city: form.city,
    state: form.state,
    zipCode: form.zipCode,
  });

  const address1Error = useMemo(() => {
    if (!detailsSubmitAttempted && !touchedAddress1) return null;
    return (
      signupAddress1ValidationMessage(form.address1) ??
      signupAddressVerificationMessage({
        address1: form.address1,
        isAddressVerified: addressAutocomplete.isAddressVerified,
        showError: true,
      })
    );
  }, [
    detailsSubmitAttempted,
    touchedAddress1,
    form.address1,
    addressAutocomplete.isAddressVerified,
  ]);

  const address2Error = useMemo(() => {
    if (!detailsSubmitAttempted && !touchedAddress2) return null;
    return signupAddress2ValidationMessage(form.address2, { sameAsAddress1: false });
  }, [detailsSubmitAttempted, touchedAddress2, form.address2]);

  const address1IsValid = useMemo(
    () => !signupAddress1ValidationMessage(form.address1),
    [form.address1]
  );

  const address2IsValid = useMemo(
    () => !signupAddress2ValidationMessage(form.address2, { sameAsAddress1: false }),
    [form.address2]
  );

  const handleSelectAddressSuggestion = (suggestion: AddressSuggestion) => {
    const components = addressAutocomplete.selectSuggestion(suggestion);
    const stateName = components.state
      ? getStateNameFromCode(components.state) ?? components.state
      : "";
    setForm((prev) => ({
      ...prev,
      address1: components.address1 || prev.address1,
      city: components.city || prev.city,
      state: stateName || prev.state,
      zipCode: components.zipCode || prev.zipCode,
    }));
    setTouchedAddress1(true);
    setTouchedZip(true);
  };

  const canContinue = useMemo(() => {
    return (
      form.firstName.trim().length > 0 &&
      form.lastName.trim().length > 0 &&
      isValidEmail(form.workEmail) &&
      !emailTaken &&
      form.jobTitle.trim().length > 0 &&
      form.city.trim().length > 0 &&
      form.state.trim().length > 0 &&
      zipIsValid &&
      address1IsValid &&
      addressAutocomplete.isAddressVerified &&
      address2IsValid
    );
  }, [address1IsValid, address2IsValid, addressAutocomplete.isAddressVerified, emailTaken, form, zipIsValid]);

  const passwordRules = useMemo(() => getPasswordRules(password), [password]);
  const passwordScore = passwordRules.filter((rule) => rule.passed).length;
  const passwordIsStrongEnough = passwordScore === passwordRules.length;
  const canCreateAccount = passwordIsStrongEnough && password === verifyPassword && termsAccepted;

  const update = <K extends keyof SignupForm>(key: K, value: SignupForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === "details") {
      setTouchedEmail(true);
      setTouchedZip(true);
      setTouchedAddress1(true);
      setTouchedAddress2(true);
      setDetailsSubmitAttempted(true);
      if (!canContinue) return;
      setStep("password");
      return;
    }

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
            jobTitle: form.jobTitle,
            city: form.city,
            state: form.state,
            zipCode: form.zipCode,
            address1: form.address1,
            address2: form.address2,
            password,
          }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
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
            JSON.stringify({ ...form, passwordSet: true })
          );
        } catch {
          /* ignore storage errors */
        }

        await fetch("/api/auth/signup/begin-trial-session", { method: "POST" }).catch(() => null);

        setRedirecting(true);
        window.setTimeout(() => {
          window.location.assign("/your-trial");
        }, 80);
      } catch {
        setSubmitError("Something went wrong. Please try again.");
        setSubmitting(false);
      }
    })();
  };

  return (
    <main
      className="min-h-screen w-full overflow-x-hidden bg-white"
      style={{ ...(brandingToCssVars(brand) as CSSProperties), backgroundColor: "#ffffff" }}
    >
      {redirecting ? <RedirectionProgressModal /> : null}
      <style>{`
        .signup-frame {
          box-sizing: border-box;
          padding: clamp(32px, 5.55vw, 80px);
        }

        .signup-layout {
          display: grid;
          grid-template-columns: minmax(500px, 590px) minmax(340px, min(38vw, 510px));
          gap: clamp(40px, 7vw, 180px);
          justify-content: center;
          align-items: stretch;
        }

        .signup-art {
          height: auto;
          min-height: clamp(780px, calc(100vh - 96px), 1279px);
        }

        .signup-form {
          padding-top: clamp(0px, 1.4vw, 20px);
        }

        @media (min-width: 1440px) {
          .signup-frame {
            padding: 80px;
          }

          .signup-frame--details {
            height: auto;
            min-height: 1024px;
          }

          .signup-frame--password {
            height: 1457px;
          }

          .signup-layout {
            width: 1280px;
            grid-template-columns: 590px 510px;
            gap: 180px;
          }

          .signup-layout--details {
            height: auto;
            min-height: 1279px;
            align-items: start;
          }

          .signup-layout--password {
            height: 1279px;
          }

          .signup-art {
            width: 510px;
            min-height: 1279px;
          }

          .signup-art--details {
            height: auto;
          }

          .signup-art--password {
            height: 1279px;
          }
        }

        @media (max-width: 1100px) {
          .signup-frame {
            padding: 28px 24px;
          }

          .signup-layout {
            grid-template-columns: 1fr;
            gap: 32px;
            width: 100%;
            max-width: 590px;
            margin-left: auto;
            margin-right: auto;
          }

          .signup-form {
            max-width: 100%;
            width: 100%;
          }

          .signup-frame--password {
            height: auto;
          }

          .signup-art,
          .signup-art.signup-art--password {
            display: none;
          }

          .signup-layout--password {
            height: auto;
            min-height: 0;
          }
        }

        @media (max-width: 767px) {
          .signup-frame {
            padding: 24px 20px;
          }
        }

        @media (max-width: 639px) {
          .signup-frame {
            padding: 16px 20px;
          }

          .signup-layout {
            gap: 24px;
          }

          .signup-form {
            padding-bottom: 32px;
            width: 100%;
          }

          .signup-field-grid label {
            font-size: 13px;
            line-height: 18px;
            margin-bottom: 6px;
          }
        }

        @media (min-width: 1101px) and (max-width: 1439px) {
          .signup-frame {
            padding: 36px 40px;
          }

          .signup-layout {
            grid-template-columns: minmax(0, 590px) minmax(0, min(38vw, 510px));
            gap: clamp(32px, 5vw, 80px);
          }

          .signup-art {
            min-height: clamp(620px, calc(100vh - 96px), 900px);
          }
        }

        .signup-layout--password {
          align-items: stretch;
        }

        @media (min-width: 1101px) {
          .signup-art.signup-art--password {
            height: 100%;
            min-height: 100%;
            max-height: none;
            aspect-ratio: unset;
            align-self: stretch;
          }
        }

      `}</style>
      <section
        className={`signup-frame mx-auto min-h-screen w-full max-w-[1440px] rounded-[24px] bg-white${
          step === "password" ? " signup-frame--password" : " signup-frame--details"
        }`}
      >
        <div
          className={`signup-layout w-full rounded-[12px] bg-white${
            step === "password" ? " signup-layout--password" : " signup-layout--details"
          }`}
        >
          <form
            onSubmit={onSubmit}
            className="signup-form relative z-10 flex w-full max-w-[590px] flex-col pb-[48px] max-[1100px]:max-w-full"
          >
            <Image
              src={brand.signupLogoUrl}
              alt={brand.companyName}
              width={160}
              height={80}
              priority
              className="h-[56px] w-[112px] object-contain sm:h-[68px] sm:w-[136px] min-[1440px]:h-[80px] min-[1440px]:w-[160px] max-[1100px]:mx-auto max-[1100px]:block"
            />

            <SignupStepper
              phase={resolveSignupStepperPhase({ formStep: step, redirecting })}
            />

            {submitError ? (
              <p className="mt-[24px] rounded-[8px] border border-[#fecdd3] bg-[#fff1f2] px-[14px] py-[12px] text-[14px] leading-[20px] text-[#be123c]" style={interStyle}>
                {submitError}
              </p>
            ) : null}

            {step === "details" ? (
              <>
            <div className="mt-[32px] sm:mt-[44px] min-[1440px]:mt-[58px]">
              <h1
                className="text-[24px] font-semibold leading-[30px] tracking-normal sm:text-[26px] sm:leading-[32px] lg:text-[28px] lg:leading-[34px] min-[1440px]:text-[30px] min-[1440px]:leading-[36px]"
                style={{ color: "var(--brand-heading)", fontFamily: "var(--brand-font-heading)" }}
              >
                {brand.signupHeadline}
              </h1>
              <p
                className="mt-[8px] text-[14px] font-normal leading-[20px] tracking-normal sm:mt-[10px] sm:text-[15px] sm:leading-[22px] min-[1440px]:text-[16px] min-[1440px]:leading-[24px]"
                style={{ color: "var(--brand-muted)", fontFamily: "var(--brand-font-body)" }}
              >
                {brand.signupSubheadline}
              </p>
            </div>

            <div className="signup-field-grid mt-[24px] grid grid-cols-1 gap-y-[18px] min-[600px]:grid-cols-2 min-[600px]:gap-x-[14px] sm:mt-[30px] sm:gap-x-[20px] sm:gap-y-[24px] min-[1440px]:mt-[38px] min-[1440px]:gap-x-[26px] min-[1440px]:gap-y-[30px]">
              <div className="min-w-0">
                <TextField
                  label="First Name"
                  required
                  value={form.firstName}
                  onChange={(value) => update("firstName", value)}
                  placeholder="First Name"
                />
              </div>
              <div className="min-w-0">
                <TextField
                  label="Last Name"
                  required
                  value={form.lastName}
                  onChange={(value) => update("lastName", value)}
                  placeholder="Last Name"
                />
              </div>
              <div className="min-w-0" onBlur={() => setTouchedEmail(true)}>
                <TextField
                  label="Work Email"
                  required
                  type="email"
                  value={form.workEmail}
                  onChange={(value) => update("workEmail", value)}
                  placeholder="Email"
                  error={emailError}
                />
              </div>
              <div className="min-w-0">
                <TextField
                  label="Job Title"
                  required
                  value={form.jobTitle}
                  onChange={(value) => update("jobTitle", value)}
                  placeholder="Job title"
                />
              </div>
            </div>

            <div className="signup-field-grid signup-field-grid--location mt-[18px] grid grid-cols-1 gap-y-[18px] min-[600px]:grid-cols-2 min-[600px]:gap-x-[14px] sm:mt-[26px] sm:gap-x-[20px] sm:gap-y-[24px] lg:grid-cols-3 min-[1440px]:mt-[30px] min-[1440px]:gap-x-[26px]">
              <div className="min-w-0">
                <SearchableSelectField
                  label="State"
                  required
                  compact
                  loading={locationLoading}
                  disabled={locationLoading}
                  value={form.state}
                  onChange={(value) => {
                    setForm((prev) => ({ ...prev, state: value, city: "" }));
                  }}
                  placeholder={locationLoading ? "Loading…" : "Search state"}
                  searchPlaceholder="Type to search states"
                  options={stateOptions}
                  emptyMessage="No states found. Try another search."
                />
              </div>
              <div className="min-w-0">
                {form.state && cityOptions.length === 0 && !citiesLoading ? (
                  <TextField
                    label="City"
                    required
                    value={form.city}
                    onChange={(value) => update("city", value)}
                    placeholder="Enter your city"
                  />
                ) : (
                  <SearchableSelectField
                    label="City"
                    required
                    compact
                    disabled={!form.state}
                    loading={citiesLoading}
                    value={form.city}
                    onChange={(value) => update("city", value)}
                    placeholder={
                      !form.state
                        ? "Select state first"
                        : citiesLoading
                          ? "Loading…"
                          : "Search city"
                    }
                    searchPlaceholder="Type to search cities"
                    options={effectiveCityOptions}
                    emptyMessage="No cities found. Try another search."
                  />
                )}
              </div>
              <div className="signup-location-zip min-w-0 min-[600px]:col-span-2 lg:col-span-1" onBlur={() => setTouchedZip(true)}>
                <TextField
                  label="Zip Code"
                  required
                  value={form.zipCode}
                  onChange={(value) => update("zipCode", value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="Code"
                  error={zipError}
                />
              </div>
            </div>

            <div className="mt-[24px] space-y-[22px] min-[1440px]:mt-[30px] min-[1440px]:space-y-[26px]">
              <AddressAutocompleteField
                label="Address 1"
                required
                value={form.address1}
                onChange={(value) => {
                  addressAutocomplete.resetVerification();
                  update("address1", value);
                }}
                onBlur={() => setTouchedAddress1(true)}
                onFocus={addressAutocomplete.openSuggestions}
                onCloseSuggestions={addressAutocomplete.closeSuggestions}
                error={address1Error}
                searchError={
                  touchedAddress1 || detailsSubmitAttempted
                    ? addressAutocomplete.searchError
                    : null
                }
                suggestions={addressAutocomplete.suggestions}
                isLoading={addressAutocomplete.isLoading}
                isOpen={addressAutocomplete.isOpen}
                isVerified={addressAutocomplete.isAddressVerified}
                onSelectSuggestion={handleSelectAddressSuggestion}
                variant="signup"
              />

              <div onBlur={() => setTouchedAddress2(true)}>
                <TextField
                  label="Address 2"
                  value={form.address2}
                  onChange={(value) => update("address2", value)}
                  placeholder="Apt, Suite, Unit, etc."
                  error={address2Error}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!canContinue}
              className="relative z-20 mt-[28px] flex h-[48px] w-full shrink-0 items-center justify-center rounded-[8px] text-[15px] font-semibold leading-[20px] tracking-normal transition disabled:cursor-not-allowed disabled:bg-[#dddddd] disabled:text-[#c5c5c5] enabled:text-white enabled:hover:brightness-95 sm:mt-[32px] sm:h-[50px] sm:text-[15px] min-[1440px]:mt-[38px] min-[1440px]:h-[52px] min-[1440px]:text-[16px] min-[1440px]:leading-[22px]"
              style={canContinue ? signupButtonStyle : undefined}
            >
              Next
            </button>

            <div className="mt-[46px] flex items-center gap-[14px]">
              <div className="h-px flex-1 bg-[#e7edf4]" />
              <span className="text-[10px] font-medium uppercase text-[#334155]">OR</span>
              <div className="h-px flex-1 bg-[#e7edf4]" />
            </div>

            <div className="mt-[30px] flex justify-center gap-[14px]">
              <SocialButton label="Continue with Google">
                <FcGoogle />
              </SocialButton>
              <SocialButton label="Continue with Apple">
                <FaApple />
              </SocialButton>
              <SocialButton label="Continue with X">
                <FaXTwitter className="h-[15px] w-[15px]" />
              </SocialButton>
            </div>

            <p className="mt-[34px] text-center text-[11px] font-normal leading-none text-[#64748b]">
              Already have an account?{" "}
              <Link href="/signin?next=/tenant-onboarding" className="font-semibold text-[#0b0f19] hover:underline">
                Sign In
              </Link>
            </p>
              </>
            ) : (
              <>
                <div className="mt-[32px] sm:mt-[44px] min-[1440px]:mt-[58px]">
                  <h1
                    className="text-[24px] font-semibold leading-[30px] tracking-normal sm:text-[26px] sm:leading-[32px] lg:text-[28px] lg:leading-[34px] min-[1440px]:text-[30px] min-[1440px]:leading-[36px]"
                    style={{ color: "var(--brand-heading)", fontFamily: "var(--brand-font-heading)" }}
                  >
                    {brand.signupHeadline}
                  </h1>
                  <p
                    className="mt-[8px] text-[14px] font-normal leading-[20px] tracking-normal sm:mt-[10px] sm:text-[15px] sm:leading-[22px] min-[1440px]:text-[16px] min-[1440px]:leading-[24px]"
                    style={{ color: "var(--brand-muted)", fontFamily: "var(--brand-font-body)" }}
                  >
                    Create a unique new password.
                  </p>
                </div>

                <PasswordRuleList rules={passwordRules} />

                <div className="mt-[24px] space-y-[24px] min-[1440px]:space-y-[30px]">
                  <div>
                    <PasswordField label="Password" value={password} onChange={setPassword} />
                    <PasswordStrengthMeter score={passwordScore} />
                  </div>
                  <PasswordField label="Verify Password" value={verifyPassword} onChange={setVerifyPassword} />
                </div>

                <label className="mt-[24px] flex cursor-pointer items-start gap-[8px] text-[13px] font-normal leading-[19px] tracking-normal text-[#64748b] sm:mt-[26px] sm:text-[14px] sm:leading-[20px] min-[1440px]:mt-[30px]" style={interStyle}>
                  <span
                    className={`relative mt-px flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] border ${
                      termsAccepted ? "border-[#BC8B41] bg-[#BC8B41]" : "border-[#d7e0ea] bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(event) => setTermsAccepted(event.target.checked)}
                      className="absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
                      aria-label="Accept terms and conditions"
                    />
                    {termsAccepted ? <Check className="h-[14px] w-[14px] text-white" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    I hereby confirm that I have read and agree with the{" "}
                    <a href="#" className="font-semibold text-[#0f172a]">
                      Terms &amp; Conditions
                    </a>{" "}
                    <span className="text-[#64748b]">and</span>{" "}
                    <a href="#" className="font-semibold text-[#0f172a]">
                      Privacy Policy
                    </a>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!canCreateAccount || submitting}
                  className="mt-[28px] flex h-[48px] w-full items-center justify-center rounded-[8px] align-middle text-[15px] font-semibold leading-[20px] tracking-normal transition disabled:cursor-not-allowed disabled:bg-[#dddddd] disabled:text-[#c5c5c5] enabled:text-white enabled:hover:brightness-95 sm:mt-[32px] sm:h-[50px] min-[1440px]:mt-[38px] min-[1440px]:h-[52px] min-[1440px]:text-[16px] min-[1440px]:leading-[22px]"
                  style={canCreateAccount && !submitting ? signupButtonStyle : undefined}
                >
                  {submitting ? "Creating account…" : "Create an account"}
                </button>

                <div className="mt-[46px] flex items-center gap-[14px]">
                  <div className="h-px flex-1 bg-[#e7edf4]" />
                  <span className="text-[10px] font-medium uppercase text-[#334155]">OR</span>
                  <div className="h-px flex-1 bg-[#e7edf4]" />
                </div>

                <div className="mt-[30px] flex justify-center gap-[14px]">
                  <SocialButton label="Continue with Google">
                    <FcGoogle />
                  </SocialButton>
                  <SocialButton label="Continue with Apple">
                    <FaApple />
                  </SocialButton>
                  <SocialButton label="Continue with X">
                    <FaXTwitter className="h-[15px] w-[15px]" />
                  </SocialButton>
                </div>

                <p className="mt-[34px] text-center text-[11px] font-normal leading-none text-[#64748b]">
                  Already have an account?{" "}
                  <Link href="/signin?next=/tenant-onboarding" className="font-semibold text-[#0b0f19] hover:underline">
                    Sign In
                  </Link>
                </p>
              </>
            )}
          </form>

          <aside
            className={`signup-art relative flex w-full flex-col items-center justify-center gap-[40px] self-stretch overflow-hidden rounded-[24px] bg-[#111827] p-[30px]${
              step === "password" ? " signup-art--password" : " signup-art--details"
            }`}
          >
            <Image
              src="/images/singup-bg-image.jpg"
              alt="Brass HR signup"
              fill
              sizes="510px"
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/45" />
            <div className="relative z-10 flex flex-col items-center justify-center gap-[40px] text-center">
              <Image
                src="/icons/braas-HR/white-BrassHR-logo.svg"
                alt="Brass HR"
                width={160}
                height={80}
                priority
                className="h-[56px] w-[112px] object-contain sm:h-[64px] sm:w-[128px] min-[1440px]:h-[80px] min-[1440px]:w-[160px]"
              />
              <p
                className="max-w-[260px] text-center text-[20px] font-bold leading-[26px] tracking-[0.03em] text-white sm:max-w-[280px] sm:text-[22px] sm:leading-[28px] min-[1440px]:max-w-[300px] min-[1440px]:text-[24px] min-[1440px]:leading-[30px]"
                style={{ fontFamily: "var(--font-geist-mono)" }}
              >
                HR Simplified for growing teams
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
