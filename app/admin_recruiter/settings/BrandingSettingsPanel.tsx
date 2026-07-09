"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, ImageIcon, Palette, RefreshCw, Type } from "lucide-react";
import {
  AccountErrorBanner,
  AccountLoadingSkeleton,
  AccountSuccessBanner,
} from "@/app/admin_recruiter/account/components/AccountFormStatus";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  BRAND_COLOR_PRESETS,
  TENANT_BRANDING_FONT_OPTIONS,
  type TenantBrandingFontId,
} from "@/app/tenant-onboarding/constants";
import {
  EFFECTIVE_BRANDING_QUERY_KEY,
  patchEffectiveBrandingCache,
} from "@/lib/admin/hooks/use-effective-branding";
import { notifyBrandingUpdated } from "@/lib/tenant/branding-events";
import { isValidBrandingHex } from "@/lib/tenant/branding-validation";
import {
  brandingFontFamily,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";
import BrandingAuthPreview from "@/app/admin_recruiter/settings/BrandingAuthPreview";
import { supabaseBrowser } from "@/lib/supabase-browser";

type PreviewMode = "login" | "signup";
type LogoField = "logo" | "login" | "signup" | "favicon";

function normalizePresetHex(hex: string): string {
  return hex.trim().toLowerCase();
}

function isPresetActive(
  preset: (typeof BRAND_COLOR_PRESETS)[number],
  primaryHex: string,
  secondaryHex: string,
  accentHex: string
): boolean {
  return (
    normalizePresetHex(preset.primary) === normalizePresetHex(primaryHex) &&
    normalizePresetHex(preset.secondary) === normalizePresetHex(secondaryHex) &&
    normalizePresetHex(preset.accent) === normalizePresetHex(accentHex)
  );
}

function actionButtonClass(variant: "primary" | "secondary", disabled?: boolean): string {
  const base =
    "inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 px-5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 min-[500px]:w-auto";
  if (variant === "primary") {
    return `${base} rounded-lg text-white hover:brightness-95`;
  }
  return `${base} rounded-lg border border-[#CBD5E1] bg-white text-[#012352] hover:bg-[#F8FAFC]`;
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: typeof Palette;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#012352]">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h3 className="text-base font-semibold text-[#0F172A]">{title}</h3>
          {description ? <p className="mt-0.5 text-sm text-[#64748B]">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-semibold text-[#0F172A]">{label}</span>
      {hint ? <span className="block text-xs text-[#64748B]">{hint}</span> : null}
      {children}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (isValidBrandingHex(trimmed)) {
      onChange(trimmed);
      setText(trimmed);
    } else {
      setText(value);
    }
  };

  return (
    <FieldBlock label={label}>
      <div className="flex items-center gap-3 rounded-lg border border-[#CBD5E1] bg-white p-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-11 cursor-pointer rounded border-0 bg-transparent p-0"
          aria-label={`${label} picker`}
        />
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => commit(text)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(text);
            }
          }}
          placeholder="#BC8B41"
          className="min-w-0 flex-1 font-mono text-sm text-[#475569] outline-none"
          aria-label={`${label} hex`}
        />
      </div>
    </FieldBlock>
  );
}

function FontSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TenantBrandingFontId;
  onChange: (id: TenantBrandingFontId) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <FieldBlock label={label}>
      <div className="relative">
        <select
          value={value}
          onMouseDown={() => setIsOpen(true)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onChange={(event) => {
            onChange(event.target.value as TenantBrandingFontId);
            setIsOpen(false);
          }}
          className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-[#CBD5E1] bg-white px-3 pr-11 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
          style={{ fontFamily: brandingFontFamily(value) }}
        >
          {TENANT_BRANDING_FONT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id} style={{ fontFamily: option.fontFamily }}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" aria-hidden>
          <ChevronDownIcon
            className={`size-4 text-[#64748B] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </span>
      </div>
    </FieldBlock>
  );
}

function LogoUploadBlock({
  label,
  hint,
  previewSrc,
  onFileChange,
}: {
  label: string;
  hint: string;
  previewSrc: string;
  onFileChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewSrc}
          alt=""
          className="h-16 max-w-[200px] rounded-lg border border-[#E2E8F0] bg-white object-contain p-2"
        />
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
          <p className="text-xs text-[#64748B]">{hint}</p>
        </div>
      </div>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        className="block w-full cursor-pointer text-sm text-[#475569] file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#012352] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
      />
    </div>
  );
}

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function uploadLogo(field: LogoField, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("field", field);
  const uploadRes = await fetch("/api/admin/branding/logo", {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });
  const uploadPayload = (await uploadRes.json().catch(() => ({}))) as {
    logoUrl?: string;
    error?: string;
  };
  if (!uploadRes.ok) throw new Error(uploadPayload.error || "Logo upload failed.");
  if (!uploadPayload.logoUrl) throw new Error("Logo upload did not return a URL.");
  return uploadPayload.logoUrl;
}

export default function BrandingSettingsPanel() {
  const queryClient = useQueryClient();
  const currentBranding = useTenantBranding();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("login");

  const [primaryHex, setPrimaryHex] = useState(currentBranding.primaryHex);
  const [secondaryHex, setSecondaryHex] = useState(currentBranding.secondaryHex);
  const [accentHex, setAccentHex] = useState(currentBranding.accentHex);
  const [headline, setHeadline] = useState(currentBranding.headline);
  const [subtitle, setSubtitle] = useState(currentBranding.subtitle);
  const [signupHeadline, setSignupHeadline] = useState(currentBranding.signupHeadline);
  const [signupSubheadline, setSignupSubheadline] = useState(currentBranding.signupSubheadline);
  const [loginBackgroundSrc, setLoginBackgroundSrc] = useState(currentBranding.loginBackgroundSrc);
  const [buttonText, setButtonText] = useState(currentBranding.buttonText);
  const [buttonColor, setButtonColor] = useState(currentBranding.buttonColor);
  const [logoUrl, setLogoUrl] = useState(currentBranding.logoUrl);
  const [loginLogoUrl, setLoginLogoUrl] = useState(currentBranding.loginLogoUrl);
  const [signupLogoUrl, setSignupLogoUrl] = useState(currentBranding.signupLogoUrl);
  const [faviconUrl, setFaviconUrl] = useState(currentBranding.faviconUrl);
  const [primaryFontId, setPrimaryFontId] = useState(currentBranding.primaryFontId);
  const [headingFontId, setHeadingFontId] = useState(currentBranding.headingFontId);
  const [bodyFontId, setBodyFontId] = useState(currentBranding.bodyFontId);
  const [fontColor, setFontColor] = useState(currentBranding.fontColor);
  const [headingColor, setHeadingColor] = useState(currentBranding.headingColor);
  const [mutedTextColor, setMutedTextColor] = useState(currentBranding.mutedTextColor);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loginLogoFile, setLoginLogoFile] = useState<File | null>(null);
  const [signupLogoFile, setSignupLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loginLogoPreview, setLoginLogoPreview] = useState<string | null>(null);
  const [signupLogoPreview, setSignupLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);

  const applyBranding = useCallback((branding: TenantBranding) => {
    setPrimaryHex(branding.primaryHex);
    setSecondaryHex(branding.secondaryHex);
    setAccentHex(branding.accentHex);
    setHeadline(branding.headline);
    setSubtitle(branding.subtitle);
    setSignupHeadline(branding.signupHeadline);
    setSignupSubheadline(branding.signupSubheadline);
    setLoginBackgroundSrc(branding.loginBackgroundSrc);
    setButtonText(branding.buttonText);
    setButtonColor(branding.buttonColor);
    setLogoUrl(branding.logoUrl);
    setLoginLogoUrl(branding.loginLogoUrl);
    setSignupLogoUrl(branding.signupLogoUrl);
    setFaviconUrl(branding.faviconUrl);
    setPrimaryFontId(branding.primaryFontId);
    setHeadingFontId(branding.headingFontId);
    setBodyFontId(branding.bodyFontId);
    setFontColor(branding.fontColor);
    setHeadingColor(branding.headingColor);
    setMutedTextColor(branding.mutedTextColor);
  }, []);

  const loadBranding = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/branding", { cache: "no-store", headers });
      const payload = (await res.json().catch(() => ({}))) as {
        branding?: TenantBranding;
        tenantId?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not load branding.");
      if (payload.branding) {
        applyBranding(payload.branding);
        patchEffectiveBrandingCache(queryClient, payload.branding);
      }
      setTenantId(payload.tenantId ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load branding.");
    } finally {
      setLoading(false);
    }
  }, [applyBranding, queryClient]);

  useEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  useEffect(() => {
    if (!loginLogoFile) {
      setLoginLogoPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(loginLogoFile);
    setLoginLogoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [loginLogoFile]);

  useEffect(() => {
    if (!signupLogoFile) {
      setSignupLogoPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(signupLogoFile);
    setSignupLogoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [signupLogoFile]);

  useEffect(() => {
    if (!faviconFile) {
      setFaviconPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(faviconFile);
    setFaviconPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [faviconFile]);

  useEffect(() => {
    if (!backgroundFile) {
      setBackgroundPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(backgroundFile);
    setBackgroundPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [backgroundFile]);

  const preview = useMemo(
    (): TenantBranding => ({
      ...currentBranding,
      primaryHex,
      secondaryHex,
      accentHex,
      headline: headline.trim() || currentBranding.headline,
      subtitle: subtitle.trim() || currentBranding.subtitle,
      signupHeadline: signupHeadline.trim() || currentBranding.signupHeadline,
      signupSubheadline: signupSubheadline.trim() || currentBranding.signupSubheadline,
      loginBackgroundSrc: backgroundPreview || loginBackgroundSrc,
      logoUrl: logoPreview || logoUrl,
      loginLogoUrl: loginLogoPreview || loginLogoUrl || logoPreview || logoUrl,
      signupLogoUrl: signupLogoPreview || signupLogoUrl || logoPreview || logoUrl,
      faviconUrl: faviconPreview || faviconUrl || logoPreview || logoUrl,
      primaryFontId,
      headingFontId,
      bodyFontId,
      fontColor,
      headingColor,
      mutedTextColor,
      buttonText: buttonText.trim() || currentBranding.buttonText,
      buttonColor,
    }),
    [
      accentHex,
      backgroundPreview,
      bodyFontId,
      buttonColor,
      buttonText,
      currentBranding,
      faviconPreview,
      faviconUrl,
      fontColor,
      headingColor,
      headingFontId,
      headline,
      loginBackgroundSrc,
      loginLogoPreview,
      loginLogoUrl,
      logoPreview,
      logoUrl,
      mutedTextColor,
      primaryFontId,
      primaryHex,
      secondaryHex,
      signupHeadline,
      signupLogoPreview,
      signupLogoUrl,
      signupSubheadline,
      subtitle,
    ]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const headers = {
        ...(await authHeaders()),
        "Content-Type": "application/json",
      };

      let nextLogoUrl = logoUrl;
      let nextLoginLogoUrl = loginLogoUrl;
      let nextSignupLogoUrl = signupLogoUrl;
      let nextFaviconUrl = faviconUrl;
      let nextBackgroundUrl = loginBackgroundSrc;

      if (logoFile) {
        nextLogoUrl = await uploadLogo("logo", logoFile);
        setLogoUrl(nextLogoUrl);
        setLogoFile(null);
      }
      if (loginLogoFile) {
        nextLoginLogoUrl = await uploadLogo("login", loginLogoFile);
        setLoginLogoUrl(nextLoginLogoUrl);
        setLoginLogoFile(null);
      }
      if (signupLogoFile) {
        nextSignupLogoUrl = await uploadLogo("signup", signupLogoFile);
        setSignupLogoUrl(nextSignupLogoUrl);
        setSignupLogoFile(null);
      }
      if (faviconFile) {
        nextFaviconUrl = await uploadLogo("favicon", faviconFile);
        setFaviconUrl(nextFaviconUrl);
        setFaviconFile(null);
      }

      if (backgroundFile) {
        const bgFormData = new FormData();
        bgFormData.append("file", backgroundFile);
        const bgUploadRes = await fetch("/api/admin/branding/background", {
          method: "POST",
          headers: await authHeaders(),
          body: bgFormData,
        });
        const bgUploadPayload = (await bgUploadRes.json().catch(() => ({}))) as {
          backgroundImageUrl?: string;
          error?: string;
        };
        if (!bgUploadRes.ok) throw new Error(bgUploadPayload.error || "Background upload failed.");
        if (bgUploadPayload.backgroundImageUrl) {
          nextBackgroundUrl = bgUploadPayload.backgroundImageUrl;
          setLoginBackgroundSrc(bgUploadPayload.backgroundImageUrl);
        }
        setBackgroundFile(null);
      }

      const res = await fetch("/api/admin/branding", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          primaryColor: primaryHex,
          secondaryColor: secondaryHex,
          accentColor: accentHex,
          welcomeHeadline: headline,
          welcomeSubtitle: subtitle,
          signupHeadline,
          signupSubheadline,
          authBackgroundImageUrl: nextBackgroundUrl,
          logoUrl: nextLogoUrl,
          loginLogoUrl: nextLoginLogoUrl,
          signupLogoUrl: nextSignupLogoUrl,
          faviconUrl: nextFaviconUrl,
          primaryFont: primaryFontId,
          headingFont: headingFontId,
          bodyFont: bodyFontId,
          fontColor,
          headingColor,
          mutedTextColor,
          buttonText,
          buttonColor,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        branding?: TenantBranding;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not save branding.");
      if (payload.branding) {
        applyBranding(payload.branding);
        patchEffectiveBrandingCache(queryClient, payload.branding);
      }

      void queryClient.invalidateQueries({ queryKey: EFFECTIVE_BRANDING_QUERY_KEY });
      notifyBrandingUpdated();
      setSuccess("Saved! Your team and workers will see the new look.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save branding.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AccountLoadingSkeleton rows={6} />;
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-6">
        <p className="text-base font-semibold text-[#991B1B]">Could not load branding</p>
        <p className="mt-2 text-sm text-[#B91C1C]">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadBranding()}
          className={`${actionButtonClass("secondary")} mt-4`}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Try again
        </button>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <p className="text-base font-semibold text-[#0F172A]">No organization selected</p>
        <p className="mt-2 text-sm text-[#64748B]">
          Switch to your company in the header, then open Settings again.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? <AccountErrorBanner message={error} /> : null}
      {success ? <AccountSuccessBanner message={success} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] xl:items-start">
        <div className="space-y-6">
          <SectionCard
            title="Colors"
            description="Set your brand palette. Workers and applicants see these on sign-in."
            icon={Palette}
          >
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Quick presets</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {BRAND_COLOR_PRESETS.map((preset) => {
                    const active = isPresetActive(preset, primaryHex, secondaryHex, accentHex);
                    return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setPrimaryHex(preset.primary);
                        setSecondaryHex(preset.secondary);
                        setAccentHex(preset.accent);
                        setButtonColor(preset.primary);
                      }}
                      aria-pressed={active}
                      className={`relative cursor-pointer rounded-lg p-4 text-left transition ${
                        active
                          ? "border-2 bg-white shadow-sm"
                          : "border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#94A3B8]"
                      }`}
                      style={active ? { borderColor: primaryHex } : undefined}
                    >
                      {active ? (
                        <span
                          className="absolute right-3 top-3 text-xs font-semibold"
                          style={{ color: primaryHex }}
                        >
                          Active
                        </span>
                      ) : null}
                      <div className="flex gap-2">
                        <span
                          className="h-7 w-7 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <span
                          className="h-7 w-7 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.secondary }}
                        />
                        <span
                          className="h-7 w-7 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.accent }}
                        />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#0F172A]">{preset.label}</p>
                    </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <ColorField label="Main color" value={primaryHex} onChange={setPrimaryHex} />
                <ColorField label="Second color" value={secondaryHex} onChange={setSecondaryHex} />
                <ColorField label="Accent color" value={accentHex} onChange={setAccentHex} />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Logo"
            description="Upload your company logo and optional login/signup variants."
            icon={ImageIcon}
          >
            <div className="space-y-4">
              <LogoUploadBlock
                label="Company logo"
                hint="Used in the app shell and as a fallback. PNG, JPG, WEBP, or SVG. Max 2 MB."
                previewSrc={logoPreview || logoUrl}
                onFileChange={setLogoFile}
              />
              <LogoUploadBlock
                label="Login page logo"
                hint="Shown on worker and recruiter sign-in. Falls back to company logo."
                previewSrc={loginLogoPreview || loginLogoUrl || logoPreview || logoUrl}
                onFileChange={setLoginLogoFile}
              />
              <LogoUploadBlock
                label="Signup page logo"
                hint="Shown on tenant signup. Falls back to company logo."
                previewSrc={signupLogoPreview || signupLogoUrl || logoPreview || logoUrl}
                onFileChange={setSignupLogoFile}
              />
              <LogoUploadBlock
                label="Favicon"
                hint="Small icon shown in the browser tab, sidebar, header, and applicant portal. Square image works best. Falls back to company logo."
                previewSrc={faviconPreview || faviconUrl || logoPreview || logoUrl}
                onFileChange={setFaviconFile}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Login & signup pages"
            description="Headlines, background, and button styling for auth surfaces."
            icon={Type}
          >
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <FieldBlock label="Login headline" hint="Welcome title on sign-in.">
                  <input
                    value={headline}
                    onChange={(event) => setHeadline(event.target.value)}
                    placeholder={`Welcome to ${currentBranding.companyName}`}
                    className="h-11 w-full rounded-lg border border-[#CBD5E1] px-4 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
                  />
                </FieldBlock>
                <FieldBlock label="Login subheadline" hint="Helper text under the login title.">
                  <input
                    value={subtitle}
                    onChange={(event) => setSubtitle(event.target.value)}
                    placeholder="HR Simplified for growing teams"
                    className="h-11 w-full rounded-lg border border-[#CBD5E1] px-4 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
                  />
                </FieldBlock>
                <FieldBlock label="Signup headline">
                  <input
                    value={signupHeadline}
                    onChange={(event) => setSignupHeadline(event.target.value)}
                    placeholder={`Join ${currentBranding.companyName}`}
                    className="h-11 w-full rounded-lg border border-[#CBD5E1] px-4 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
                  />
                </FieldBlock>
                <FieldBlock label="Signup subheadline">
                  <input
                    value={signupSubheadline}
                    onChange={(event) => setSignupSubheadline(event.target.value)}
                    placeholder="Create your account to get started"
                    className="h-11 w-full rounded-lg border border-[#CBD5E1] px-4 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
                  />
                </FieldBlock>
              </div>

              <FieldBlock
                label="Background image"
                hint="Hero image on login/signup. Use a web link or path like /images/handshake.jpg"
              >
                <input
                  value={loginBackgroundSrc}
                  onChange={(event) => setLoginBackgroundSrc(event.target.value)}
                  placeholder="/images/singup-bg-image.jpg"
                  className="h-11 w-full rounded-lg border border-[#CBD5E1] px-4 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
                />
              </FieldBlock>

              <FieldBlock label="Or upload background" hint="PNG, JPG, or WEBP. Max 3 MB.">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setBackgroundFile(event.target.files?.[0] ?? null)}
                  className="block w-full cursor-pointer text-sm text-[#475569] file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#012352] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                />
              </FieldBlock>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldBlock label="Button text" hint="Primary sign-in CTA label.">
                  <input
                    value={buttonText}
                    onChange={(event) => setButtonText(event.target.value)}
                    placeholder="Sign in"
                    className="h-11 w-full rounded-lg border border-[#CBD5E1] px-4 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
                  />
                </FieldBlock>
                <ColorField label="Button color" value={buttonColor} onChange={setButtonColor} />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Typography"
            description="Fonts and text colors for auth and applicant-facing pages."
            icon={Type}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <FontSelect label="Primary font" value={primaryFontId} onChange={setPrimaryFontId} />
              <FontSelect label="Heading font" value={headingFontId} onChange={setHeadingFontId} />
              <FontSelect label="Body font" value={bodyFontId} onChange={setBodyFontId} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <ColorField label="Body text color" value={fontColor} onChange={setFontColor} />
              <ColorField label="Heading color" value={headingColor} onChange={setHeadingColor} />
              <ColorField label="Muted text color" value={mutedTextColor} onChange={setMutedTextColor} />
            </div>
          </SectionCard>
        </div>

        <div className="xl:sticky xl:top-6">
          <SectionCard title="Preview" description="Live preview of login and signup styling." icon={ImageIcon}>
            <div className="mb-4 flex gap-2 rounded-lg bg-[#F1F5F9] p-1">
              {(["login", "signup"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={`flex-1 cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition ${
                    previewMode === mode
                      ? "bg-white text-[#012352] shadow-sm"
                      : "text-[#64748B] hover:text-[#012352]"
                  }`}
                >
                  {mode === "login" ? "Login" : "Signup"}
                </button>
              ))}
            </div>

            <BrandingAuthPreview branding={preview} mode={previewMode} />
          </SectionCard>
        </div>
      </div>

      <div className="grid w-full grid-cols-2 items-center gap-3 border-t border-[#E5E7EB] pt-6 min-[500px]:flex min-[500px]:justify-center">
        <button
          type="submit"
          disabled={saving}
          className={actionButtonClass("primary", saving)}
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {saving ? "Saving…" : "Save branding"}
        </button>
        <button
          type="button"
          onClick={() => void loadBranding()}
          disabled={saving}
          className={actionButtonClass("secondary", saving)}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
