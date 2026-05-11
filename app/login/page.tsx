"use client";

import type { CSSProperties } from "react";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import OnboardingCheckbox from "@/app/components/OnboardingCheckbox";
import OnboardingLayout from "@/app/components/OnboardingLayout";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import {
  brandingToCssVars,
  defaultTenantBranding,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";
import { persistOnboardingSlugCookie, resolveClientOnboardingTenantSlug } from "@/lib/tenant/client-onboarding-slug";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import { isNexusPlatformUser, isPlatformEnforcementEnabled } from "@/lib/auth/platform-shared";
import { cn } from "@/lib/cn";
import { supabaseBrowser } from "@/lib/supabase-browser";

function LoadingShell() {
  const s: CSSProperties = {
    ...brandingToCssVars(defaultTenantBranding()),
    background: `linear-gradient(135deg, var(--brand-gradient-from), var(--brand-gradient-to))`,
  };
  return <div className="min-h-screen" style={s} />;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<TenantBranding>(() => defaultTenantBranding());
  const [form, setForm] = useState({
    username: "",
    password: "",
    agree: false,
  });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const qpRaw = searchParams.get("tenant")?.trim().toLowerCase();
      const qp = qpRaw != null && qpRaw.length >= 2 ? qpRaw : null;
      const cookieSlug =
        typeof window !== "undefined" ? resolveClientOnboardingTenantSlug(window.location.search) : null;
      if (qp) persistOnboardingSlugCookie(qp);
      const slug = qp ?? cookieSlug ?? undefined;

      try {
        const res = await fetch(slug ? `/api/public/tenant?slug=${encodeURIComponent(slug)}` : "/api/public/tenant", {
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => ({}))) as { branding?: TenantBranding };
        if (!alive || !payload.branding) return;
        setBrand(payload.branding);
      } catch {
        /* keep default branding */
      }
    })();
    return () => {
      alive = false;
    };
  }, [searchParams]);

  useEffect(() => {
    const q = searchParams.get("error");
    if (q === "platform") {
      setError("This account is not authorized for this platform.");
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password || !form.agree) return;
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({
      email: form.username.trim(),
      password: form.password,
    });

    if (signInError) {
      setError(signInError.message || "Login failed");
      setSubmitting(false);
      return;
    }

    const { data: userData } = await supabaseBrowser.auth.getUser();
    if (
      isPlatformEnforcementEnabled() &&
      (!userData.user ||
        (!isNexusPlatformUser(userData.user) && !isGodAdminUser(userData.user)))
    ) {
      await supabaseBrowser.auth.signOut();
      setError("This account is not authorized for this platform.");
      setSubmitting(false);
      return;
    }

    const nextPath = searchParams.get("next");
    const safeNext =
      typeof nextPath === "string" &&
      nextPath.startsWith("/") &&
      !nextPath.startsWith("//") &&
      !nextPath.startsWith("/login")
        ? nextPath
        : "/admin_recruiter/dashboard";
    if (safeNext) {
      router.push(safeNext);
    } else {
      router.push("/admin_recruiter/dashboard");
    }
    router.refresh();
    setSubmitting(false);
  };

  return (
    <TenantBrandingProvider branding={brand}>
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="username"
                name="username"
                type="email"
                value={form.username}
                onChange={handleChange}
                placeholder="Email"
                autoComplete="email"
                className={cn(
                  "w-full rounded-lg border border-gray-300 px-4 py-3.5",
                  "text-black outline-none placeholder-gray-400 transition-all",
                  "focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary) 45%,transparent)]"
                )}
                required
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Password"
                  autoComplete="current-password"
                  className={cn(
                    "w-full rounded-lg border border-gray-300 px-4 py-3.5 pr-11",
                    "text-black outline-none placeholder-gray-400 transition-all",
                    "focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary) 45%,transparent)]"
                  )}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <OnboardingCheckbox
                checked={form.agree}
                onChange={(checked) => setForm((prev) => ({ ...prev, agree: checked }))}
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
                disabled={!form.username || !form.password || !form.agree || submitting}
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
    </TenantBrandingProvider>
  );
}

export default function AdminRecruiterLoginPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <LoginContent />
    </Suspense>
  );
}
