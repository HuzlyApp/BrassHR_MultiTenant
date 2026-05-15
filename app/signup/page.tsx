"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SignupStepper from "@/app/components/SignupStepper";
import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FaApple } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { FcGoogle } from "react-icons/fc";

const BRAAS_BLUE = "#104b83";
const BRAAS_BUTTON_GRADIENT = "linear-gradient(90deg, #BC8B41 0%, #E9B771 100%)";
const interStyle = { fontFamily: "Inter, Arial, sans-serif" };
const inputTypographyStyle = {
  fontFamily: "Inter, Arial, sans-serif",
  fontSize: "16px",
  lineHeight: "24px",
  fontWeight: 400,
  letterSpacing: "0",
} as const;
const inputTextClass =
  "text-[16px] font-normal leading-[24px] tracking-normal placeholder:text-[16px] placeholder:leading-[24px] placeholder:font-normal";
const TEST_TAKEN_EMAIL = "test@gmail.com";

const CITY_OPTIONS = ["Los Angeles", "San Diego", "San Francisco", "Sacramento", "Phoenix", "Dallas", "Houston"];
const STATE_OPTIONS = ["California", "Arizona", "Texas", "New York", "Florida", "Illinois"];

type SignupForm = {
  firstName: string;
  lastName: string;
  workEmail: string;
  jobTitle: string;
  city: string;
  state: string;
  zipCode: string;
  address1: string;
  sameAsAddress1: boolean;
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
  sameAsAddress1: false,
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
    { label: "Password must contain at least one number or special character.", passed: /[\d\W_]/.test(password) },
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
    <label className="mb-[10px] block text-[14px] font-normal leading-[20px] tracking-normal text-[#0f172a]" style={interStyle}>
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
        style={inputTypographyStyle}
        className={`h-[56px] w-full rounded-[6px] border bg-white px-[14px] ${inputTextClass} outline-none transition placeholder:text-[#b5c0cf] ${
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
          style={inputTypographyStyle}
          className={`h-[56px] w-full rounded-[6px] border border-[#d7e0ea] bg-white px-[14px] pr-12 ${inputTextClass} text-[#0f172a] outline-none transition placeholder:text-[#b5c0cf] focus:border-[#d89b35] focus:ring-2 focus:ring-[#d89b35]/20`}
        />
        <button
          type="button"
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          onClick={() => setVisible((current) => !current)}
          className={`absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition ${
            visible ? "bg-[#fbf4ea] ring-1 ring-[#BC8B41]/25" : "hover:bg-[#f8fafc]"
          }`}
        >
          <Image
            src="/icons/braas-HR/eye.svg"
            alt=""
            width={20}
            height={20}
            className="h-[20px] w-[20px]"
            style={{
              filter: visible
                ? "brightness(0) saturate(100%) invert(55%) sepia(33%) saturate(738%) hue-rotate(359deg) brightness(88%) contrast(86%)"
                : undefined,
            }}
          />
        </button>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  placeholder,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: string[];
  required?: boolean;
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={inputTypographyStyle}
          className={`h-[56px] w-full appearance-none rounded-[6px] border border-[#d7e0ea] bg-white px-[14px] pr-9 ${inputTextClass} outline-none transition focus:border-[#d89b35] focus:ring-2 focus:ring-[#d89b35]/20 ${
            value ? "text-[#0f172a]" : "text-[#64748b]"
          }`}
        >
          <option value="" style={inputTypographyStyle}>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option} value={option} style={inputTypographyStyle}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa8bb]" />
      </div>
    </div>
  );
}

