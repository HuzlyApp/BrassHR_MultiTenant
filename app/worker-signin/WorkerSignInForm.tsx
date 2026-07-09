"use client";

import RedirectionProgressModal from "@/app/components/RedirectionProgressModal";
import { PasswordVisibilityToggle } from "@/app/components/PasswordVisibilityToggle";
import Link from "next/link";
import LoginFormError, { loginInputErrorClass } from "@/app/login/LoginFormError";
import { interStyle, loginInputClass, loginPasswordInputClass, loginPrimaryButtonClass } from "@/app/login/BraasLoginShell";
import { useApplicantSignIn } from "@/lib/applicant-portal/use-applicant-sign-in";
import { recruiterSignInHref } from "@/lib/auth/recruiter-sign-in";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { brandingAuthButtonStyle } from "@/lib/tenant/tenant-branding";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { FaApple } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { FcGoogle } from "react-icons/fc";

const checkboxActiveClass = "border-[#012352] bg-[#012352]";
const workerPageStackClass = "flex flex-col gap-5 pt-3 sm:gap-[40px] sm:pt-[30px]";
const workerFormStackClass = "flex flex-col gap-6 sm:gap-[20px]";
const workerEmailFormStackClass = "flex flex-col gap-5 sm:gap-[30px]";
const workerFieldLabelClass =
  "mb-2 block text-[13px] font-normal leading-[18px] tracking-normal text-[#374151] sm:mb-[8px] sm:text-[14px] sm:leading-[20px]";

function primaryButtonStyle(enabled: boolean): CSSProperties | undefined {
  return brandingAuthButtonStyle(enabled);
}

function FieldLabel({ children }: { children: string }) {
  return (
    <label className={workerFieldLabelClass} style={interStyle}>
      {children}
      <span className="ml-1 text-[#e11d48]">*</span>
    </label>
  );
}

function SocialButton({ children, label }: { children: ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-[40px] w-[40px] items-center justify-center rounded-[8px] border border-[#e5e7eb] bg-white text-[18px] text-black transition hover:bg-[#f8fafc]"
    >
      {children}
    </button>
  );
}

function SocialLoginSection() {
  return (
    <div className="flex flex-col gap-4 pt-2 sm:gap-[14px] sm:pt-0">
      <div className="flex items-center gap-[14px]">
        <div className="h-px flex-1 bg-[#e7edf4]" />
        <span className="text-[12px] font-normal leading-[16px] text-[#6b7280]" style={interStyle}>
          OR
        </span>
        <div className="h-px flex-1 bg-[#e7edf4]" />
      </div>

      <div className="flex justify-center gap-[15px]">
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
    </div>
  );
}

type LoginFormOptionsProps = {
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
  agree: boolean;
  setAgree: (value: boolean) => void;
};

function LoginFormOptions({ rememberMe, setRememberMe, agree, setAgree }: LoginFormOptionsProps) {
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="flex items-center justify-between gap-3">
        <label
          className="flex cursor-pointer items-center gap-2 text-[13px] font-normal leading-[18px] text-[#374151] sm:gap-[8px] sm:text-[14px] sm:leading-[20px]"
          style={interStyle}
        >
          <span
            className={`relative flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] border ${
              rememberMe ? checkboxActiveClass : "border-[#e2e8f0] bg-white"
            }`}
          >
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
              aria-label="Remember me"
            />
            {rememberMe ? <Check className="h-[14px] w-[14px] text-white" strokeWidth={3} /> : null}
          </span>
          Remember Me
        </label>
        <Link
          href="/forgot"
          className="text-[14px] font-normal leading-[20px] hover:underline"
          style={{ ...interStyle, color: "var(--brand-secondary)" }}
        >
          Forgot Password?
        </Link>
      </div>

      <label
        className="flex cursor-pointer items-start gap-2 text-[13px] font-normal leading-[18px] text-[#4b5563] sm:gap-[8px] sm:text-[14px] sm:leading-[20px]"
        style={interStyle}
      >
        <span
          className={`relative mt-px flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] border ${
            agree ? checkboxActiveClass : "border-[#e2e8f0] bg-white"
          }`}
        >
          <input
            type="checkbox"
            checked={agree}
            onChange={(event) => setAgree(event.target.checked)}
            className="absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
            aria-label="Accept terms and conditions"
          />
          {agree ? <Check className="h-[14px] w-[14px] text-white" strokeWidth={3} /> : null}
        </span>
        <span>
          I hereby confirm that I have read and agree with the{" "}
          <a href="#" className="font-semibold text-black">
            Terms &amp; Conditions
          </a>{" "}
          and{" "}
          <a href="#" className="font-semibold text-black">
            Privacy Policy
          </a>
        </span>
      </label>
    </div>
  );
}

