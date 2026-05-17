"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars, defaultTenantBranding } from "@/lib/tenant/tenant-branding";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import { subdomainErrorMessage, validateTenantSubdomainInput } from "@/lib/tenant/subdomain-validation";
import OnboardingStepsBuilder, { createInitialBuilderSteps } from "@/app/components/onboarding/OnboardingStepsBuilder";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import { withTenant } from "@/lib/tenant/with-tenant";

type Step = "org" | "brand" | "onboarding" | "preview" | "admin" | "done";

function PreviewCard({ b }: { b: TenantBranding }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
      <div
        className="grid gap-6 p-8 md:grid-cols-[1fr_minmax(0,280px)]"
        style={{
          background: `linear-gradient(135deg, ${b.primaryHex}33 0%, ${b.secondaryHex}44 100%)`,
        }}
      >
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold text-slate-900">{b.headline}</h2>
          <p className="text-slate-600">{b.subtitle}</p>
          <button
            type="button"
            style={{ backgroundColor: b.primaryHex }}
            className="rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-md"
          >
            Start application (preview)
          </button>
        </div>
        <div className="relative flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-white/60 bg-white/80 p-4 text-center backdrop-blur">
          <img src={b.logoUrl} alt="" className="h-14 max-w-[200px] object-contain" />
          <p className="text-xs text-slate-600">{b.tagline}</p>
          <img
            src={b.loginBackgroundSrc}
            alt=""
            className="pointer-events-none absolute inset-x-4 bottom-3 h-[84px] rounded-lg object-cover opacity-60"
          />
        </div>
      </div>
    </div>
  );
}

