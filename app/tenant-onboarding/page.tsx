"use client";

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
  InviteTeamMembersStep,
  BrandingStep,
  BusinessStep,
  CompanyLogoStep,
  DomainStep,
  DoneStep,
  ErrorBanner,
  GoalsStep,
  PreviewStep,
  // WorkerOnboardingStep, // Hidden during tenant onboarding — default 6 steps apply automatically.
} from "@/app/tenant-onboarding/tenant-onboarding-steps";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import {
  isSubdomainOnboardingApiError,
  subdomainErrorMessage,
  validateTenantSubdomainInput,
} from "@/lib/tenant/subdomain-validation";
import {
  defaultTenantBranding,
  PLATFORM_DEFAULT_TENANT_SLUG,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";
import { deriveTenantOnboardingStepStates } from "@/lib/tenant/tenant-onboarding-stepper-status";

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
  const [brand, setBrand] = useState<TenantBranding>(() => defaultTenantBranding());
  const [brandLoaded, setBrandLoaded] = useState(false);

  const [step, setStep] = useState<Step>("goals");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedGoals, setSelectedGoals] = useState<TenantGoalId[]>([]);
  const [goalsSkipped, setGoalsSkipped] = useState(false);
  const [businessInfoSkipped, setBusinessInfoSkipped] = useState(false);
  const [brandingSkipped, setBrandingSkipped] = useState(false);
  const [businessInfo, setBusinessInfo] = useState(initialBusinessInfoForm);
  const [orgName, setOrgName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
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
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([""]);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [createdDomain, setCreatedDomain] = useState<string | null>(null);
  const [firmaProvisioning, setFirmaProvisioning] = useState<{
    status: string;
    workspaceId?: string | null;
    error?: string | null;
  } | null>(null);
  const [preparingDashboard, setPreparingDashboard] = useState(false);

  const publicRootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() ?? "";

  const buildAdminRecruiterLoginUrl = (slug: string | null, domain: string | null): string | null => {
    const cleanedSlug = slug?.trim() ?? "";
    const cleanedDomain = domain?.trim() ?? "";
    if (!cleanedSlug || !cleanedDomain) return null;

    const normalizedDomain = cleanedDomain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (!normalizedDomain) return null;

    const protocol =
      typeof window !== "undefined" && window.location.protocol
        ? window.location.protocol
        : "https:";

    return `${protocol}//${normalizedDomain}/login?tenant=${encodeURIComponent(cleanedSlug)}&role=admin_recruiter`;
  };

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

  useEffect(() => {
    if (!backgroundFile) {
      setBackgroundPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(backgroundFile);
    setBackgroundPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [backgroundFile]);

  const brandingPreview = useMemo(
    (): TenantBranding => ({
      ...preview,
      loginBackgroundSrc: backgroundPreview || preview.loginBackgroundSrc,
    }),
    [backgroundPreview, preview]
  );

  const stepperStates = useMemo(
    () =>
      deriveTenantOnboardingStepStates({
        step,
        skippedSteps: {
          goals: goalsSkipped,
          business: businessInfoSkipped,
          branding: brandingSkipped,
        },
      }),
    [step, goalsSkipped, businessInfoSkipped, brandingSkipped]
  );

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
    if (step === "goals") {
      setGoalsSkipped(true);
    }
    if (step === "business") {
      setBusinessInfoSkipped(true);
    }
    if (step === "company_logo" || step === "branding") {
      setBrandingSkipped(true);
    }
    const nextStep: Partial<Record<Step, Step>> = {
      goals: "business",
      business: "company_logo",
      company_logo: "branding",
      branding: "domain",
      domain: "preview",
      preview: "admin",
    };
    const next = nextStep[step];
    if (next) setStep(next);
  };

  // A freshly created tenant subdomain (e.g. grow.brasshr.com) is not always
  // reachable the instant it is created — DNS/TLS/routing can take a few
  // seconds to warm up. Navigating too early shows the browser's
  // "This site can't be reached" (ERR_CONNECTION_CLOSED) page until a manual
  // reload. To avoid that, we keep a friendly "setting up" screen on-screen and
  // quietly probe the destination until it responds, then navigate.
  const waitUntilReachableThenGo = async (url: string) => {
    setPreparingDashboard(true);

    // Same-origin / relative URLs are already reachable — go immediately.
    if (url.startsWith("/")) {
      window.location.assign(url);
      return;
    }

    const probe = async (): Promise<boolean> => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        // `no-cors` resolves (opaque) when the server responds at all, and
        // rejects on a real network failure (connection closed / DNS fail),
        // which is exactly the readiness signal we need.
        await fetch(url, {
          method: "GET",
          mode: "no-cors",
          cache: "no-store",
          redirect: "follow",
          signal: controller.signal,
        });
        clearTimeout(timer);
        return true;
      } catch {
        return false;
      }
    };

    const maxAttempts = 24;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (await probe()) {
        window.location.assign(url);
        return;
      }
      const backoff = Math.min(2000, 400 + attempt * 150);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }

    // Fallback: after the wait budget, navigate anyway so the user is never stuck.
    window.location.assign(url);
  };

  const finalize = async (options?: { redirectToDashboard?: boolean }) => {
    setSubmitting(true);
    setError(null);
    setInviteNotice(null);
    try {
      const validated = validateTenantSubdomainInput(subdomain);
      if ("failure" in validated) {
        setDomainError(subdomainErrorMessage(validated.failure));
        setStep("domain");
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
          authBackgroundImageUrl: backgroundFile ? null : backgroundUrl.trim() || null,
          adminEmail: adminEmail.trim().toLowerCase(),
          adminPassword: "",
          industry: businessInfo.industry,
          companySize: businessInfo.companySize,
          city: businessInfo.city,
          state: businessInfo.state,
          address: businessInfo.address,
          phone: businessInfo.phone,
          email: businessInfo.email,
          zipCode: businessInfo.zipCode,
          ein: businessInfo.ein,
          businessInfoSkipped,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        slug?: string;
        domain?: string;
        tenantId?: string;
        code?: string;
        firmaProvisioning?: {
          status: string;
          workspaceId?: string | null;
          message?: string | null;
        };
      };

      if (!res.ok) {
        if (isSubdomainOnboardingApiError(payload)) {
          setDomainError(payload.error ?? "This domain is not available. Please choose another.");
          setStep("domain");
          setError(null);
        } else {
          setError(payload.error ?? "Something went wrong");
        }
        setSubmitting(false);
        return;
      }

      setCreatedSlug(String(payload.slug ?? "").trim());
      setCreatedDomain(String(payload.domain ?? "").trim());
      setFirmaProvisioning(payload.firmaProvisioning ?? null);
      document.cookie = `${ONBOARDING_TENANT_SLUG_COOKIE}=${encodeURIComponent(payload.slug ?? "")}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

      const tenantId = String(payload.tenantId ?? "").trim();
      if (tenantId && logoFile) {
        const fd = new FormData();
        fd.set("tenantId", tenantId);
        fd.set("file", logoFile);
        await fetch("/api/tenants/logo", { method: "POST", body: fd });
      }

      if (tenantId && faviconFile) {
        const favFd = new FormData();
        favFd.set("tenantId", tenantId);
        favFd.set("file", faviconFile);
        await fetch("/api/tenants/favicon", { method: "POST", body: favFd });
      }

      if (tenantId && backgroundFile) {
        const bgFd = new FormData();
        bgFd.set("tenantId", tenantId);
        bgFd.set("file", backgroundFile);
        await fetch("/api/tenants/background", { method: "POST", body: bgFd });
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

      if (options?.redirectToDashboard && typeof window !== "undefined") {
        // Go straight to the recruiter login ("/admin") instead of the
        // protected "/admin_recruiter/home", which the middleware would
        // otherwise bounce to "/admin?next=..." (causing a brief error flash).
        const cleanedDomain = (payload.domain ?? "")
          .trim()
          .replace(/^https?:\/\//i, "")
          .replace(/\/+$/, "");
        const protocol = window.location.protocol || "https:";
        const adminUrl = cleanedDomain ? `${protocol}//${cleanedDomain}/admin` : "/admin";
        await waitUntilReachableThenGo(adminUrl);
        return;
      }

      const adminLoginUrl = buildAdminRecruiterLoginUrl(payload.slug ?? null, payload.domain ?? null);
      if (adminLoginUrl && typeof window !== "undefined") {
        window.location.assign(adminLoginUrl);
        return;
      }

      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!brandLoaded) {
    return <div className="min-h-screen bg-white" />;
  }

  if (preparingDashboard) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-6 text-center">
        <div
          className="h-16 w-16 animate-spin rounded-full border-4 border-[#e5e7eb]"
          style={{ borderTopColor: preview.primaryHex }}
        />
        <div className="space-y-2">
          <p className="text-[26px] font-bold text-[#0f172a]">Setting up your account</p>
          <p className="text-[17px] text-[#475569]">Please wait a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <TenantOnboardingShell brand={preview} step={step} hideStepper={step === "done"} stepperStates={stepperStates}>
      {error && step !== "domain" ? <ErrorBanner message={error} /> : null}

      {step === "goals" ? (
        <GoalsStep
          selectedGoals={selectedGoals}
          onToggleGoal={toggleGoal}
          onContinue={() => {
            setGoalsSkipped(false);
            setStep("business");
          }}
          onSkip={handleSkip}
        />
      ) : null}

      {step === "business" ? (
        <BusinessStep
          orgName={orgName}
          businessInfo={businessInfo}
          onOrgNameChange={setOrgName}
          onBusinessInfoChange={(patch) => setBusinessInfo((prev) => ({ ...prev, ...patch }))}
          onContinue={() => {
            setBusinessInfoSkipped(false);
            setStep("company_logo");
          }}
          onBack={() => setStep("goals")}
          onSkip={handleSkip}
        />
      ) : null}

      {step === "company_logo" ? (
        <CompanyLogoStep
          logoUrl={logoUrl}
          logoFile={logoFile}
          faviconFile={faviconFile}
          orgName={orgName}
          logoDisplayName={logoDisplayName}
          logoTagline={logoTagline}
          onLogoFileChange={(file, previewUrl) => {
            setLogoFile(file);
            setLogoUrl(previewUrl);
          }}
          onLogoUrlChange={setLogoUrl}
          onFaviconFileChange={setFaviconFile}
          onLogoDisplayNameChange={setLogoDisplayName}
          onLogoTaglineChange={setLogoTagline}
          onContinue={() => {
            setBrandingSkipped(false);
            setStep("branding");
          }}
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
          backgroundFile={backgroundFile}
          orgName={orgName}
          preview={brandingPreview}
          onPrimaryChange={setPrimaryHex}
          onSecondaryChange={setSecondaryHex}
          onAccentChange={setAccentHex}
          onHeadlineChange={setHeadline}
          onSubtitleChange={setSubtitle}
          onBackgroundChange={(value) => {
            setBackgroundFile(null);
            setBackgroundUrl(value);
          }}
          onBackgroundFileChange={setBackgroundFile}
          onContinue={() => {
            setBrandingSkipped(false);
            setStep("domain");
          }}
          onBack={() => setStep("company_logo")}
          onSkip={handleSkip}
        />
      ) : null}

      {step === "domain" ? (
        <DomainStep
          subdomain={subdomain}
          publicRootDomain={publicRootDomain}
          serverError={domainError}
          onSubdomainChange={(value) => {
            setSubdomain(value);
            setDomainError(null);
          }}
          onContinue={() => {
            setDomainError(null);
            setStep("preview");
          }}
          onBack={() => setStep("branding")}
        />
      ) : null}

      {/* Worker onboarding customization hidden — default 6 steps are saved on complete. */}
      {/* {step === "onboarding" ? (
        <WorkerOnboardingStep
          steps={onboardingSteps}
          onStepsChange={setOnboardingSteps}
          onContinue={() => setStep("preview")}
          onBack={() => setStep("domain")}
        />
      ) : null} */}

      {step === "preview" ? (
        <PreviewStep
          preview={brandingPreview}
          onContinue={() => setStep("admin")}
          onBack={() => setStep("domain")}
        />
      ) : null}

      {step === "admin" ? (
        <InviteTeamMembersStep
          inviteEmails={inviteEmails}
          submitting={submitting}
          inviteNotice={inviteNotice}
          onInviteEmailsChange={(index, value) =>
            setInviteEmails((current) => current.map((email, i) => (i === index ? value : email)))
          }
          onAddEmail={() => setInviteEmails((current) => [...current, ""])}
          onRemoveEmail={(index) =>
            setInviteEmails((current) =>
              current.length <= 1 ? current : current.filter((_, i) => i !== index)
            )
          }
          onSkip={() => void finalize({ redirectToDashboard: true })}
          onSendInvites={() => {
            setInviteNotice(
              "Team invites are coming soon. Tap Skip for now to finish setup and go to your dashboard."
            );
          }}
          onBack={() => setStep("preview")}
        />
      ) : null}

      {step === "done" ? (
        <DoneStep
          preview={brandingPreview}
          createdSlug={createdSlug}
          createdDomain={createdDomain}
          firmaProvisioning={firmaProvisioning}
        />
      ) : null}
    </TenantOnboardingShell>
  );
}
