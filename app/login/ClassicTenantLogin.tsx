"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import OnboardingCheckbox from "@/app/components/OnboardingCheckbox";
import OnboardingLayout from "@/app/components/OnboardingLayout";
import { cn } from "@/lib/cn";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";

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
  onFormChange: (patch: Partial<ClassicLoginFormState>) => void;
  onTogglePassword: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function ClassicTenantLogin({
  brand,
  form,
  showPassword,
  submitting,
  error,
  onFormChange,
  onTogglePassword,
  onSubmit,
}: ClassicTenantLoginProps) {
  const router = useRouter();
  const canSubmit = form.email.trim().length > 0 && form.password.length > 0 && form.agree;

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
        <div className="mb-10">
          <div className="mb-4 h-1 w-12 rounded-full" style={{ backgroundColor: "var(--brand-primary)" }} />
          <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">Recruiter sign in</h1>
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
              <button
                type="button"
                onClick={onTogglePassword}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
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
              style={{ backgroundColor: "var(--brand-primary)" }}
              className={cn(
                "flex-1 rounded-lg py-3.5 font-medium text-white transition-colors",
                "hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              )}
            >
              {submitting ? "Logging in..." : "Log in"}
            </button>
          </div>
        </form>
      </div>
    </OnboardingLayout>
  );
}