export default function TenantOnboardingPage() {
  const shell = defaultTenantBranding();

  const [step, setStep] = useState<Step>("org");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [onboardingSteps, setOnboardingSteps] = useState<OnboardingStepDraft[]>(() =>
    createInitialBuilderSteps()
  );
  const [primaryHex, setPrimaryHex] = useState(shell.primaryHex);
  const [secondaryHex, setSecondaryHex] = useState(shell.secondaryHex);
  const [accentHex, setAccentHex] = useState(shell.accentHex);
  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [createdDomain, setCreatedDomain] = useState<string | null>(null);
  const publicRootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() ?? "";

  const preview = useMemo((): TenantBranding => {
    return defaultTenantBranding({
      companyName: orgName.trim() || defaultTenantBranding().companyName,
      logoUrl: logoUrl.trim() || defaultTenantBranding().logoUrl,
      primaryHex,
      secondaryHex,
      accentHex,
      headline: headline.trim() || `Welcome to ${orgName.trim() || "your organization"}`,
      subtitle: subtitle.trim() || defaultTenantBranding().subtitle,
      loginBackgroundSrc: backgroundUrl.trim() || "/images/handshake.jpg",
      tagline: subtitle.trim()
        ? subtitle.trim()
        : `Applicants can onboard with branding unique to ${orgName.trim() || "your organization"}.`,
    });
  }, [accentHex, backgroundUrl, headline, logoUrl, orgName, primaryHex, secondaryHex, subtitle]);

  const finalize = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const validated = validateTenantSubdomainInput(subdomain);
      if ("failure" in validated) {
        setError(subdomainErrorMessage(validated.failure));
        setSubmitting(false);
        return;
      }
      const res = await fetch("/api/tenant-onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: orgName.trim(),
          subdomain: validated.subdomain,
          logoUrl: logoUrl.trim() || null,
          primaryColor: primaryHex,
          secondaryColor: secondaryHex,
          accentColor: accentHex,
          welcomeHeadline: headline.trim() || null,
          welcomeSubtitle: subtitle.trim() || null,
          authBackgroundImageUrl: backgroundUrl.trim() || null,
          adminEmail: adminEmail.trim().toLowerCase(),
          adminPassword,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        slug?: string;
        domain?: string;
        tenantId?: string;
        code?: string;
      };
      if (!res.ok) {
        setError(payload.error ?? "Something went wrong");
        setSubmitting(false);
        return;
      }
      setCreatedSlug(String(payload.slug ?? "").trim());
      setCreatedDomain(String(payload.domain ?? "").trim());
      document.cookie = `${ONBOARDING_TENANT_SLUG_COOKIE}=${encodeURIComponent(payload.slug ?? "")}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

      const tenantId = String(payload.tenantId ?? "").trim();
      if (tenantId && logoFile) {
        const fd = new FormData();
        fd.set("tenantId", tenantId);
        fd.set("file", logoFile);
        await fetch("/api/tenants/logo", { method: "POST", body: fd });
      }

      if (tenantId && onboardingSteps.length) {
        const saveRes = await fetch("/api/tenant-onboarding/save-onboarding-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, steps: onboardingSteps }),
        });
        if (!saveRes.ok) {
          const savePayload = (await saveRes.json().catch(() => ({}))) as { error?: string };
          setError(savePayload.error ?? "Could not save onboarding steps");
          setSubmitting(false);
          return;
        }
      }

      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TenantBrandingProvider branding={shell}>
      <main
        className="min-h-screen p-6"
        style={{
          background: `linear-gradient(135deg, ${preview.primaryHex} 0%, ${preview.secondaryHex} 100%)`,
        }}
      >
        <div
          className="mx-auto flex max-w-4xl flex-col gap-12 rounded-[28px] bg-white p-10 shadow-2xl"
          style={brandingToCssVars(preview) as React.CSSProperties}
        >
          <nav className="flex flex-wrap gap-4 text-sm text-slate-600">
            <Link href="/" className="font-semibold text-slate-800 hover:text-slate-900">
              Applicant landing
            </Link>
            <Link href="/login" className="hover:text-slate-900">
              Recruiter sign in
            </Link>
          </nav>

          <div className="mb-6 flex gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {(["org", "brand", "onboarding", "preview", "admin"] as const).map((s, i) => (
              <span key={s} className={step === s ? "text-slate-900" : undefined}>
                {i + 1}. {s}
              </span>
            ))}
          </div>

          {error ? (
            <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          ) : null}

          {step === "org" ? (
            <div className="space-y-6">
              <h1 className="text-4xl font-bold text-slate-900">Create your organization</h1>
              <p className="text-slate-600">
                Set up branding so applicants and recruiters see your organization during onboarding.
              </p>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-800">Organization name</span>
                <input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:ring-2"
                  style={{ ["--tw-ring-color" as string]: "var(--brand-primary)" }}
                  placeholder="Acme Allied Staffing"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-800">Organization subdomain</span>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1">
                  <input
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    required
                    className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-3 text-sm text-slate-900 outline-none"
                    placeholder="clinic1"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <span className="hidden text-xs text-slate-500 sm:inline">
                    .
                    <span className="font-mono text-slate-700">
                      {publicRootDomain ? publicRootDomain : "your-domain.com"}
                    </span>
                  </span>
                </div>
                <p className="text-[12px] text-slate-500">
                  3–63 characters, letters numbers and hyphens only, cannot start or end with a hyphen. Deploy with{" "}
                  <code className="rounded bg-slate-100 px-1 py-px">NEXT_PUBLIC_ROOT_DOMAIN</code> to preview your full host
                  here.
                </p>
              </label>
              <button
                type="button"
                className="w-full rounded-xl py-4 text-[17px] font-semibold text-white shadow-md transition-opacity hover:opacity-95 md:w-auto md:min-w-[200px]"
                style={{ backgroundColor: "var(--brand-primary)" }}
                onClick={() => setStep("brand")}
                disabled={orgName.trim().length < 2 || "failure" in validateTenantSubdomainInput(subdomain)}
              >
                Continue
              </button>
            </div>
          ) : null}

          {step === "brand" ? (
            <div className="space-y-5">
              <h2 className="text-3xl font-bold text-slate-900">Logo & palette</h2>
              <p className="text-slate-600">Upload a logo file or paste a reachable logo URL.</p>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-800">Logo file</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setLogoFile(f);
                    if (f) setLogoUrl(URL.createObjectURL(f));
                  }}
                  className="w-full text-sm"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-800">Logo URL (optional)</span>
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder="/images/logo.svg or https://…"
                />
              </label>
              <div className="grid gap-6 sm:grid-cols-3">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
                  Primary
                  <input type="color" value={primaryHex} onChange={(e) => setPrimaryHex(e.target.value)} className="h-12 w-full cursor-pointer rounded border" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
                  Secondary
                  <input type="color" value={secondaryHex} onChange={(e) => setSecondaryHex(e.target.value)} className="h-12 w-full cursor-pointer rounded border" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
                  Accent
                  <input type="color" value={accentHex} onChange={(e) => setAccentHex(e.target.value)} className="h-12 w-full cursor-pointer rounded border" />
                </label>
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-800">Welcome headline</span>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-sm"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-800">Subtitle</span>
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-sm"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-800">Auth background URL (optional)</span>
                <input
                  value={backgroundUrl}
                  onChange={(e) => setBackgroundUrl(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-sm"
                  placeholder="/images/handshake.jpg"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="rounded-xl border border-slate-200 px-5 py-3 text-sm" onClick={() => setStep("org")}>
                  Back
                </button>
                <button
                  type="button"
                  className="rounded-xl px-5 py-3 text-sm font-semibold text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                  onClick={() => setStep("onboarding")}
                >
                  Worker onboarding
                </button>
              </div>
            </div>
          ) : null}

          {step === "onboarding" ? (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-slate-900">Worker onboarding flow</h2>
              <p className="text-slate-600">
                Customize which steps applicants complete, their order, and required document uploads. Changes are
                saved when you finish creating your organization.
              </p>
              <OnboardingStepsBuilder steps={onboardingSteps} onChange={setOnboardingSteps} />
              <div className="flex gap-3">
                <button type="button" className="rounded-xl border px-5 py-3 text-sm" onClick={() => setStep("brand")}>
                  Back
                </button>
                <button
                  type="button"
                  className="rounded-xl px-5 py-3 text-sm font-semibold text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                  onClick={() => setStep("preview")}
                >
                  Continue
                </button>
              </div>
            </div>
          ) : null}

          {step === "preview" ? (
            <div className="space-y-8">
              <h2 className="text-3xl font-bold text-slate-900">Applicant-facing preview</h2>
              <TenantBrandingProvider branding={preview}>
                <PreviewCard b={preview} />
              </TenantBrandingProvider>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="rounded-xl border border-slate-200 px-5 py-3 text-sm" onClick={() => setStep("brand")}>
                  Back
                </button>
                <button
                  type="button"
                  className="rounded-xl px-5 py-3 text-sm font-semibold text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                  onClick={() => setStep("admin")}
                >
                  Continue to admin
                </button>
              </div>
            </div>
          ) : null}

          {step === "admin" ? (
            <div className="space-y-5">
              <h2 className="text-3xl font-bold text-slate-900">First recruiting admin</h2>
              <p className="text-slate-600">Creates a recruiter account belonging to your new tenant.</p>
              <label className="block space-y-2 text-sm font-medium text-slate-800">
                Admin email
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-sm font-normal"
                  required
                />
              </label>
              <label className="block space-y-2 text-sm font-medium text-slate-800">
                Password (min 6 chars)
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-sm font-normal"
                  required
                />
              </label>
              <div className="flex flex-wrap gap-3 pt-4">
                <button type="button" className="rounded-xl border border-slate-200 px-5 py-3 text-sm" onClick={() => setStep("preview")}>
                  Back
                </button>
                <button
                  type="button"
                  disabled={submitting || adminEmail.length < 4 || adminPassword.length < 6}
                  className="rounded-xl px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                  onClick={() => void finalize()}
                >
                  {submitting ? "Saving..." : "Save tenant & invite admin"}
                </button>
              </div>
            </div>
          ) : null}

          {step === "done" ? (
            <div className="space-y-6 text-center">
              <p className="text-4xl font-bold text-slate-900">Tenant ready!</p>
              <p className="mx-auto max-w-lg text-slate-600">
                Applicant portal:&nbsp;
                <span className="font-mono text-slate-900">
                  {createdDomain ? `https://${createdDomain}` : createdSlug ? `tenant “${createdSlug}”` : "—"}
                </span>
                . Sign in with the recruiter you created, then send applicants your subdomain URL or use the slug in
                query links.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex rounded-xl px-8 py-3 text-sm font-semibold text-white"
                  style={{ backgroundColor: preview.primaryHex }}
                >
                  Go to recruiter login
                </Link>
                <Link
                  href={withTenant("/application/step-1-upload", createdSlug)}
                  className="inline-flex rounded-xl border px-8 py-3 text-sm font-semibold text-slate-800"
                >
                  View applicant onboarding
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </TenantBrandingProvider>
  );
}
