"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ImageIcon, Palette, Type } from "lucide-react";
import {
  AccountErrorBanner,
  AccountLoadingSkeleton,
  AccountSuccessBanner,
} from "@/app/admin_recruiter/account/components/AccountFormStatus";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { BRAND_COLOR_PRESETS } from "@/app/tenant-onboarding/constants";
import { notifyBrandingUpdated } from "@/lib/tenant/branding-events";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { supabaseBrowser } from "@/lib/supabase-browser";

type BrandingTab = "colors" | "logo" | "login";

const BRANDING_TABS: Array<{ id: BrandingTab; label: string; icon: typeof Palette }> = [
  { id: "colors", label: "Colors", icon: Palette },
  { id: "logo", label: "Logo", icon: ImageIcon },
  { id: "login", label: "Login page", icon: Type },
];

function brandingTabClass(active: boolean): string {
  return `inline-flex shrink-0 cursor-pointer items-center gap-2 pb-3 pt-1 text-sm font-medium leading-5 whitespace-nowrap transition-colors ${
    active
      ? "-mb-px border-b-2 text-[color:var(--brand-primary)]"
      : "border-b-2 border-transparent text-[#2B3D51] hover:text-[color:var(--brand-primary)]"
  }`;
}

function actionButtonClass(variant: "primary" | "secondary", disabled?: boolean): string {
  const base =
    "inline-flex h-10 cursor-pointer items-center justify-center px-5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60";
  if (variant === "primary") {
    return `${base} rounded-lg text-white hover:brightness-95`;
  }
  return `${base} rounded-lg border border-[#CBD5E1] bg-white text-[#012352] hover:bg-[#F8FAFC]`;
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

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export default function BrandingSettingsPanel() {
  const currentBranding = useTenantBranding();
  const [activeTab, setActiveTab] = useState<BrandingTab>("colors");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const [primaryHex, setPrimaryHex] = useState(currentBranding.primaryHex);
  const [secondaryHex, setSecondaryHex] = useState(currentBranding.secondaryHex);
  const [accentHex, setAccentHex] = useState(currentBranding.accentHex);
  const [headline, setHeadline] = useState(currentBranding.headline);
  const [subtitle, setSubtitle] = useState(currentBranding.subtitle);
  const [loginBackgroundSrc, setLoginBackgroundSrc] = useState(currentBranding.loginBackgroundSrc);
  const [logoUrl, setLogoUrl] = useState(currentBranding.logoUrl);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);

  const applyBranding = useCallback((branding: TenantBranding) => {
    setPrimaryHex(branding.primaryHex);
    setSecondaryHex(branding.secondaryHex);
    setAccentHex(branding.accentHex);
    setHeadline(branding.headline);
    setSubtitle(branding.subtitle);
    setLoginBackgroundSrc(branding.loginBackgroundSrc);
    setLogoUrl(branding.logoUrl);
  }, []);

  const loadBranding = useCallback(async () => {
    setLoading(true);
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
      if (payload.branding) applyBranding(payload.branding);
      setTenantId(payload.tenantId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load branding.");
    } finally {
      setLoading(false);
    }
  }, [applyBranding]);

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
      headline: headline.trim() || currentBranding.companyName,
      subtitle: subtitle.trim() || currentBranding.subtitle,
      loginBackgroundSrc: backgroundPreview || loginBackgroundSrc,
      logoUrl: logoPreview || logoUrl,
    }),
    [
      accentHex,
      currentBranding,
      headline,
      loginBackgroundSrc,
      backgroundPreview,
      logoPreview,
      logoUrl,
      primaryHex,
      secondaryHex,
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
      let nextBackgroundUrl = loginBackgroundSrc;

      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
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
        if (uploadPayload.logoUrl) {
          nextLogoUrl = uploadPayload.logoUrl;
          setLogoUrl(uploadPayload.logoUrl);
        }
        setLogoFile(null);
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
          authBackgroundImageUrl: nextBackgroundUrl,
          logoUrl: nextLogoUrl,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        branding?: TenantBranding;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not save branding.");
      if (payload.branding) applyBranding(payload.branding);

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

  if (!tenantId) {
    return (
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-6">
        <p className="text-[16px] font-semibold text-[#0F172A]">No organization selected</p>
        <p className="mt-2 text-[14px] text-[#64748B]">
          Switch to your company in the header, then open Branding again.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? <AccountErrorBanner message={error} /> : null}
      {success ? <AccountSuccessBanner message={success} /> : null}

      <nav
        className="border-b border-[#E5E7EB]"
        aria-label="Branding sections"
      >
        <div className="mx-auto flex max-w-[560px] flex-wrap items-end justify-center gap-x-8 gap-y-2">
          {BRANDING_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={brandingTabClass(active)}
                style={active ? { borderBottomColor: "var(--brand-primary)" } : undefined}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 sm:p-6">
        {activeTab === "colors" ? (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Quick colors</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {BRAND_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setPrimaryHex(preset.primary);
                      setSecondaryHex(preset.secondary);
                      setAccentHex(preset.accent);
                    }}
                    className="cursor-pointer rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-left transition hover:border-[color:var(--brand-primary)]"
                  >
                    <div className="flex gap-2">
                      <span className="h-8 w-8 rounded-full border border-black/10" style={{ backgroundColor: preset.primary }} />
                      <span className="h-8 w-8 rounded-full border border-black/10" style={{ backgroundColor: preset.secondary }} />
                      <span className="h-8 w-8 rounded-full border border-black/10" style={{ backgroundColor: preset.accent }} />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[#0F172A]">{preset.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: "Main color", value: primaryHex, onChange: setPrimaryHex },
                { label: "Second color", value: secondaryHex, onChange: setSecondaryHex },
                { label: "Accent color", value: accentHex, onChange: setAccentHex },
              ].map((color) => (
                <FieldBlock key={color.label} label={color.label}>
                  <div className="flex items-center gap-3 rounded-lg border border-[#CBD5E1] bg-white p-3">
                    <input
                      type="color"
                      value={color.value}
                      onChange={(event) => color.onChange(event.target.value)}
                      className="h-12 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
                      aria-label={color.label}
                    />
                    <span className="font-mono text-sm text-[#475569]">{color.value}</span>
                  </div>
                </FieldBlock>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "logo" ? (
          <div className="space-y-5">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoPreview || logoUrl}
                alt="Company logo"
                className="h-20 max-w-[220px] rounded-lg border border-[#E2E8F0] bg-white object-contain p-3"
              />
              <div className="space-y-2">
                <p className="text-[16px] font-semibold text-[#0F172A]">Upload logo</p>
                <p className="text-[14px] text-[#64748B]">PNG, JPG, WEBP, or SVG. Max 2 MB.</p>
              </div>
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
              className="block w-full max-w-lg cursor-pointer text-sm text-[#475569] file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#012352] file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white"
            />
          </div>
        ) : null}

        {activeTab === "login" ? (
          <div className="space-y-5">
            <FieldBlock label="Welcome title" hint="Shown on worker and recruiter sign-in.">
              <input
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                placeholder={`Welcome to ${currentBranding.companyName}`}
                className="h-11 w-full rounded-lg border border-[#CBD5E1] px-4 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
              />
            </FieldBlock>
            <FieldBlock label="Short message" hint="Line under the welcome title.">
              <input
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
                placeholder="HR Simplified for growing teams"
                className="h-11 w-full rounded-lg border border-[#CBD5E1] px-4 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
              />
            </FieldBlock>
            <FieldBlock label="Background image" hint="Use a web link or path like /images/handshake.jpg">
              <input
                value={loginBackgroundSrc}
                onChange={(event) => setLoginBackgroundSrc(event.target.value)}
                placeholder="/images/singup-bg-image.jpg"
                className="h-11 w-full rounded-lg border border-[#CBD5E1] px-4 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
              />
            </FieldBlock>
            <FieldBlock label="Or upload image" hint="Choose from system (PNG, JPG, WEBP). Max 3 MB.">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setBackgroundFile(event.target.files?.[0] ?? null)}
                className="block w-full max-w-lg cursor-pointer text-sm text-[#475569] file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#012352] file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white"
              />
            </FieldBlock>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 sm:p-6">
        <p className="text-sm font-semibold text-[#0F172A]">Preview</p>
        <div
          className="mt-4 overflow-hidden rounded-lg border border-[#E2E8F0]"
          style={{
            background: `linear-gradient(135deg, ${preview.primaryHex}22 0%, ${preview.secondaryHex}33 100%)`,
          }}
        >
          <div className="grid gap-0 md:grid-cols-2">
            <div className="space-y-4 bg-white p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.logoUrl} alt="" className="h-12 max-w-[180px] object-contain" />
              <p className="text-[18px] font-semibold text-[#0F172A]">{preview.headline}</p>
              <p className="text-[14px] text-[#64748B]">{preview.subtitle}</p>
              <div
                className="inline-flex h-10 items-center rounded-lg px-5 text-sm font-medium text-white"
                style={{ backgroundColor: preview.primaryHex }}
              >
                Sign in
              </div>
            </div>
            <div
              className="min-h-[180px] bg-cover bg-center"
              style={{ backgroundImage: `url(${preview.loginBackgroundSrc})` }}
              aria-hidden
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
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
