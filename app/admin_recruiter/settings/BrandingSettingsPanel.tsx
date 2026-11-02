"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon, RefreshCw } from "lucide-react";
import { AccountErrorBanner } from "@/app/admin_recruiter/account/components/AccountFormStatus";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import BrandingColorField from "@/app/tenant-onboarding/BrandingColorField";
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
import {
  brandingFontFamily,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";
import BrandingAuthPreview from "@/app/admin_recruiter/settings/BrandingAuthPreview";
import HireJourneyThemePanel from "@/app/admin_recruiter/settings/HireJourneyThemePanel";
import { staffFetchInit } from "@/lib/staff-auth-headers";
import toast from "react-hot-toast";

type PreviewMode = "login" | "signup";
type LogoField = "logo" | "login" | "signup" | "favicon";
type BrandingMainTab = "branding" | "hiring-journey";
type BrandingSubTab = "logo" | "backgrounds" | "colors" | "typography";

const BRANDING_SUB_TABS: Array<{ id: BrandingSubTab; label: string }> = [
  { id: "logo", label: "Logo" },
  { id: "backgrounds", label: "Backgrounds" },
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
];

function isBrandingSubTab(value: string | null): value is BrandingSubTab {
  return BRANDING_SUB_TABS.some((tab) => tab.id === value);
}

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

const LOGO_ACTION_CLASS =
  "inline-flex h-[30px] shrink-0 cursor-pointer items-center rounded-lg px-2.5 text-[10px] font-semibold leading-[15px]";

function LogoUploadBlock({
  label,
  hint,
  previewSrc,
  onFileChange,
  onRemove,
}: {
  label: string;
  hint: string;
  previewSrc: string;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasImage = previewSrc.trim().length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-[350px]">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt=""
            className="size-11 shrink-0 rounded-full bg-white object-contain"
          />
        ) : (
          <span className="size-11 shrink-0 rounded-full border border-[#E5E7EB] bg-[#F8FAFC]" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-4 text-black">{label}</p>
          <p className="text-[10px] leading-[15px] text-[#6B7280]">{hint}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2.5">
        <button type="button" onClick={onRemove} className={`${LOGO_ACTION_CLASS} border border-[#012352] bg-white text-[#012352]`}>
          Remove
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`${LOGO_ACTION_CLASS} bg-[#012352] text-white`}
        >
          Choose file
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.png,.jpg,.jpeg,.webp,.svg,.ico"
        onChange={(event) => {
          onFileChange(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
        className="sr-only"
      />
    </div>
  );
}

function BackgroundUploadCard({
  title,
  previewSrc,
  onFileChange,
}: {
  title: string;
  previewSrc: string;
  onFileChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasImage = previewSrc.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3.5">
      <p className="text-sm font-semibold leading-5 text-black">{title}</p>
      <div className="relative h-[220px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F8FAFC]">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[#94A3B8]">
            No background selected
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-[30px] w-full items-center justify-center rounded-lg bg-[#012352] px-2.5 text-[10px] font-semibold text-white"
      >
        Choose Image
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          onFileChange(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
        className="sr-only"
      />
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-3.5">
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="size-9 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white p-0.5"
          aria-label={label}
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-[96px] rounded-lg border border-[#E5E7EB] px-2.5 text-xs font-medium uppercase text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
        />
      </div>
      <span className="text-xs font-medium text-[#6B7280]">{label}</span>
    </div>
  );
}

async function uploadLogo(field: LogoField, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("field", field);
  const uploadRes = await fetch("/api/admin/branding/logo", {
    method: "POST",
    ...(await staffFetchInit()),
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

export default function BrandingSettingsPanel({
  initialMainTab = "branding",
}: {
  initialMainTab?: BrandingMainTab;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentBranding = useTenantBranding();
  const editedRef = useRef(false);
  const [phase, setPhase] = useState<"refreshing" | "ready" | "error" | "empty">("refreshing");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("login");
  const [mainTab, setMainTab] = useState<BrandingMainTab>(initialMainTab);
  const [subTab, setSubTab] = useState<BrandingSubTab>(() => {
    const fromQuery = searchParams.get("section");
    return isBrandingSubTab(fromQuery) ? fromQuery : "logo";
  });

  useEffect(() => {
    setMainTab(initialMainTab);
  }, [initialMainTab]);

  function syncTabQuery(nextMain: BrandingMainTab, nextSub: BrandingSubTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextMain === "hiring-journey") {
      params.delete("section");
      params.set("tab", "hiring-journey");
    } else {
      params.delete("tab");
      params.set("section", nextSub);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

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
  const [clearedLogos, setClearedLogos] = useState<Record<LogoField, boolean>>({
    logo: false,
    login: false,
    signup: false,
    favicon: false,
  });

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
    setPhase("refreshing");
    setLoadError(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/branding", {
        ...(await staffFetchInit()),
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        branding?: TenantBranding;
        tenantId?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not load branding.");
      if (payload.branding) {
        if (!editedRef.current) applyBranding(payload.branding);
        patchEffectiveBrandingCache(queryClient, payload.branding);
      }
      setPhase(payload.tenantId ? "ready" : "empty");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load branding.");
      setPhase("error");
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
      logoUrl: clearedLogos.logo ? logoPreview || "" : logoPreview || logoUrl,
      loginLogoUrl: clearedLogos.login
        ? clearedLogos.logo
          ? logoPreview || ""
          : logoPreview || logoUrl
        : loginLogoPreview || loginLogoUrl || (clearedLogos.logo ? logoPreview || "" : logoPreview || logoUrl),
      signupLogoUrl: clearedLogos.signup
        ? clearedLogos.logo
          ? logoPreview || ""
          : logoPreview || logoUrl
        : signupLogoPreview || signupLogoUrl || (clearedLogos.logo ? logoPreview || "" : logoPreview || logoUrl),
      faviconUrl: clearedLogos.favicon
        ? clearedLogos.logo
          ? logoPreview || ""
          : logoPreview || logoUrl
        : faviconPreview || faviconUrl || (clearedLogos.logo ? logoPreview || "" : logoPreview || logoUrl),
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
      clearedLogos,
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

    try {
      const saveInit = await staffFetchInit({ "Content-Type": "application/json" });

      let nextLogoUrl = clearedLogos.logo ? "" : logoUrl;
      let nextLoginLogoUrl = clearedLogos.login ? "" : loginLogoUrl;
      let nextSignupLogoUrl = clearedLogos.signup ? "" : signupLogoUrl;
      let nextFaviconUrl = clearedLogos.favicon ? "" : faviconUrl;
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
          ...(await staffFetchInit()),
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
        ...saveInit,
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
      setClearedLogos({ logo: false, login: false, signup: false, favicon: false });
      toast.success("Saved! Your team and workers will see the new look.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save branding.");
    } finally {
      setSaving(false);
    }
  };

  if (phase === "error") {
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

  if (phase === "empty") {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <p className="text-base font-semibold text-[#0F172A]">No organization selected</p>
        <p className="mt-2 text-sm text-[#64748B]">
          Switch to your company in the header, then open Settings again.
        </p>
      </div>
    );
  }

  const previewCard = (
    <aside className="flex w-full min-w-0 flex-col gap-3 self-start rounded-xl border border-[#E5E7EB] bg-white p-3.5 xl:sticky xl:top-4">
      <div className="flex items-start gap-2.5">
        <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#FBF8F2] p-2">
          <span className="flex size-5 items-center justify-center">
            <img src="/icons/settings-nav/preview-mark.svg" alt="" width={15.1667} height={15.1667} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold leading-5 text-black">Preview</p>
            <div className="flex gap-2">
              {(["login", "signup"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  data-branding-ignore-edit=""
                  onClick={() => setPreviewMode(mode)}
                  className={`cursor-pointer text-[10px] leading-[15px] ${
                    previewMode === mode ? "font-semibold text-[#012352]" : "font-normal text-[#6B7280]"
                  }`}
                >
                  {mode === "login" ? "Login" : "Signup"}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] leading-[15px] text-[#6B7280]">Live preview of login and signup styling.</p>
        </div>
      </div>
      <div className="relative w-full overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <BrandingAuthPreview branding={preview} mode={previewMode} />
      </div>
    </aside>
  );

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => {
        editedRef.current = true;
      }}
      onClick={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("[data-branding-ignore-edit]")) return;
        if (target.closest("button")) editedRef.current = true;
      }}
      className="space-y-6"
    >
      {error ? <AccountErrorBanner message={error} /> : null}

      <div>
        <h1 className="text-xl font-semibold leading-7 text-black">Branding</h1>
        <p className="text-xs font-normal leading-4 text-[#6B7280]">Customized your branding.</p>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex h-10 items-center rounded-full border border-[#E5E7EB] bg-[#F8FAFC] p-1">
          {(
            [
              { id: "branding", label: "Branding" },
              { id: "hiring-journey", label: "Hiring Journey" },
            ] as const
          ).map((tab) => {
            const active = mainTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-branding-ignore-edit=""
                onClick={() => {
                  setMainTab(tab.id);
                  syncTabQuery(tab.id, subTab);
                }}
                className={`inline-flex h-8 min-w-[140px] cursor-pointer items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
                  active ? "bg-[#012352] text-white shadow-sm" : "text-[#012352] hover:bg-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {mainTab === "branding" ? (
        <>
          <div className="-mx-1 overflow-x-auto px-1">
            <nav className="flex gap-1" aria-label="Branding sections">
              {BRANDING_SUB_TABS.map((tab) => {
                const active = subTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-branding-ignore-edit=""
                    onClick={() => {
                      setSubTab(tab.id);
                      syncTabQuery("branding", tab.id);
                    }}
                    className={`relative min-h-10 shrink-0 cursor-pointer px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "text-[color:var(--brand-primary)]"
                        : "text-[#64748B] hover:text-[#0F172A]"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {tab.label}
                    {active ? (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[color:var(--brand-primary)]" />
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>

          {subTab === "logo" ? (
            <div className="flex flex-col gap-[30px]">
              <div>
                <h3 className="text-sm font-semibold leading-5 text-black">Company Logo</h3>
                <p className="text-[10px] leading-[15px] text-[#6B7280]">
                  Upload your company logo and optional login/signup variants
                </p>
              </div>
              <div className="grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
                <div className="flex min-w-0 flex-col gap-5">
                  <LogoUploadBlock
                    label="Company logo"
                    hint="Used in the app shell and as a fallback. PNG, JPG, WEBP, or SVG. Max 2 MB."
                    previewSrc={clearedLogos.logo ? logoPreview || "" : logoPreview || logoUrl}
                    onFileChange={(file) => {
                      setLogoFile(file);
                      if (file) setClearedLogos((current) => ({ ...current, logo: false }));
                    }}
                    onRemove={() => {
                      setLogoFile(null);
                      setClearedLogos((current) => ({ ...current, logo: true }));
                    }}
                  />
                  <LogoUploadBlock
                    label="Login page logo"
                    hint="Shown on worker and recruiter sign-in. Falls back to company logo."
                    previewSrc={
                      clearedLogos.login ? loginLogoPreview || "" : loginLogoPreview || loginLogoUrl
                    }
                    onFileChange={(file) => {
                      setLoginLogoFile(file);
                      if (file) setClearedLogos((current) => ({ ...current, login: false }));
                    }}
                    onRemove={() => {
                      setLoginLogoFile(null);
                      setClearedLogos((current) => ({ ...current, login: true }));
                    }}
                  />
                  <LogoUploadBlock
                    label="Sign up page logo"
                    hint="Shown on tenant signup. Falls back to company logo."
                    previewSrc={
                      clearedLogos.signup ? signupLogoPreview || "" : signupLogoPreview || signupLogoUrl
                    }
                    onFileChange={(file) => {
                      setSignupLogoFile(file);
                      if (file) setClearedLogos((current) => ({ ...current, signup: false }));
                    }}
                    onRemove={() => {
                      setSignupLogoFile(null);
                      setClearedLogos((current) => ({ ...current, signup: true }));
                    }}
                  />
                  <LogoUploadBlock
                    label="Favicon"
                    hint="Small icon shown in the browser tab, sidebar, header, and applicant portal. Square image works best."
                    previewSrc={
                      clearedLogos.favicon ? faviconPreview || "" : faviconPreview || faviconUrl
                    }
                    onFileChange={(file) => {
                      setFaviconFile(file);
                      if (file) setClearedLogos((current) => ({ ...current, favicon: false }));
                    }}
                    onRemove={() => {
                      setFaviconFile(null);
                      setClearedLogos((current) => ({ ...current, favicon: true }));
                    }}
                  />
                </div>
                {previewCard}
              </div>
            </div>
          ) : null}

          {subTab === "backgrounds" ? (
            <div className="flex flex-col gap-[30px]">
              <div>
                <h3 className="text-sm font-semibold leading-5 text-black">Backgrounds</h3>
                <p className="text-[10px] leading-[15px] text-[#6B7280]">
                  Backgrounds for logins and signup styling
                </p>
              </div>
              <div className="grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
                <div className="flex min-w-0 flex-col gap-5 sm:flex-row">
                  <BackgroundUploadCard
                    title="Login Background"
                    previewSrc={backgroundPreview || loginBackgroundSrc}
                    onFileChange={setBackgroundFile}
                  />
                  <BackgroundUploadCard
                    title="Signup Background"
                    previewSrc={backgroundPreview || loginBackgroundSrc}
                    onFileChange={setBackgroundFile}
                  />
                </div>
                {previewCard}
              </div>
              <div className="grid w-full gap-4 md:grid-cols-2 xl:max-w-[calc(100%-384px)]">
                <FieldBlock label="Login headline">
                  <input
                    value={headline}
                    onChange={(event) => setHeadline(event.target.value)}
                    placeholder={`Welcome to ${currentBranding.companyName}`}
                    className="h-11 w-full rounded-lg border border-[#CBD5E1] px-4 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
                  />
                </FieldBlock>
                <FieldBlock label="Login subheadline">
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
                <FieldBlock label="Button text">
                  <input
                    value={buttonText}
                    onChange={(event) => setButtonText(event.target.value)}
                    placeholder="Sign in"
                    className="h-11 w-full rounded-lg border border-[#CBD5E1] px-4 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)]"
                  />
                </FieldBlock>
                <BrandingColorField
                  label="Button color"
                  value={buttonColor}
                  defaultValue={primaryHex}
                  onChange={setButtonColor}
                />
              </div>
            </div>
          ) : null}

          {subTab === "colors" ? (
            <div className="flex flex-col gap-[30px]">
              <div>
                <h3 className="text-sm font-semibold leading-5 text-black">Colors</h3>
                <p className="text-[10px] leading-[15px] text-[#6B7280]">
                  Set your brand palette for login and signup
                </p>
              </div>
              <div className="grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
                <div className="flex min-w-0 flex-col gap-[30px]">
                  <div className="flex flex-col gap-[14px]">
                    <p className="text-sm font-semibold leading-5 text-black">Quick Presets</p>
                    <div className="grid gap-5 sm:grid-cols-2">
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
                            className={`rounded-xl border bg-white p-4 text-left transition ${
                              active
                                ? "border-[color:var(--brand-primary)] shadow-sm"
                                : "border-[#E5E7EB] hover:border-[#94A3B8]"
                            }`}
                          >
                            <div className="flex gap-2">
                              <span
                                className="size-6 rounded-full border border-black/10"
                                style={{ backgroundColor: preset.primary }}
                              />
                              <span
                                className="size-6 rounded-full border border-black/10"
                                style={{ backgroundColor: preset.secondary }}
                              />
                              <span
                                className="size-6 rounded-full border border-black/10"
                                style={{ backgroundColor: preset.accent }}
                              />
                            </div>
                            <p className="mt-3 text-xs font-semibold text-black">{preset.label}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-[14px]">
                    <p className="text-sm font-semibold leading-5 text-black">Custom Colors</p>
                    <div className="flex flex-col gap-[14px]">
                      <ColorRow label="Primary color" value={primaryHex} onChange={setPrimaryHex} />
                      <ColorRow label="Second color" value={secondaryHex} onChange={setSecondaryHex} />
                      <ColorRow label="Accent color" value={accentHex} onChange={setAccentHex} />
                    </div>
                  </div>
                </div>
                {previewCard}
              </div>
            </div>
          ) : null}

          {subTab === "typography" ? (
            <div className="flex flex-col gap-[30px]">
              <div>
                <h3 className="text-sm font-semibold leading-5 text-black">Typography</h3>
                <p className="text-[10px] leading-[15px] text-[#6B7280]">
                  Fonts and text colors for auth pages
                </p>
              </div>
              <div className="grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
                <div className="flex min-w-0 flex-col gap-[30px]">
                  <div className="flex flex-col gap-[14px]">
                    <p className="text-sm font-semibold leading-5 text-black">Font Family</p>
                    <div className="grid gap-5 md:grid-cols-3">
                      <div className="rounded-xl border border-[#E5E7EB] bg-white p-3.5">
                        <FontSelect label="Primary font" value={primaryFontId} onChange={setPrimaryFontId} />
                      </div>
                      <div className="rounded-xl border border-[#E5E7EB] bg-white p-3.5">
                        <FontSelect label="Heading font" value={headingFontId} onChange={setHeadingFontId} />
                      </div>
                      <div className="rounded-xl border border-[#E5E7EB] bg-white p-3.5">
                        <FontSelect label="Body font" value={bodyFontId} onChange={setBodyFontId} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-[14px]">
                    <p className="text-sm font-semibold leading-5 text-black">Font Colors</p>
                    <div className="flex flex-col gap-[14px]">
                      <ColorRow label="Body text color" value={fontColor} onChange={setFontColor} />
                      <ColorRow label="Heading color" value={headingColor} onChange={setHeadingColor} />
                      <ColorRow label="Muted text color" value={mutedTextColor} onChange={setMutedTextColor} />
                    </div>
                  </div>
                </div>
                {previewCard}
              </div>
            </div>
          ) : null}
          <div className="flex w-full flex-col-reverse gap-3 border-t border-[#E5E7EB] pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              data-branding-ignore-edit=""
              onClick={() => {
                editedRef.current = false;
                void loadBranding();
              }}
              disabled={saving}
              className={actionButtonClass("secondary", saving)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={actionButtonClass("primary", saving)}
              style={{ backgroundColor: "#012352" }}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </>
      ) : (
        <HireJourneyThemePanel embedded />
      )}
    </form>
  );
}
