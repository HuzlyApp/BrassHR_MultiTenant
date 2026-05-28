"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { createInitialBuilderSteps } from "@/app/components/onboarding/OnboardingStepsBuilder";
import TenantOnboardingShell from "@/app/tenant-onboarding/TenantOnboardingShell";
import {
  initialBusinessInfoForm,
  type TenantBrandingFontId,
  type TenantBrandingThemeMode,
  type TenantGoalId,
} from "@/app/tenant-onboarding/constants";
import {
  AdminStep,
  BrandingStep,
  BusinessStep,
  CompanyLogoStep,
  DomainStep,
  DoneStep,
  ErrorBanner,
  GoalsStep,
  PreviewStep,
  WorkerOnboardingStep,
} from "@/app/tenant-onboarding/tenant-onboarding-steps";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import { subdomainErrorMessage, validateTenantSubdomainInput } from "@/lib/tenant/subdomain-validation";
import {
  defaultTenantBranding,
  PLATFORM_DEFAULT_TENANT_SLUG,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";

type Step =
  | "goals"
  | "business"
  | "company_logo"
  | "branding"
  | "domain"
  | "onboarding"
  | "preview"
  | "admin"
  | "done";

export default function TenantOnboardingPage() {
  const router = useRouter();
  const [brand, setBrand] = useState<TenantBranding>(() => defaultTenantBranding());
  const [brandLoaded, setBrandLoaded] = useState(false);

  const [step, setStep] = useState<Step>("goals");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedGoals, setSelectedGoals] = useState<TenantGoalId[]>([]);
  const [businessInfo, setBusinessInfo] = useState(initialBusinessInfoForm);
  const [orgName, setOrgName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDisplayName, setLogoDisplayName] = useState("");
  const [logoTagline, setLogoTagline] = useState("");
  const [onboardingSteps, setOnboardingSteps] = useState<OnboardingStepDraft[]>(() =>
    createInitialBuilderSteps()
  );
  const [platformColors, setPlatformColors] = useState({
    primary: brand.primaryHex,
    secondary: brand.secondaryHex,
    accent: brand.accentHex,
  });
  const [brandingThemeMode, setBrandingThemeMode] = useState<TenantBrandingThemeMode>("system");
  const [brandingFontId, setBrandingFontId] = useState<TenantBrandingFontId>("inter");
  const [primaryHex, setPrimaryHex] = useState(brand.primaryHex);
  const [secondaryHex, setSecondaryHex] = useState(brand.secondaryHex);
  const [accentHex, setAccentHex] = useState(brand.accentHex);
  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [createdDomain, setCreatedDomain] = useState<string | null>(null);

  const publicRootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() ?? "";

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data: userData } = await supabaseBrowser.auth.getUser();
      const email = userData.user?.email?.trim() ?? "";
      if (alive && email) {
        setAdminEmail(email);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(
          `/api/tenant-branding?slug=${encodeURIComponent(PLATFORM_DEFAULT_TENANT_SLUG)}`,
          { cache: "no-store" }
        );
        const payload = (await res.json()) as { branding?: TenantBranding };
        if (alive && payload.branding) {
          setBrand(payload.branding);
          setPlatformColors({
            primary: payload.branding.primaryHex,
            secondary: payload.branding.secondaryHex,
            accent: payload.branding.accentHex,
          });
          setPrimaryHex(payload.branding.primaryHex);
          setSecondaryHex(payload.branding.secondaryHex);
          setAccentHex(payload.branding.accentHex);
          setBackgroundUrl(payload.branding.loginBackgroundSrc);
        }
      } catch {
        /* keep defaults */
      } finally {
        if (alive) setBrandLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const preview = useMemo((): TenantBranding => {
    return {
      ...brand,
      companyName: orgName.trim() || brand.companyName,
      logoUrl: logoUrl.trim() || brand.logoUrl,
      primaryHex,
      secondaryHex,
      accentHex,
      headline: headline.trim() || `Welcome to ${orgName.trim() || brand.companyName}`,
      subtitle: subtitle.trim() || brand.subtitle,
      loginBackgroundSrc: backgroundUrl.trim() || brand.loginBackgroundSrc,
      tagline: subtitle.trim()
        ? subtitle.trim()
        : `Applicants can onboard with branding unique to ${orgName.trim() || brand.companyName}.`,
    };
  }, [accentHex, backgroundUrl, brand, headline, logoUrl, orgName, primaryHex, secondaryHex, subtitle]);

  const handleBrandingThemeMode = (mode: TenantBrandingThemeMode) => {
    setBrandingThemeMode(mode);
    if (mode === "system") {
      setPrimaryHex(platformColors.primary);
      setSecondaryHex(platformColors.secondary);
      setAccentHex(platformColors.accent);
    }
  };

  const toggleGoal = (id: TenantGoalId) => {
    setSelectedGoals((current) =>
      current.includes(id) ? current.filter((g) => g !== id) : [...current, id]
    );
  };

  const handleSkip = () => {
    const nextStep: Partial<Record<Step, Step>> = {
      goals: "business",
      business: "company_logo",
      company_logo: "branding",
      branding: "domain",
      domain: "onboarding",
      onboarding: "preview",
      preview: "admin",
    };
    const next = nextStep[step];
    if (next) setStep(next);
  };

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

      router.push("/admin_recruiter/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!brandLoaded) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <TenantOnboardingShell brand={preview} step={step} hideStepper={step === "done"}>
      {error ? <ErrorBanner message={error} /> : null}

      {step === "goals" ? (
        <GoalsStep
          selectedGoals={selectedGoals}
          onToggleGoal={toggleGoal}
          onContinue={() => setStep("business")}
          onSkip={handleSkip}
        />
      ) : null}

      {step === "business" ? (
        <BusinessStep
          orgName={orgName}
          businessInfo={businessInfo}
          onOrgNameChange={setOrgName}
          onBusinessInfoChange={(patch) => setBusinessInfo((prev) => ({ ...prev, ...patch }))}
          onContinue={() => setStep("company_logo")}
          onBack={() => setStep("goals")}
          onSkip={handleSkip}
        />
      ) : null}

      {step === "company_logo" ? (
        <CompanyLogoStep
          logoUrl={logoUrl}
          logoFile={logoFile}
          orgName={orgName}
          logoDisplayName={logoDisplayName}
          logoTagline={logoTagline}
          onLogoFileChange={(file, previewUrl) => {
            setLogoFile(file);
            setLogoUrl(previewUrl);
          }}
          onLogoUrlChange={setLogoUrl}
          onLogoDisplayNameChange={setLogoDisplayName}
          onLogoTaglineChange={setLogoTagline}
          onContinue={() => setStep("branding")}
          onBack={() => setStep("business")}
          onSkip={handleSkip}
        />
      ) : null}

      {step === "branding" ? (
        <BrandingStep
          platformColors={platformColors}
          themeMode={brandingThemeMode}
          onThemeModeChange={handleBrandingThemeMode}
          fontId={brandingFontId}
          onFontChange={setBrandingFontId}
          primaryHex={primaryHex}
          secondaryHex={secondaryHex}
          accentHex={accentHex}
          headline={headline}
          subtitle={subtitle}
          backgroundUrl={backgroundUrl}
          orgName={orgName}
          preview={preview}
          onPrimaryChange={setPrimaryHex}
          onSecondaryChange={setSecondaryHex}
          onAccentChange={setAccentHex}
          onHeadlineChange={setHeadline}
          onSubtitleChange={setSubtitle}
          onBackgroundChange={setBackgroundUrl}
          onContinue={() => setStep("domain")}
          onBack={() => setStep("company_logo")}
          onSkip={handleSkip}
        />
      ) : null}

      {step === "domain" ? (
        <DomainStep
          subdomain={subdomain}
          publicRootDomain={publicRootDomain}
          onSubdomainChange={setSubdomain}
          onContinue={() => setStep("onboarding")}
          onBack={() => setStep("branding")}
        />
      ) : null}

      {step === "onboarding" ? (
        <WorkerOnboardingStep
          steps={onboardingSteps}
          onStepsChange={setOnboardingSteps}
          onContinue={() => setStep("preview")}
          onBack={() => setStep("domain")}
        />
      ) : null}

      {step === "preview" ? (
        <PreviewStep
          preview={preview}
          onContinue={() => setStep("admin")}
          onBack={() => setStep("onboarding")}
        />
      ) : null}

      {step === "admin" ? (
        <AdminStep
          adminEmail={adminEmail}
          adminPassword={adminPassword}
          submitting={submitting}
          passwordOptional={Boolean(adminEmail.trim())}
          onEmailChange={setAdminEmail}
          onPasswordChange={setAdminPassword}
          onSubmit={() => void finalize()}
          onBack={() => setStep("preview")}
        />
      ) : null}

      {step === "done" ? (
        <DoneStep preview={preview} createdSlug={createdSlug} createdDomain={createdDomain} />
      ) : null}
    </TenantOnboardingShell>
  );
}