type Props = {
  tenantSlug: string | null;
  brand: TenantBranding;
};

export default function WorkerSignInForm({ tenantSlug, brand }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [agree, setAgree] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const {
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    mode,
    error,
    loading,
    handleLookup,
    handleSetup,
    handlePasswordLogin,
    resetToEmail,
    setError,
    signInReady,
    completeSignIn,
  } = useApplicantSignIn(tenantSlug);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("workerSignInEmail");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      /* ignore storage errors */
    }
  }, [setEmail]);

  useEffect(() => {
    if (!signInReady || redirecting) return;
    setRedirecting(true);
    completeSignIn(rememberMe);
  }, [signInReady, redirecting, rememberMe, completeSignIn]);

  const emailLocked = mode === "password" || mode === "setup";
  const canSubmitEmail = email.trim().length > 0 && Boolean(tenantSlug);
  const canSubmitSetup =
    password.length >= 8 && confirmPassword.length >= 8 && agree && Boolean(tenantSlug);
  const canSubmitPassword = password.length > 0 && agree && Boolean(tenantSlug);

  function handleResetToEmail() {
    setAgree(false);
    resetToEmail();
  }

  const emailInputClass = `${loginInputClass} ${
    emailLocked ? "bg-[#f8fafc] text-[#64748b]" : "bg-white"
  } ${mode === "email" && error ? loginInputErrorClass : ""}`;

  return (
    <>
      {redirecting ? <RedirectionProgressModal /> : null}

      <div className={workerPageStackClass}>
      <div>
        <h1 className="text-[22px] font-semibold leading-[30px] tracking-normal text-black sm:text-[30px] sm:leading-[36px]" style={interStyle}>
          Login
        </h1>
        <p className="mt-1 text-[14px] font-normal leading-[20px] text-[#6b7280] sm:mt-[8px] sm:text-[16px] sm:leading-[24px]" style={interStyle}>
          Worker sign in
        </p>
        <p className="mt-1 text-[13px] font-normal leading-[18px] text-[#6b7280] sm:mt-[8px] sm:text-[14px] sm:leading-[20px]" style={interStyle}>
          Approved applicants can sign in to view status, message your recruiter, and complete next steps.
        </p>
      </div>

      {!tenantSlug ? (
        <LoginFormError
          message="Open this page from your organization link or add ?tenant=your-company to the URL."
          title="Organization required"
        />
      ) : null}

      {mode === "email" ? (
        <form onSubmit={handleLookup} className={workerEmailFormStackClass}>
          <div>
            <FieldLabel>Email</FieldLabel>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => {
                setError(null);
                setEmail(event.target.value);
              }}
              placeholder="Email"
              autoComplete="email"
              aria-invalid={Boolean(error)}
              className={emailInputClass}
            />
            {error ? (
              <div className="mt-[12px]">
                <LoginFormError message={error} />
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={!canSubmitEmail || loading}
            className={loginPrimaryButtonClass}
            style={primaryButtonStyle(canSubmitEmail && !loading)}
          >
            {loading ? "Checking..." : "Continue"}
          </button>

          <SocialLoginSection />
        </form>
      ) : null}

      {mode === "setup" ? (
        <form onSubmit={handleSetup} className={workerFormStackClass}>
          <div>
            <FieldLabel>Email</FieldLabel>
            <input
              type="email"
              value={email}
              readOnly
              aria-readonly="true"
              className={emailInputClass}
            />
          </div>

          <div>
            <FieldLabel>Password</FieldLabel>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(event) => {
                  setError(null);
                  setPassword(event.target.value);
                }}
                placeholder="Password"
                autoComplete="new-password"
                className={loginPasswordInputClass}
              />
              <PasswordVisibilityToggle
                visible={showPassword}
                onToggle={() => setShowPassword((current) => !current)}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Re-enter password</FieldLabel>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => {
                  setError(null);
                  setConfirmPassword(event.target.value);
                }}
                placeholder="Re-enter password"
                autoComplete="new-password"
                aria-invalid={Boolean(error)}
                className={`${loginPasswordInputClass} ${error ? loginInputErrorClass : ""}`}
              />
              <PasswordVisibilityToggle
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((current) => !current)}
                label="confirm password"
              />
            </div>
            {error ? (
              <div className="mt-[12px]">
                <LoginFormError message={error} />
              </div>
            ) : null}
          </div>

          <LoginFormOptions
            rememberMe={rememberMe}
            setRememberMe={setRememberMe}
            agree={agree}
            setAgree={setAgree}
          />

          <button
            type="submit"
            disabled={!canSubmitSetup || loading}
            className={loginPrimaryButtonClass}
            style={primaryButtonStyle(canSubmitSetup && !loading)}
          >
            {loading ? "Saving..." : "Create password and continue"}
          </button>

          <button
            type="button"
            onClick={handleResetToEmail}
            className="w-full text-center text-[14px] font-normal leading-[20px] text-[#6b7280] hover:text-[#374151]"
            style={interStyle}
          >
            Use a different email
          </button>

          <SocialLoginSection />
        </form>
      ) : null}

      {mode === "password" ? (
        <form onSubmit={handlePasswordLogin} className={workerFormStackClass}>
          <div>
            <FieldLabel>Email</FieldLabel>
            <input
              type="email"
              value={email}
              readOnly
              aria-readonly="true"
              className={emailInputClass}
            />
          </div>

          <div>
            <FieldLabel>Password</FieldLabel>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(event) => {
                  setError(null);
                  setPassword(event.target.value);
                }}
                placeholder="Password"
                autoComplete="current-password"
                aria-invalid={Boolean(error)}
                className={`${loginPasswordInputClass} ${error ? loginInputErrorClass : ""}`}
              />
              <PasswordVisibilityToggle
                visible={showPassword}
                onToggle={() => setShowPassword((current) => !current)}
              />
            </div>
            {error ? (
              <div className="mt-[12px]">
                <LoginFormError message={error} />
              </div>
            ) : null}
          </div>

          <LoginFormOptions
            rememberMe={rememberMe}
            setRememberMe={setRememberMe}
            agree={agree}
            setAgree={setAgree}
          />

          <button
            type="submit"
            disabled={!canSubmitPassword || loading}
            className={loginPrimaryButtonClass}
            style={primaryButtonStyle(canSubmitPassword && !loading)}
          >
            {loading ? "Signing in..." : "Log In"}
          </button>

          <button
            type="button"
            onClick={handleResetToEmail}
            className="w-full text-center text-[14px] font-normal leading-[20px] text-[#6b7280] hover:text-[#374151]"
            style={interStyle}
          >
            Use a different email
          </button>

          <SocialLoginSection />
        </form>
      ) : null}

      <p className="mt-2 text-center text-[14px] font-normal leading-[20px] text-[#374151] sm:mt-0" style={interStyle}>
        Need to sign in as a recruiter?{" "}
        <Link
          href={recruiterSignInHref({ tenant: tenantSlug })}
          className="font-semibold underline"
          style={{ color: "var(--brand-secondary)" }}
        >
          Sign in
        </Link>
      </p>
      </div>
    </>
  );
}
