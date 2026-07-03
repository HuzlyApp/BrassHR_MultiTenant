"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import OnboardingCheckbox from "@/app/components/OnboardingCheckbox";
import OnboardingLayout from "@/app/components/OnboardingLayout";
import { PasswordVisibilityToggle } from "@/app/components/PasswordVisibilityToggle";
import LoginOtpStep from "@/app/login/LoginOtpStep";
import { cn } from "@/lib/cn";
import type { LoginAuthErrorPayload } from "@/lib/auth/login-api-errors";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { brandingAuthButtonStyle } from "@/lib/tenant/tenant-branding";

export type ClassicLoginFormState = {
  email: string;
  password: string;
  agree: boolean;
};

type ClassicTenantLoginProps = {
  brand: TenantBranding;
  form: ClassicLoginFormState;
  showPassword: boolean;
  submitting: boolean;
  error: string | null;
  otpStep?: boolean;
  otpEmail?: string;
  otpVerified?: boolean;
  otpAuthError?: LoginAuthErrorPayload | null;
  onOtpClearError?: () => void;
  onOtpVerify?: (code: string) => void | Promise<void>;
  onOtpSendAgain?: () => void | Promise<void>;
  onFormChange: (patch: Partial<ClassicLoginFormState>) => void;
  onTogglePassword: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  forgotReturnTo?: string;
};

export default function ClassicTenantLogin({
  brand,
  form,
  showPassword,
  submitting,
  error,
  otpStep = false,
  otpEmail = "",
  otpVerified = false,
  otpAuthError,
  onOtpClearError,
  onOtpVerify,
  onOtpSendAgain,
  onFormChange,
  onTogglePassword,
  onSubmit,
  forgotReturnTo,
}: ClassicTenantLoginProps) {
  const router = useRouter();
  const canSubmit = form.email.trim().length > 0 && form.password.length > 0 && form.agree;
  const forgotHref = forgotReturnTo
    ? `/forgot?return=${encodeURIComponent(forgotReturnTo)}`
    : "/forgot";

  return (
    <OnboardingLayout
      cardClassName="md:w-[950px] md:min-w-[950px] md:max-w-[950px] md:h-[622px] md:min-h-[550px] md:grid-cols-[560px_390px]"
      rightPanelImageSrc={brand.loginBackgroundSrc}
      rightPanelImageAlt=""
      rightPanelImageClassName="object-cover opacity-60 grayscale"
      rightPanelOverlayClassName="bg-white/65"
      rightPanelContentClassName="p-6"
      taglineClassName="text-[15px] leading-6 text-slate-700"
    >
      <div className="flex flex-col justify-center p-6 md:p-10 lg:p-12">
        {otpStep && otpEmail && onOtpVerify && onOtpSendAgain ? (
          <LoginOtpStep
            email={otpEmail}
            submitting={submitting}
            verified={otpVerified}
            authError={otpAuthError}
            onClearError={onOtpClearError}
            onVerify={onOtpVerify}
            onSendAgain={onOtpSendAgain}
          />
        ) : (
          <>
        <div className="mb-10">
          <div className="mb-4 h-1 w-12 rounded-full" style={{ backgroundColor: "var(--brand-primary)" }} />
          <h1
            className="text-3xl font-bold md:text-4xl"
            style={{ color: "var(--brand-heading)", fontFamily: "var(--brand-font-heading)" }}
          >
            {brand.headline}
          </h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label htmlFor="classic-email" className="mb-1.5 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="classic-email"
              name="email"
              type="email"
              value={form.email}
              onChange={(event) => onFormChange({ email: event.target.value })}
              placeholder="Email"
              autoComplete="email"
              className={cn(
                "w-full rounded-lg border border-gray-300 px-4 py-3.5",
                "text-black outline-none placeholder-gray-400 transition-all",
                "focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_45%,transparent)]"
              )}
              required
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div>
            <label htmlFor="classic-password" className="mb-1.5 block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                id="classic-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => onFormChange({ password: event.target.value })}
                placeholder="Password"
                autoComplete="current-password"
                className={cn(
                  "w-full rounded-lg border border-gray-300 px-4 py-3.5 pr-11",
                  "text-black outline-none placeholder-gray-400 transition-all",
                  "focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_45%,transparent)]"
                )}
                required
              />
              <PasswordVisibilityToggle
                visible={showPassword}
                onToggle={onTogglePassword}
                className="right-4"
              />
            </div>
            <div className="mt-2 flex justify-end">
              <Link
                href={forgotHref}
                className="text-sm font-medium hover:underline"
                style={{ color: "var(--brand-primary)" }}
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          <div className="pt-2">
            <OnboardingCheckbox
              checked={form.agree}
              onChange={(checked) => onFormChange({ agree: checked })}
              className="flex items-start gap-3"
            >
              <span className="text-sm leading-6 text-gray-600">
                By checking this box you agree to our{" "}
                <a href="#" style={{ color: "var(--brand-primary)" }} className="font-medium underline">
                  Terms &amp; Conditions
                </a>
              </span>
            </OnboardingCheckbox>
          </div>

          <div className="flex flex-col gap-4 pt-6 sm:flex-row">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-lg border border-gray-300 py-3.5 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              style={brandingAuthButtonStyle(canSubmit && !submitting)}
              className={cn(
                "flex-1 rounded-lg py-3.5 font-medium transition-colors",
                "disabled:cursor-not-allowed",
                canSubmit && !submitting && "hover:brightness-105"
              )}
            >
              {submitting ? "Logging in..." : brand.buttonText}
            </button>
          </div>
        </form>
          </>
        )}
      </div>
    </OnboardingLayout>
  );
}
