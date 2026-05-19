"use client";

import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaApple } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { FcGoogle } from "react-icons/fc";
import VerificationSuccessModal from "@/app/components/VerificationSuccessModal";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import ClassicTenantLogin from "@/app/login/ClassicTenantLogin";
import { LoginBrandHeader, LoginPageShell, interStyle } from "@/app/login/BraasLoginShell";
import LoginOtpStep from "@/app/login/LoginOtpStep";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import { resolveGodAdminClient } from "@/lib/auth/resolve-god-admin-client";
import { isNexusPlatformUser, isPlatformEnforcementEnabled } from "@/lib/auth/platform-shared";
import { persistOnboardingSlugCookie } from "@/lib/tenant/client-onboarding-slug";
import {
  brandingFallbackForSlug,
  brandingToCssVars,
  PLATFORM_DEFAULT_TENANT_SLUG,
  usesBraasFigmaLoginUi,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";
import { supabaseBrowser } from "@/lib/supabase-browser";

const inputFocusClass =
  "focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]";

const checkboxActiveClass = "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]";

function primaryButtonStyle(enabled: boolean): React.CSSProperties | undefined {
  if (!enabled) return undefined;
  return {
    backgroundImage: "linear-gradient(90deg, var(--brand-primary) 0%, var(--brand-accent) 100%)",
    fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
  };
}

const inputTypographyStyle = {
  fontFamily: "Inter, Arial, sans-serif",
  fontSize: "16px",
  lineHeight: "24px",
  fontWeight: 400,
  letterSpacing: "0",
} as const;
const inputTextClass =
  "text-[16px] font-normal leading-[24px] tracking-normal placeholder:text-[16px] placeholder:leading-[24px] placeholder:font-normal";

type LoginStep = "credentials" | "otp";

type PendingLogin = {
  email: string;
  password: string;
  rememberMe: boolean;
};

function FieldLabel({ children }: { children: string }) {
  return (
    <label className="mb-[8px] block text-[14px] font-normal leading-[20px] tracking-normal text-[#374151]" style={interStyle}>
      {children}
      <span className="ml-1 text-[#e11d48]">*</span>
    </label>
  );
}

function LoginLoadingShell({ tenantQuery }: { tenantQuery: string | null }) {
  if (usesBraasFigmaLoginUi(tenantQuery)) {
    return <div className="min-h-screen bg-white" />;
  }
  const slug = tenantQuery?.trim().toLowerCase() || "nexus";
  const shellStyle = {
    ...brandingToCssVars(brandingFallbackForSlug(slug)),
    background: "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
  };
  return <div className="min-h-screen" style={shellStyle} />;
}

function SocialButton({ children, label }: { children: React.ReactNode; label: string }) {
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

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantQuery = searchParams.get("tenant");
  const useBraasUi = usesBraasFigmaLoginUi(tenantQuery);
  const [step, setStep] = useState<LoginStep>("credentials");
  const [showSuccess, setShowSuccess] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<PendingLogin | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<TenantBranding | null>(null);
  const [brandLoaded, setBrandLoaded] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    rememberMe: false,
    agree: false,
  });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const qpRaw = searchParams.get("tenant")?.trim().toLowerCase();
      const qp = qpRaw != null && qpRaw.length >= 2 ? qpRaw : null;
      if (qp) persistOnboardingSlugCookie(qp);
      const slug = qp ?? PLATFORM_DEFAULT_TENANT_SLUG;

      try {
        const res = await fetch(`/api/tenant-branding?slug=${encodeURIComponent(slug)}`, {
          cache: "no-store",
        });
        const payload = (await res.json()) as { branding?: TenantBranding };
        if (alive && payload.branding) setBrand(payload.branding);
      } catch {
        /* keep default branding */
      } finally {
        if (alive) setBrandLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [searchParams]);

  useEffect(() => {
    const previousHtmlBg = document.documentElement.style.backgroundColor;
    const previousBodyBg = document.body.style.backgroundColor;

    if (useBraasUi) {
      document.documentElement.style.backgroundColor = "#ffffff";
      document.body.style.backgroundColor = "#ffffff";
    } else {
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
    }

    if (useBraasUi) {
      try {
        const savedEmail = localStorage.getItem("braasLoginEmail");
        if (savedEmail) {
          setForm((prev) => ({ ...prev, email: savedEmail, rememberMe: true }));
        }
      } catch {
        /* ignore storage errors */
      }
    }

    return () => {
      document.documentElement.style.backgroundColor = previousHtmlBg;
      document.body.style.backgroundColor = previousBodyBg;
    };
  }, [useBraasUi]);

  useEffect(() => {
    const q = searchParams.get("error");
    if (q === "platform") {
      setError("This account is not authorized for this platform.");
    }
  }, [searchParams]);

  const canSubmit = useMemo(() => {
    return form.email.trim().length > 0 && form.password.length > 0 && form.agree;
  }, [form.agree, form.email, form.password]);

  const finishAuthenticatedSession = async (
    login: PendingLogin,
    options?: { godAdmin?: boolean }
  ) => {
    try {
      if (login.rememberMe) {
        localStorage.setItem("braasLoginEmail", login.email);
      } else {
        localStorage.removeItem("braasLoginEmail");
      }
    } catch {
      /* ignore storage errors */
    }

    const { data: userData } = await supabaseBrowser.auth.getUser();
    const godAdmin =
      options?.godAdmin === true ||
      isGodAdminUser(userData.user) ||
      (await resolveGodAdminClient(userData.user));

    if (
      isPlatformEnforcementEnabled() &&
      (!userData.user || (!isNexusPlatformUser(userData.user) && !godAdmin))
    ) {
      await supabaseBrowser.auth.signOut();
      setShowSuccess(false);
      setStep("credentials");
      setError("This account is not authorized for this platform.");
      return false;
    }

    const nextPath = searchParams.get("next");
    const defaultNext = godAdmin
      ? "/admin_recruiter/dashboard"
      : useBraasUi
        ? "/tenant-onboarding"
        : "/admin_recruiter/dashboard";
    const safeNext =
      typeof nextPath === "string" &&
      nextPath.startsWith("/") &&
      !nextPath.startsWith("//") &&
      !nextPath.startsWith("/login")
        ? nextPath
        : defaultNext;

    router.push(safeNext);
    router.refresh();
    return true;
  };

  const handleCredentialsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    const login: PendingLogin = {
      email: form.email.trim(),
      password: form.password,
      rememberMe: form.rememberMe,
    };

    setSubmitting(true);
    const { error: signInError, data: signInData } = await supabaseBrowser.auth.signInWithPassword({
      email: login.email,
      password: login.password,
    });

    if (signInError) {
      setError(signInError.message || "Login failed");
      setSubmitting(false);
      return;
    }

    const godAdmin = await resolveGodAdminClient(signInData.user);
    if (godAdmin) {
      setPendingLogin(login);
      const ok = await finishAuthenticatedSession(login, { godAdmin: true });
      setSubmitting(false);
      if (!ok) return;
      return;
    }

    await supabaseBrowser.auth.signOut();
    setPendingLogin(login);
    setStep("otp");
    setSubmitting(false);
  };

  const completeLogin = async (credentials?: PendingLogin) => {
    const login = credentials ?? pendingLogin;
    if (!login) return;

    setSubmitting(true);
    setError(null);

    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();

    if (!session) {
      const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({
        email: login.email,
        password: login.password,
      });

      if (signInError) {
        setShowSuccess(false);
        setStep("credentials");
        setError(signInError.message || "Login failed");
        setSubmitting(false);
        return;
      }
    }

    const ok = await finishAuthenticatedSession(login);
    if (!ok) {
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  };

  const handleOtpVerify = (_code: string) => {
    setShowSuccess(true);
  };

  const handleSuccessContinue = () => {
    void completeLogin();
  };

  const handleClassicSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.email.trim() || !form.password || !form.agree) return;
    void completeLogin({
      email: form.email.trim(),
      password: form.password,
      rememberMe: false,
    });
  };

  if (!brandLoaded || !brand) {
    return <LoginLoadingShell tenantQuery={tenantQuery} />;
  }

  if (!useBraasUi) {
    return (
      <TenantBrandingProvider branding={brand}>
        <ClassicTenantLogin
          brand={brand}
          form={form}
          showPassword={showPassword}
          submitting={submitting}
          error={error}
          onFormChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onTogglePassword={() => setShowPassword((current) => !current)}
          onSubmit={handleClassicSubmit}
        />
      </TenantBrandingProvider>
    );
  }

  return (
    <>
      <LoginPageShell brand={brand}>
        {showSuccess ? (
          <VerificationSuccessModal
            title="Success!"
            message="Verification complete"
            buttonLabel={submitting ? "Continuing..." : "Continue"}
            loading={submitting}
            onAction={handleSuccessContinue}
          />
        ) : null}

        <LoginBrandHeader brand={brand} />

        {step === "otp" && pendingLogin ? (
          <LoginOtpStep email={pendingLogin.email} submitting={submitting} onVerify={handleOtpVerify} />
        ) : (
          <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-[40px] pt-[30px]">
            <div>
              <h1 className="text-[30px] font-semibold leading-[36px] tracking-normal text-black" style={interStyle}>
                Login
              </h1>
              <p className="mt-[8px] text-[16px] font-normal leading-[24px] text-[#6b7280]" style={interStyle}>
                Account login
              </p>
            </div>

            <div className="flex flex-col gap-[30px]">
              <div className="flex flex-col gap-[20px]">
                <div className="flex flex-col gap-[40px]">
                  <div>
                    <FieldLabel>Email</FieldLabel>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                      placeholder="Email"
                      autoComplete="email"
                      style={inputTypographyStyle}
                      className={`h-[56px] w-full rounded-[8px] border border-[#cbd5e1] bg-white px-[14px] ${inputTextClass} text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] ${inputFocusClass}`}
                      required
                    />
                  </div>

                  <div>
                    <FieldLabel>Password</FieldLabel>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                        placeholder="Password"
                        autoComplete="current-password"
                        style={inputTypographyStyle}
                        className={`h-[56px] w-full rounded-[8px] border border-[#cbd5e1] bg-white px-[14px] pr-12 ${inputTextClass} text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] ${inputFocusClass}`}
                        required
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((current) => !current)}
                        className={`absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition ${
                          showPassword
                            ? "bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)] ring-1 ring-[color:color-mix(in_srgb,var(--brand-primary)_25%,transparent)]"
                            : "hover:bg-[#f8fafc]"
                        }`}
                      >
                        <Image
                          src="/icons/braas-HR/eye.svg"
                          alt=""
                          width={20}
                          height={20}
                          className="h-[20px] w-[20px]"
                          style={{
                            filter: showPassword
                              ? "brightness(0) saturate(100%) invert(55%) sepia(33%) saturate(738%) hue-rotate(359deg) brightness(88%) contrast(86%)"
                              : undefined,
                          }}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label
                    className="flex cursor-pointer items-center gap-[8px] text-[14px] font-normal leading-[20px] text-[#374151]"
                    style={interStyle}
                  >
                    <span
                      className={`relative flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] border ${
                        form.rememberMe ? checkboxActiveClass : "border-[#e2e8f0] bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.rememberMe}
                        onChange={(event) => setForm((prev) => ({ ...prev, rememberMe: event.target.checked }))}
                        className="absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
                        aria-label="Remember me"
                      />
                      {form.rememberMe ? <Check className="h-[14px] w-[14px] text-white" strokeWidth={3} /> : null}
                    </span>
                    Remember Me
                  </label>
                  <a
                    href="#"
                    className="text-[14px] font-normal leading-[20px] hover:underline"
                    style={{ ...interStyle, color: "var(--brand-secondary)" }}
                  >
                    Forgot Password?
                  </a>
                </div>
              </div>

              <label
                className="flex cursor-pointer items-start gap-[8px] text-[14px] font-normal leading-[20px] text-[#4b5563]"
                style={interStyle}
              >
                <span
                  className={`relative mt-px flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] border ${
                    form.agree ? checkboxActiveClass : "border-[#e2e8f0] bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.agree}
                    onChange={(event) => setForm((prev) => ({ ...prev, agree: event.target.checked }))}
                    className="absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
                    aria-label="Accept terms and conditions"
                  />
                  {form.agree ? <Check className="h-[14px] w-[14px] text-white" strokeWidth={3} /> : null}
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

            {error ? (
              <div
                className="rounded-[8px] border border-[#fecaca] bg-[#fef2f2] px-[14px] py-[12px] text-[14px] leading-[20px] text-[#b91c1c]"
                style={interStyle}
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="flex h-[54px] w-full items-center justify-center rounded-[12px] text-[16px] font-semibold leading-[22px] tracking-normal transition disabled:cursor-not-allowed disabled:bg-[#dddddd] disabled:text-[#c5c5c5] enabled:text-white enabled:hover:brightness-95"
              style={primaryButtonStyle(canSubmit && !submitting)}
            >
              Log In
            </button>

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

            <p className="text-center text-[14px] font-normal leading-[20px] text-[#374151]" style={interStyle}>
              Don&apos;t have an Account?{" "}
              <Link href="/signup" className="font-semibold text-black underline">
                Sign Up
              </Link>
            </p>
          </form>
        )}
      </LoginPageShell>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginPageContent />
    </Suspense>
  );
}