function AddressField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-[10px] flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-[9px] font-normal leading-none text-[#8a98aa]">Building, Floor, etc...</span>
      </div>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Address"
        style={inputTypographyStyle}
        className={`h-[56px] w-full rounded-[6px] border border-[#d7e0ea] bg-white px-[14px] ${inputTextClass} text-[#0f172a] outline-none transition placeholder:text-[#b5c0cf] focus:border-[#d89b35] focus:ring-2 focus:ring-[#d89b35]/20 disabled:bg-[#f7f8fa] disabled:text-[#94a3b8]`}
      />
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
  const router = useRouter();
  const [form, setForm] = useState<SignupForm>(initialForm);
  const [step, setStep] = useState<SignupStep>("details");
  const [password, setPassword] = useState("");
  const [verifyPassword, setVerifyPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);

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

  const workEmailNormalized = form.workEmail.trim().toLowerCase();
  const emailTaken = workEmailNormalized === TEST_TAKEN_EMAIL;
  const emailError = emailTaken
    ? "Email has been taken. Try another"
    : touchedEmail && form.workEmail.trim() && !isValidEmail(form.workEmail)
      ? "Enter valid email"
      : null;

  const canContinue = useMemo(() => {
    return (
      form.firstName.trim().length > 0 &&
      form.lastName.trim().length > 0 &&
      isValidEmail(form.workEmail) &&
      !emailTaken &&
      form.jobTitle.trim().length > 0 &&
      form.city.trim().length > 0 &&
      form.state.trim().length > 0 &&
      form.zipCode.trim().length > 0
    );
  }, [emailTaken, form]);

  const passwordRules = useMemo(() => getPasswordRules(password), [password]);
  const passwordScore = passwordRules.filter((rule) => rule.passed).length;
  const passwordIsStrongEnough = passwordScore === passwordRules.length;
  const canCreateAccount = passwordIsStrongEnough && password === verifyPassword && termsAccepted;

  const update = <K extends keyof SignupForm>(key: K, value: SignupForm[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "address1" && prev.sameAsAddress1) {
        next.address2 = String(value);
      }
      if (key === "sameAsAddress1") {
        next.address2 = value ? next.address1 : "";
      }
      return next;
    });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === "details") {
      setTouchedEmail(true);
      if (!canContinue) return;
      setStep("password");
      return;
    }

    if (!canCreateAccount) return;

    localStorage.setItem(
      "braasOwnerSignupDraft",
      JSON.stringify({ ...form, passwordSet: true })
    );
    router.push("/your-trial?created=true");
  };

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-white" style={{ backgroundColor: "#ffffff" }}>
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

        @media (max-width: 1050px) {
          .signup-frame {
            padding: 36px 40px;
          }

          .signup-layout {
            grid-template-columns: minmax(460px, 520px) minmax(300px, 360px);
            gap: 36px;
          }

          .signup-art {
            min-height: 760px;
          }
        }

        @media (max-width: 900px) {
          .signup-frame {
            padding: 30px 28px;
          }

          .signup-layout {
            grid-template-columns: minmax(430px, 500px) minmax(280px, 320px);
            gap: 28px;
          }
        }

        .signup-layout--password {
          align-items: stretch;
        }

        .signup-art.signup-art--password {
          height: 100%;
          min-height: 100%;
          max-height: none;
          aspect-ratio: unset;
          align-self: stretch;
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
            className="signup-form relative z-10 flex w-full max-w-[590px] flex-col pb-[48px]"
          >
            <Image
              src="/icons/braas-HR/BrassHR-logo.svg"
              alt="Braas HR"
              width={160}
              height={80}
              priority
              className="h-[80px] w-[160px] object-contain"
            />

            <SignupStepper phase={step === "password" ? "password" : "details"} />

            {step === "details" ? (
              <>
            <div className="mt-[58px]">
              <h1 className="text-[30px] font-semibold leading-[36px] tracking-normal text-[#0b0f19]" style={interStyle}>
                Start your free trial
              </h1>
              <p className="mt-[10px] text-[16px] font-normal leading-[24px] tracking-normal text-[#475569]" style={interStyle}>
                Enter your details to get started
              </p>
            </div>

            <div className="mt-[38px] grid grid-cols-2 gap-x-[26px] gap-y-[30px]">
              <TextField
                label="First Name"
                required
                value={form.firstName}
                onChange={(value) => update("firstName", value)}
                placeholder="First Name"
              />
              <TextField
                label="Last Name"
                required
                value={form.lastName}
                onChange={(value) => update("lastName", value)}
                placeholder="Last Name"
              />
              <div onBlur={() => setTouchedEmail(true)}>
                <TextField
                  label="Work Email"
                  required
                  type="email"
                  value={form.workEmail}
                  onChange={(value) => update("workEmail", value)}
                  placeholder="Yourcompany@email.com"
                  error={emailError}
                />
              </div>
              <TextField
                label="Job Title"
                required
                value={form.jobTitle}
                onChange={(value) => update("jobTitle", value)}
                placeholder="Job title"
              />
            </div>

            <div className="mt-[30px] grid grid-cols-3 gap-x-[26px]">
              <SelectField
                label="City"
                required
                value={form.city}
                onChange={(value) => update("city", value)}
                placeholder="Select"
                options={CITY_OPTIONS}
              />
              <SelectField
                label="State"
                required
                value={form.state}
                onChange={(value) => update("state", value)}
                placeholder="Select"
                options={STATE_OPTIONS}
              />
              <TextField
                label="Zip Code"
                required
                value={form.zipCode}
                onChange={(value) => update("zipCode", value.replace(/\D/g, "").slice(0, 10))}
                placeholder="Code"
              />
            </div>

            <div className="mt-[30px] space-y-[26px]">
              <AddressField label="Address 1" value={form.address1} onChange={(value) => update("address1", value)} />

              <label
                className="flex w-fit cursor-pointer items-center gap-[8px] text-[14px] font-normal leading-[20px] tracking-normal text-[#334155]"
                style={interStyle}
              >
                <span
                  className={`relative flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] border ${
                    form.sameAsAddress1 ? "border-[#BC8B41] bg-[#BC8B41]" : "border-[#d7e0ea] bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.sameAsAddress1}
                    onChange={(event) => update("sameAsAddress1", event.target.checked)}
                    className="absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
                    aria-label="Same as address 1"
                  />
                  {form.sameAsAddress1 ? <Check className="h-[14px] w-[14px] text-white" strokeWidth={3} /> : null}
                </span>
                Same as address 1
              </label>

              <AddressField
                label="Address 2"
                value={form.address2}
                onChange={(value) => update("address2", value)}
                disabled={form.sameAsAddress1}
              />
            </div>

            <button
              type="submit"
              disabled={!canContinue}
              className="relative z-20 mt-[38px] flex h-[52px] w-full shrink-0 items-center justify-center rounded-[8px] text-[16px] font-semibold leading-[22px] tracking-normal transition disabled:cursor-not-allowed disabled:bg-[#dddddd] disabled:text-[#c5c5c5] enabled:text-white enabled:hover:brightness-95"
              style={{
                backgroundImage: canContinue ? BRAAS_BUTTON_GRADIENT : undefined,
                fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
              }}
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
              <Link href="/login?next=/tenant-onboarding" className="font-semibold text-[#0b0f19] hover:underline">
                Sign In
              </Link>
            </p>
              </>
            ) : (
              <>
                <div className="mt-[58px]">
                  <h1 className="text-[30px] font-semibold leading-[36px] tracking-normal text-[#0b0f19]" style={interStyle}>
                    Start your free trial
                  </h1>
                  <p className="mt-[10px] text-[16px] font-normal leading-[24px] tracking-normal text-[#475569]" style={interStyle}>
                    Create a unique new password.
                  </p>
                </div>

                <PasswordRuleList rules={passwordRules} />

                <div className="mt-[24px] space-y-[30px]">
                  <div>
                    <PasswordField label="Password" value={password} onChange={setPassword} />
                    <PasswordStrengthMeter score={passwordScore} />
                  </div>
                  <PasswordField label="Verify Password" value={verifyPassword} onChange={setVerifyPassword} />
                </div>

                <label className="mt-[30px] flex cursor-pointer items-start gap-[8px] text-[14px] font-normal leading-[20px] tracking-normal text-[#64748b]" style={interStyle}>
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
                  <span className="whitespace-nowrap">
                    I hereby confirm that I have read and agree with the{" "}
                    <a href="#" className="text-[14px] font-semibold leading-[20px] tracking-normal text-[#0f172a]">
                      Terms &amp; Conditions
                    </a>{" "}
                    <span className="text-[14px] font-normal leading-[20px] tracking-normal text-[#64748b]">and</span>{" "}
                    <a href="#" className="text-[14px] font-semibold leading-[20px] tracking-normal text-[#0f172a]">
                      Privacy Policy
                    </a>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!canCreateAccount}
                  className="mt-[38px] flex h-[52px] w-full items-center justify-center rounded-[8px] align-middle text-[16px] font-semibold leading-[22px] tracking-normal transition disabled:cursor-not-allowed disabled:bg-[#dddddd] disabled:text-[#c5c5c5] enabled:text-white enabled:hover:brightness-95"
                  style={{
                    backgroundImage: canCreateAccount ? BRAAS_BUTTON_GRADIENT : undefined,
                    fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
                  }}
                >
                  Create an account
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
                  <Link href="/login?next=/tenant-onboarding" className="font-semibold text-[#0b0f19] hover:underline">
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
              alt="Braas HR signup"
              fill
              sizes="510px"
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/45" />
            <div className="relative z-10 flex flex-col items-center justify-center gap-[40px] text-center">
              <Image
                src="/icons/braas-HR/white-BrassHR-logo.svg"
                alt="Braas HR"
                width={160}
                height={80}
                priority
                className="h-[80px] w-[160px] object-contain"
              />
              <p
                className="max-w-[300px] text-center text-[24px] font-bold leading-[30px] tracking-[0.03em] text-white"
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
