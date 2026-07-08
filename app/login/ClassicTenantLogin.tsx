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
      cardClassName="h-auto w-full max-w-[560px] md:block md:h-auto md:min-h-0 md:min-w-0 md:max-w-[560px] lg:grid lg:h-full lg:w-[950px] lg:min-w-[950px] lg:max-w-[950px] lg:min-h-[622px] lg:grid-cols-[560px_390px]"
      rightPanelClassName="md:hidden lg:block"
      rightPanelImageSrc={brand.loginBackgroundSrc}
      rightPanelImageAlt=""
      rightPanelImageClassName="object-cover opacity-60 grayscale"
      rightPanelOverlayClassName="bg-white/65"
      rightPanelContentClassName="p-6"
      taglineClassName="text-[15px] leading-6 text-slate-700"
    >
      <div className="flex flex-col overflow-y-auto p-6 pb-8 md:p-10 md:pb-10 lg:min-h-full lg:p-12 lg:pb-12">
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
        <div className="mb-8 md:mb-10">
          <div className="mb-4 h-1 w-12 rounded-full" style={{ backgroundColor: "var(--brand-primary)" }} />
          <h1
            className="text-[22px] font-bold leading-[27px] sm:text-3xl sm:leading-[38px] md:text-4xl md:leading-[44px]"
            style={{ color: "var(--brand-heading)", fontFamily: "var(--brand-font-heading)" }}
          >
            {brand.headline}
          </h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 md:space-y-6">
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
                "w-full rounded-lg border px-4 py-3.5",
                "text-black outline-none placeholder-gray-400 transition-all",
                error
                  ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                  : "border-gray-300 focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_45%,transparent)]"
              )}
              required
            />
          </div>

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
                aria-invalid={Boolean(error)}
                className={cn(
                  "w-full rounded-lg border px-4 py-3.5 pr-11",
                  "text-black outline-none placeholder-gray-400 transition-all",
                  error
                    ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                    : "border-gray-300 focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_45%,transparent)]"
                )}
                required
              />
              <PasswordVisibilityToggle
                visible={showPassword}
                onToggle={onTogglePassword}
                className="right-4"
              />
            </div>
            {error ? (
              <p className="mt-2 text-sm font-medium text-red-600" role="alert" aria-live="polite">
                {error}
              </p>
            ) : null}
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

          <div className="mt-2 flex flex-row gap-3 pt-4 sm:gap-4">
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
