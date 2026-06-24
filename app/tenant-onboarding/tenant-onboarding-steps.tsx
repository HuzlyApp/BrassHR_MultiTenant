"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Link2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { SignupStateOption } from "@/lib/signup/owner-signup";
import OnboardingStepsBuilder from "@/app/components/onboarding/OnboardingStepsBuilder";
import { interStyle, primaryButtonStyle } from "@/app/tenant-onboarding/TenantOnboardingShell";
import {
  COMPANY_SIZE_OPTIONS,
  INDUSTRY_OPTIONS,
  TENANT_GOAL_OPTIONS,
  brandingFontStack,
  TENANT_BRANDING_FONT_OPTIONS,
  type BusinessInfoForm,
  type TenantBrandingFontId,
  type TenantBrandingThemeMode,
  type TenantGoalId,
} from "@/app/tenant-onboarding/constants";
import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import { subdomainErrorMessage, validateTenantSubdomainInput } from "@/lib/tenant/subdomain-validation";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { withTenant } from "@/lib/tenant/with-tenant";

const inputTypographyStyle = {
  fontFamily: "Inter, Arial, sans-serif",
  fontSize: "16px",
  lineHeight: "24px",
  fontWeight: 400,
  letterSpacing: "0",
} as const;

const inputTextClass =
  "text-[16px] font-normal leading-[24px] tracking-normal placeholder:text-[16px] placeholder:leading-[24px] placeholder:font-normal";

const inputFocusClass =
  "tenant-onboarding-input text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]";

function FieldLabel({ children, required = true }: { children: string; required?: boolean }) {
  return (
    <label
      className="mb-[8px] block text-[14px] font-normal leading-[20px] tracking-normal text-[#374151]"
      style={interStyle}
    >
      {children}
      {required ? <span className="ml-1 text-[#e11d48]">*</span> : null}
    </label>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="mb-6 rounded-[8px] border border-[#fecaca] bg-[#fef2f2] px-[14px] py-[12px] text-[14px] leading-[20px] text-[#b91c1c]"
      style={interStyle}
    >
      {message}
    </div>
  );
}

function ContinueButton({
  label = "Continue",
  disabled,
  onClick,
  type = "button",
  className = "",
}: {
  label?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  const enabled = !disabled;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[54px] w-full items-center justify-center rounded-[12px] text-[16px] font-semibold leading-[22px] tracking-normal transition disabled:cursor-not-allowed disabled:bg-[#dddddd] disabled:text-[#c5c5c5] enabled:text-white enabled:hover:brightness-95 ${className}`.trim()}
      style={primaryButtonStyle(enabled)}
    >
      {label}
    </button>
  );
}

function SkipForNowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-[14px] inline-flex w-full items-center justify-center gap-[6px] text-[13px] font-semibold leading-[18px] text-[#104b83] transition hover:text-[#0b3a70]"
      style={interStyle}
    >
      Skip for now
      <ChevronRight className="h-[14px] w-[14px]" strokeWidth={2.5} />
    </button>
  );
}

function BackButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[54px] w-full items-center justify-center rounded-[12px] border border-[#012352] bg-white text-[16px] font-semibold leading-[22px] tracking-normal text-md text-[#012352] transition hover:bg-[#f8fafc] ${className}`.trim()}
      style={interStyle}
    >
      Back
    </button>
  );
}

function StepActions({
  onBack,
  onContinue,
  continueLabel = "Continue",
  continueDisabled,
  className = "",
}: {
  onBack: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`mt-[32px] flex flex-col-reverse gap-3 sm:flex-row sm:items-stretch ${className}`.trim()}>
      <BackButton onClick={onBack} className="sm:flex-1" />
      <ContinueButton
        className="sm:flex-1"
        label={continueLabel}
        disabled={continueDisabled}
        onClick={onContinue}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputTypographyStyle}
        className={`h-[56px] w-full rounded-[8px] border border-[#cbd5e1] bg-white px-[14px] ${inputTextClass} text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] ${inputFocusClass}`}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  placeholder,
  options,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options: readonly string[];
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={inputTypographyStyle}
          className={`h-[56px] w-full appearance-none rounded-[8px] border border-[#cbd5e1] bg-white px-[14px] pr-10 ${inputTextClass} text-[#0f172a] outline-none transition disabled:cursor-not-allowed disabled:bg-[#f7f8fa] disabled:text-[#94a3b8] ${inputFocusClass} ${
            value ? "text-[#0f172a]" : "text-[#94a3b8]"
          }`}
        >
          <option value="">{placeholder ?? "Select"}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#64748b]" />
      </div>
    </div>
  );
}

function AddressField({
  label,
  value,
  onChange,
  placeholder,
  required = true,
  helperText = "Building, Floor, etc.",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  helperText?: string;
}) {
  return (
    <div>
      <div className="mb-[8px] flex items-center justify-between gap-2">
        <FieldLabel required={required}>{label}</FieldLabel>
        {helperText ? (
          <span
            className="shrink-0 text-[12px] font-normal leading-[16px] text-[#94a3b8]"
            style={interStyle}
          >
            {helperText}
          </span>
        ) : null}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputTypographyStyle}
        className={`h-[56px] w-full rounded-[8px] border border-[#cbd5e1] bg-white px-[14px] ${inputTextClass} text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] ${inputFocusClass}`}
      />
    </div>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-left">
      <h2 className="text-[28px] font-semibold leading-[36px] tracking-normal text-[#0f172a] sm:text-[30px]" style={interStyle}>
        {title}
      </h2>
      <p className="mt-[8px] text-[16px] font-normal leading-[24px] text-[#64748b]" style={interStyle}>
        {subtitle}
      </p>
    </div>
  );
}

type GoalCardProps = {
  id: TenantGoalId;
  label: string;
  icon: string;
  selected: boolean;
  onToggle: (id: TenantGoalId) => void;
};

function GoalCard({ id, label, icon, selected, onToggle }: GoalCardProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className={`flex w-full items-center gap-[14px] rounded-[12px] border px-[16px] py-[18px] text-left transition ${
        selected
          ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)]"
          : "border-[#e2e8f0] bg-white hover:border-[#cbd5e1]"
      }`}
    >
      <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[10px] bg-[#f5efe6]">
        <Image src={icon} alt="" width={26} height={26} className="h-[26px] w-[26px]" />
      </span>
      <span className="flex-1 text-[15px] font-medium leading-[22px] text-[#104b83]" style={interStyle}>
        {label}
      </span>
      <span
        className={`flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[8px] border ${
          selected ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]" : "border-[#cbd5e1] bg-white"
        }`}
      >
        {selected ? <Check className="h-[14px] w-[14px] text-white" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

export function GoalsStep({
  selectedGoals,
  onToggleGoal,
  onContinue,
  onSkip,
}: {
  selectedGoals: TenantGoalId[];
  onToggleGoal: (id: TenantGoalId) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <div>
      <StepHeading
        title="What brings you to brassHR"
        subtitle="Choose what matters most to you, and we'll make sure to help you hit your goals."
      />
      <div className="mt-[28px] grid gap-[16px] sm:grid-cols-2">
        {TENANT_GOAL_OPTIONS.map((goal) => (
          <GoalCard
            key={goal.id}
            id={goal.id}
            label={goal.label}
            icon={goal.icon}
            selected={selectedGoals.includes(goal.id)}
            onToggle={onToggleGoal}
          />
        ))}
      </div>
      <ContinueButton className="mt-[32px]" disabled={selectedGoals.length === 0} onClick={onContinue} />
      <SkipForNowButton onClick={onSkip} />
    </div>
  );
}

export function BusinessStep({
  orgName,
  businessInfo,
  onOrgNameChange,
  onBusinessInfoChange,
  onContinue,
  onBack,
  onSkip,
}: {
  orgName: string;
  businessInfo: BusinessInfoForm;
  onOrgNameChange: (value: string) => void;
  onBusinessInfoChange: (patch: Partial<BusinessInfoForm>) => void;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [stateRows, setStateRows] = useState<SignupStateOption[]>([]);
  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [locationLoading, setLocationLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabaseBrowser
          .from("signup_us_states")
          .select("code, name")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });

        if (!active || error || !data?.length) return;

        const states = data.map((row) => ({
          code: String(row.code),
          name: String(row.name),
        }));
        setStateRows(states);
        setStateOptions(states.map((row) => row.name));
      } finally {
        if (active) setLocationLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedStateCode = useMemo(
    () => stateRows.find((row) => row.name === businessInfo.state)?.code ?? "",
    [businessInfo.state, stateRows]
  );

  useEffect(() => {
    if (!selectedStateCode || selectedStateCode.length !== 2) {
      setCityOptions([]);
      setCitiesLoading(false);
      return;
    }

    let active = true;
    setCitiesLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabaseBrowser
          .from("signup_us_cities")
          .select("city_name")
          .eq("state_code", selectedStateCode)
          .order("sort_order", { ascending: true })
          .order("city_name", { ascending: true });

        if (!active) return;
        if (error) {
          setCityOptions([]);
          return;
        }

        const names = (data ?? []).map((row) => String(row.city_name));
        setCityOptions(names);
      } catch {
        if (active) setCityOptions([]);
      } finally {
        if (active) setCitiesLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedStateCode]);

  const canContinue =
    orgName.trim().length >= 2 &&
    businessInfo.industry.trim().length > 0 &&
    businessInfo.companySize.trim().length > 0 &&
    businessInfo.city.trim().length > 0 &&
    businessInfo.state.trim().length > 0 &&
    businessInfo.address.trim().length > 0 &&
    businessInfo.zipCode.trim().length >= 5;

  return (
    <div>
      <StepHeading
        title="Business Information"
        subtitle="Add your business info."
      />

      <div className="mt-[28px] space-y-[24px]">
        <TextField
          label="Company Name"
          required
          value={orgName}
          onChange={onOrgNameChange}
          placeholder="ABC Company"
        />

        <div className="grid gap-[24px] sm:grid-cols-2">
          <SelectField
            label="Industry"
            required
            value={businessInfo.industry}
            onChange={(value) => onBusinessInfoChange({ industry: value })}
            placeholder="Select industry"
            options={INDUSTRY_OPTIONS}
          />
          <SelectField
            label="Number of Employees"
            required
            value={businessInfo.companySize}
            onChange={(value) => onBusinessInfoChange({ companySize: value })}
            placeholder="Select size"
            options={COMPANY_SIZE_OPTIONS}
          />
        </div>

        <div className="grid gap-[24px] sm:grid-cols-2">
          <SelectField
            label="State"
            required
            value={businessInfo.state}
            onChange={(value) => onBusinessInfoChange({ state: value, city: "" })}
            placeholder={locationLoading ? "Loading…" : "Select state"}
            options={stateOptions}
            disabled={locationLoading}
          />
          {businessInfo.state && cityOptions.length === 0 && !citiesLoading ? (
            <TextField
              label="City"
              required
              value={businessInfo.city}
              onChange={(value) => onBusinessInfoChange({ city: value })}
              placeholder="Enter your city"
            />
          ) : (
            <SelectField
              label="City"
              required
              disabled={!businessInfo.state || citiesLoading}
              value={businessInfo.city}
              onChange={(value) => onBusinessInfoChange({ city: value })}
              placeholder={
                !businessInfo.state
                  ? "Select state first"
                  : citiesLoading
                    ? "Loading…"
                    : cityOptions.length > 0
                      ? "Select city"
                      : "No cities listed"
              }
              options={cityOptions}
            />
          )}
        </div>

        <AddressField
          label="Business Address"
          required
          value={businessInfo.address}
          onChange={(value) => onBusinessInfoChange({ address: value })}
          placeholder="123 Maple Street, Springfield, IL 62704, USA"
        />

        <div className="grid gap-[24px] sm:grid-cols-2">
          <TextField
            label="Business Phone"
            required={false}
            value={businessInfo.phone}
            onChange={(value) => onBusinessInfoChange({ phone: value })}
            placeholder="(201) 512-2366"
            type="tel"
          />
          <TextField
            label="Business Email Address"
            required={false}
            value={businessInfo.email}
            onChange={(value) => onBusinessInfoChange({ email: value })}
            placeholder="info@abccompany.com"
            type="email"
          />
        </div>

        <div className="grid gap-[24px] sm:grid-cols-2">
          <TextField
            label="Zip Code"
            required
            value={businessInfo.zipCode}
            onChange={(value) =>
              onBusinessInfoChange({ zipCode: value.replace(/\D/g, "").slice(0, 10) })
            }
            placeholder="40170"
          />
          <TextField
            label="EIN Number"
            required={false}
            value={businessInfo.ein}
            onChange={(value) => onBusinessInfoChange({ ein: value })}
            placeholder="902231829"
          />
        </div>
      </div>

      <StepActions
        onBack={onBack}
        onContinue={onContinue}
        continueLabel="Save and Continue"
        continueDisabled={!canContinue}
      />
      <SkipForNowButton onClick={onSkip} />
    </div>
  );
}

const LOGO_ACCEPT = "image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg";

function isAllowedLogoFile(file: File): boolean {
  const allowed = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
  ]);
  if (file.type && allowed.has(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "png" || ext === "jpg" || ext === "jpeg";
}

export function CompanyLogoStep({
  logoUrl,
  logoFile,
  orgName,
  logoDisplayName,
  logoTagline,
  onLogoFileChange,
  onLogoUrlChange,
  onLogoDisplayNameChange,
  onLogoTaglineChange,
  onContinue,
  onBack,
  onSkip,
}: {
  logoUrl: string;
  logoFile: File | null;
  orgName: string;
  logoDisplayName: string;
  logoTagline: string;
  onLogoFileChange: (file: File | null, previewUrl: string) => void;
  onLogoUrlChange: (value: string) => void;
  onLogoDisplayNameChange: (value: string) => void;
  onLogoTaglineChange: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [previewSrc, setPreviewSrc] = useState("");

  useEffect(() => {
    if (logoFile) {
      const objectUrl = URL.createObjectURL(logoFile);
      setPreviewSrc(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }

    const external = logoUrl.trim();
    if (external.startsWith("blob:") || external.startsWith("data:") || external.startsWith("http")) {
      setPreviewSrc(external);
      return;
    }

    setPreviewSrc("");
  }, [logoFile, logoUrl]);

  const hasUserLogo = Boolean(logoFile) || previewSrc.length > 0;

  const previewName = logoDisplayName.trim() || orgName.trim() || "Your company name";
  const previewTagline = logoTagline.trim() || "Your company tagline";

  const canContinue =
    logoDisplayName.trim().length >= 1 && logoTagline.trim().length >= 1;

  const handleFile = (file: File | null) => {
    if (!file) return;

    if (!isAllowedLogoFile(file)) {
      setUploadError("Only support png, jpg files");
      return;
    }

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError("Max 10 MB files are allowed");
      return;
    }

    setUploadError(null);
    const objectUrl = URL.createObjectURL(file);
    onLogoFileChange(file, objectUrl);
    onLogoUrlChange(objectUrl);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFile(event.dataTransfer.files?.[0] ?? null);
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0] ?? null);
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleRemoveLogo = (event: React.MouseEvent) => {
    event.stopPropagation();
    setUploadError(null);
    setTransparentBackground(false);
    onLogoFileChange(null, "");
    onLogoUrlChange("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <StepHeading title="Company Logo" subtitle="Customize your company logo" />

      <div className="mt-[28px] space-y-[24px]">
        <TextField
          label="Logo Name"
          required
          value={logoDisplayName}
          onChange={onLogoDisplayNameChange}
          placeholder="Logo name"
        />
        <TextField
          label="Tagline"
          required
          value={logoTagline}
          onChange={onLogoTaglineChange}
          placeholder="Tagline"
        />

        {hasUserLogo ? (
          <>
            <div className="flex items-center gap-[14px] rounded-[12px] border border-[color:var(--brand-primary)] bg-[#F4F4F4] px-[16px] py-[14px]">
              <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#e2e8f0] bg-white p-1">
                {previewSrc ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewSrc}
                    alt=""
                    className="h-full w-full rounded-full object-contain"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p
                  className="truncate text-[16px] font-semibold leading-[22px] text-[#374151]"
                  style={interStyle}
                >
                  {previewName}
                </p>
                <p
                  className="truncate text-[14px] font-normal leading-[20px] text-[#94a3b8]"
                  style={interStyle}
                >
                  {previewTagline}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[8px] text-[color:var(--brand-primary)] transition hover:bg-white/80"
                aria-label="Remove logo"
              >
                <Trash2 className="h-[20px] w-[20px]" strokeWidth={2} />
              </button>
            </div>

            <label className="flex cursor-pointer items-start gap-[10px]">
              <span
                className={`relative mt-[2px] flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] border ${
                  transparentBackground
                    ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]"
                    : "border-[#cbd5e1] bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={transparentBackground}
                  onChange={(e) => setTransparentBackground(e.target.checked)}
                  className="absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
                  aria-label="Make the white background on my logo transparent"
                />
                {transparentBackground ? (
                  <Check className="h-[14px] w-[14px] text-white" strokeWidth={3} />
                ) : null}
              </span>
              <span
                className="text-[14px] font-normal leading-[20px] text-[#94a3b8]"
                style={interStyle}
              >
                Make the white background on my logo transparent
              </span>
            </label>
          </>
        ) : (
          <div>
            <h3
              className="text-[16px] font-semibold leading-[24px] text-[#0f172a]"
              style={interStyle}
            >
              Upload Logo
            </h3>

            <div
              role="button"
              tabIndex={0}
              onClick={openFilePicker}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openFilePicker();
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="mt-[16px] flex cursor-pointer flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-[#94a3b8] bg-white px-6 py-[28px] transition hover:border-[#64748b] hover:bg-[#fafafa]"
            >
              <Image
                src="/icons/braas-HR/tenant-onboarding/upload.svg"
                alt=""
                width={36}
                height={36}
                className="h-[36px] w-[36px]"
              />

              <p
                className="mt-[16px] text-[16px] font-medium leading-[24px] text-[#104b83]"
                style={interStyle}
              >
                Drag your file(s) to start uploading
              </p>

              <div className="my-[16px] flex w-full max-w-[320px] items-center gap-3">
                <div className="h-px flex-1 bg-[#cbd5e1]" aria-hidden />
                <span
                  className="text-[14px] font-medium leading-[20px] text-[#64748b]"
                  style={interStyle}
                >
                  OR
                </span>
                <div className="h-px flex-1 bg-[#cbd5e1]" aria-hidden />
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openFilePicker();
                }}
                className="flex h-[44px] min-w-[160px] items-center justify-center rounded-[8px] border border-[#104b83] bg-white px-6 text-[14px] font-semibold leading-[20px] text-[#104b83] transition hover:bg-[#f8fafc]"
                style={interStyle}
              >
                Browse files
              </button>

              <p
                className="mt-[12px] text-[13px] leading-[18px] text-[#94a3b8]"
                style={interStyle}
              >
                Max 10 MB files are allowed
              </p>

              <p
                className="mt-[16px] text-[14px] leading-[20px] text-[#64748b]"
                style={interStyle}
              >
                Recommended image size: 512×512 px
              </p>
            </div>

            {uploadError ? (
              <p className="mt-[8px] text-[13px] leading-[18px] text-[#b91c1c]" style={interStyle}>
                {uploadError}
              </p>
            ) : null}

            <p className="mt-[12px] text-[13px] leading-[18px] text-[#94a3b8]" style={interStyle}>
              Only support png, jpg files
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={LOGO_ACCEPT}
          className="hidden"
          onChange={onFileInput}
        />
      </div>

      <StepActions
        onBack={onBack}
        onContinue={onContinue}
        continueLabel="Save and Continue"
        continueDisabled={!canContinue}
      />
      <SkipForNowButton onClick={onSkip} />
    </div>
  );
}

function SplitCircle({ left, right }: { left: string; right: string }) {
  return (
    <div
      className="mx-auto flex h-[88px] w-[88px] shrink-0 overflow-hidden rounded-full border border-black/10 shadow-sm"
      aria-hidden
    >
      <div className="h-full w-1/2" style={{ backgroundColor: left }} />
      <div className="h-full w-1/2" style={{ backgroundColor: right }} />
    </div>
  );
}

export function BrandingStep({
  platformColors,
  themeMode,
  onThemeModeChange,
  fontId,
  onFontChange,
  primaryHex,
  secondaryHex,
  accentHex,
  headline,
  subtitle,
  backgroundUrl,
  orgName,
  preview,
  onPrimaryChange,
  onSecondaryChange,
  onAccentChange,
  onHeadlineChange,
  onSubtitleChange,
  onBackgroundChange,
  onContinue,
  onBack,
  onSkip,
}: {
  platformColors: { primary: string; secondary: string; accent: string };
  themeMode: TenantBrandingThemeMode;
  onThemeModeChange: (mode: TenantBrandingThemeMode) => void;
  fontId: TenantBrandingFontId;
  onFontChange: (id: TenantBrandingFontId) => void;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  headline: string;
  subtitle: string;
  backgroundUrl: string;
  orgName: string;
  preview: TenantBranding;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
  onAccentChange: (value: string) => void;
  onHeadlineChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onBackgroundChange: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const previewFont = brandingFontStack(fontId);
  const customSwatchLeft = "#94a3b8";
  const customSwatchRight = "#e2e8f0";

  return (
    <div>
      <div className="text-left">
        <h2 className="text-[30px] font-semibold leading-[36px] text-[#0f172a]" style={interStyle}>
          Branding
        </h2>
        <p className="mt-[8px] text-[16px] font-normal leading-[24px] text-[#64748b]" style={interStyle}>
          Customize your company&apos;s look and feel.
        </p>
      </div>

      <div className="mt-[28px] space-y-[28px]">
        <section>
          <h3 className="text-[16px] font-semibold leading-[22px] text-[#334155]" style={interStyle}>
            Select Theme Colors
          </h3>
          <div className="mt-[16px] grid grid-cols-2 gap-[14px]">
            <button
              type="button"
              onClick={() => onThemeModeChange("system")}
              className={`flex flex-col items-center rounded-[14px] border-2 bg-[#f8fafc] px-[16px] py-[20px] transition ${
                themeMode === "system"
                  ? "border-[color:var(--brand-primary)] ring-1 ring-[color:color-mix(in_srgb,var(--brand-primary)_35%,transparent)]"
                  : "border-transparent hover:border-[#e2e8f0]"
              }`}
            >
              <SplitCircle left={platformColors.primary} right={platformColors.accent} />
              <div className="mt-[14px] flex items-center gap-1.5">
                {themeMode === "system" ? (
                  <Check className="h-[16px] w-[16px] text-[color:var(--brand-secondary)]" strokeWidth={2.5} />
                ) : null}
                <span className="text-[14px] font-medium text-[#0f172a]" style={interStyle}>
                  System Default
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onThemeModeChange("custom")}
              className={`flex flex-col items-center rounded-[14px] border-2 bg-white px-[16px] py-[20px] transition ${
                themeMode === "custom"
                  ? "border-[color:var(--brand-primary)] ring-1 ring-[color:color-mix(in_srgb,var(--brand-primary)_35%,transparent)]"
                  : "border-[#e8edf4] hover:border-[#cbd5e1]"
              }`}
            >
              <SplitCircle left={customSwatchLeft} right={customSwatchRight} />
              <span className="mt-[14px] text-[14px] font-medium text-[#0f172a]" style={interStyle}>
                Custom Color
              </span>
            </button>
          </div>

          {themeMode === "custom" ? (
            <div className="mt-[20px] grid gap-[16px] sm:grid-cols-3">
              {[
                { label: "Primary", value: primaryHex, onChange: onPrimaryChange },
                { label: "Secondary", value: secondaryHex, onChange: onSecondaryChange },
                { label: "Accent", value: accentHex, onChange: onAccentChange },
              ].map((color) => (
                <label key={color.label} className="block">
                  <span className="mb-[8px] block text-[13px] font-medium text-[#475569]" style={interStyle}>
                    {color.label}
                  </span>
                  <div className="flex items-center gap-3 rounded-[10px] border border-[#e2e8f0] bg-white p-3">
                    <input
                      type="color"
                      value={color.value}
                      onChange={(e) => color.onChange(e.target.value)}
                      className="h-10 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <span className="font-mono text-[12px] text-[#64748b]">{color.value}</span>
                  </div>
                </label>
              ))}
            </div>
          ) : null}
        </section>

        <section>
          <h3 className="text-[16px] font-semibold leading-[22px] text-[#334155]" style={interStyle}>
            Select Fonts
          </h3>
          <div className="mt-[16px] flex flex-wrap gap-[10px]">
            {TENANT_BRANDING_FONT_OPTIONS.map((opt) => {
              const selected = fontId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onFontChange(opt.id)}
                  className={`flex min-w-[100px] flex-1 flex-col items-center justify-center rounded-[12px] border px-[12px] py-[18px] transition sm:min-w-[108px] ${
                    selected
                      ? "border-[color:var(--brand-primary)] bg-[#f8fafc]"
                      : "border-[#e2e8f0] bg-white hover:border-[#cbd5e1]"
                  }`}
                >
                  <span
                    className="text-[18px] font-semibold leading-none text-[#0f172a]"
                    style={{ fontFamily: opt.fontFamily }}
                  >
                    {opt.label}
                  </span>
                  {"isSystemDefault" in opt && opt.isSystemDefault ? (
                    <span className="mt-[8px] text-[11px] text-[#64748b]" style={interStyle}>
                      System Default
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-[14px] text-[13px] leading-[20px] text-[#64748b]" style={interStyle}>
            Note: You can skip this step if you want to use the default theme and font.
          </p>
        </section>

        <section className="rounded-[14px] border border-[#e8edf4] bg-[#fafafa] px-[16px] py-[18px]">
          <p className="mb-[14px] text-[13px] font-semibold text-[#475569]" style={interStyle}>
            Messages & background (optional)
          </p>
          <div className="space-y-[16px]">
            <TextField
              label="Welcome headline"
              required={false}
              value={headline}
              onChange={onHeadlineChange}
              placeholder={`Welcome to ${orgName.trim() || "your organization"}`}
            />
            <TextField
              label="Subtitle"
              required={false}
              value={subtitle}
              onChange={onSubtitleChange}
              placeholder="HR Simplified for growing teams"
            />
            <TextField
              label="Background image URL"
              required={false}
              value={backgroundUrl}
              onChange={onBackgroundChange}
              placeholder="/images/singup-bg-image.jpg"
            />
          </div>
        </section>

        <div className="rounded-[16px] border border-[#e2e8f0] bg-[#f8fafc] p-[16px]">
          <p className="mb-[12px] text-[13px] font-semibold uppercase tracking-wide text-[#64748b]" style={interStyle}>
            Live preview
          </p>
          <div
            className="overflow-hidden rounded-[12px] border border-[#e2e8f0] bg-white"
            style={{
              background: `linear-gradient(135deg, ${preview.primaryHex}22 0%, ${preview.secondaryHex}33 100%)`,
            }}
          >
            <div className="space-y-3 p-4" style={{ fontFamily: previewFont }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.logoUrl} alt="" className="mx-auto h-10 max-w-[140px] object-contain" />
              <p className="text-center text-[14px] font-semibold text-[#0f172a]">{preview.headline}</p>
              <p className="text-center text-[12px] text-[#64748b]">{preview.subtitle}</p>
              <button
                type="button"
                className="w-full rounded-[8px] py-2.5 text-[13px] font-semibold text-white"
                style={{ backgroundColor: preview.primaryHex }}
              >
                Start application
              </button>
            </div>
          </div>
        </div>
      </div>

      <StepActions
        className="mt-[36px]"
        onBack={onBack}
        onContinue={onContinue}
        continueLabel="Save and Continue"
      />
      <SkipForNowButton onClick={onSkip} />
    </div>
  );
}

export function DomainStep({
  subdomain,
  publicRootDomain,
  onSubdomainChange,
  onContinue,
  onBack,
}: {
  subdomain: string;
  publicRootDomain: string;
  onSubdomainChange: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const validation = validateTenantSubdomainInput(subdomain);
  const canContinue = !("failure" in validation);
  const hostPreview = publicRootDomain ? `${subdomain || "your-org"}.${publicRootDomain}` : null;

  return (
    <div>
      <StepHeading title="Create your BrassHR Domain" subtitle="Customize your BrassHR Domain" />

      <div className="mt-[28px] space-y-[24px]">
        <div className="rounded-[12px] border border-[#b6c8de] bg-[#f8fbff] p-[18px]">
          <div className="flex flex-wrap items-center gap-4 rounded-[12px] border border-[#d4dbe6] bg-white p-[10px]">
            <div className="flex h-[40px] w-[40px] items-center justify-center rounded-[8px] bg-[#f8fbff] text-[#104b83]">
              <Link2 className="h-[18px] w-[18px]" />
            </div>
            <input
              value={subdomain}
              onChange={(e) => onSubdomainChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="companydomain"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              style={inputTypographyStyle}
              className={`min-w-[180px] flex-1 border-0 bg-transparent py-[10px] ${inputTextClass} text-[#0f172a] outline-none`}
            />
            <span className="text-[20px] leading-none text-[#0b3a70]">.</span>
            <span className="text-[20px] font-semibold leading-none text-[#0b3a70]" style={interStyle}>
              {publicRootDomain || "brasshr.com"}
            </span>
          </div>
          <div className="mt-[14px] text-[16px] leading-[24px] text-[#0f172a]" style={interStyle}>
            Domain preview:&nbsp;
            <span className="font-semibold">{hostPreview ?? "abcccompany.brasshr.com"}</span>
          </div>
          {"failure" in validation && subdomain.length > 0 ? (
            <p className="mt-2 text-[13px] text-[#b91c1c]">{subdomainErrorMessage(validation.failure)}</p>
          ) : null}
        </div>
      </div>

      <StepActions
        onBack={onBack}
        onContinue={onContinue}
        continueLabel="Save and Continue"
        continueDisabled={!canContinue}
      />
    </div>
  );
}

export function WorkerOnboardingStep({
  steps,
  onStepsChange,
  onContinue,
  onBack,
}: {
  steps: OnboardingStepDraft[];
  onStepsChange: (steps: OnboardingStepDraft[]) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeading
        title="Worker onboarding flow"
        subtitle="Choose which steps applicants complete and which documents are required."
      />
      <div className="mt-[28px]">
        <OnboardingStepsBuilder steps={steps} onChange={onStepsChange} />
      </div>
      <StepActions onBack={onBack} onContinue={onContinue} />
    </div>
  );
}

function PreviewCard({ b }: { b: TenantBranding }) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-[#e2e8f0] bg-white shadow-sm">
      <div
        className="grid gap-6 p-8 md:grid-cols-[1fr_minmax(0,280px)]"
        style={{
          background: `linear-gradient(135deg, ${b.primaryHex}33 0%, ${b.secondaryHex}44 100%)`,
        }}
      >
        <div className="space-y-4 text-left">
          <h3 className="text-[24px] font-semibold text-[#0f172a]" style={interStyle}>
            {b.headline}
          </h3>
          <p className="text-[15px] text-[#64748b]" style={interStyle}>
            {b.subtitle}
          </p>
          <button
            type="button"
            style={{ backgroundColor: b.primaryHex }}
            className="rounded-[10px] px-6 py-3 text-[14px] font-semibold text-white"
          >
            Start application (preview)
          </button>
        </div>
        <div className="relative flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-[12px] border border-white/60 bg-white/80 p-4 text-center backdrop-blur">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.logoUrl} alt="" className="h-14 max-w-[200px] object-contain" />
          <p className="text-[12px] text-[#64748b]">{b.tagline}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
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

export function PreviewStep({
  preview,
  onContinue,
  onBack,
}: {
  preview: TenantBranding;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeading
        title="Applicant preview"
        subtitle="This is how your branding will look to applicants."
      />
      <div className="mt-[28px]">
        <PreviewCard b={preview} />
      </div>
      <StepActions onBack={onBack} onContinue={onContinue} continueLabel="Continue to admin" />
    </div>
  );
}

export function AdminStep({
  adminEmail,
  adminPassword,
  submitting,
  passwordOptional = false,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onBack,
}: {
  adminEmail: string;
  adminPassword: string;
  submitting: boolean;
  passwordOptional?: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const passwordOk = passwordOptional || adminPassword.length >= 6;
  const canSubmit = adminEmail.length >= 4 && passwordOk && !submitting;

  return (
    <div>
      <StepHeading
        title="First recruiting admin"
        subtitle="Create the recruiter account for your new organization."
      />
      <div className="mt-[28px] space-y-[24px]">
        <div>
          <FieldLabel>Admin email</FieldLabel>
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            style={inputTypographyStyle}
            className={`h-[56px] w-full rounded-[8px] border border-[#cbd5e1] bg-white px-[14px] ${inputTextClass} text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] ${inputFocusClass}`}
            required
          />
        </div>
        <div>
          <FieldLabel>
            {passwordOptional ? "New password (optional)" : "Password (min 6 chars)"}
          </FieldLabel>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
            style={inputTypographyStyle}
            className={`h-[56px] w-full rounded-[8px] border border-[#cbd5e1] bg-white px-[14px] ${inputTextClass} text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] ${inputFocusClass}`}
            required={!passwordOptional}
          />
        </div>
      </div>
      <StepActions
        onBack={onBack}
        onContinue={onSubmit}
        continueLabel={submitting ? "Saving..." : "Save tenant & invite admin"}
        continueDisabled={!canSubmit}
      />
    </div>
  );
}

export function DoneStep({
  preview,
  createdSlug,
  createdDomain,
  firmaProvisioning,
}: {
  preview: TenantBranding;
  createdSlug: string | null;
  createdDomain: string | null;
  firmaProvisioning?: {
    status: string;
    workspaceId?: string | null;
    message?: string | null;
  } | null;
}) {
  const headline = (() => {
    switch (firmaProvisioning?.status) {
      case "created":
        return "Tenant ready! Firma workspace created successfully.";
      case "already_configured":
        return "Tenant ready! Firma workspace is already configured.";
      case "failed":
        return "Tenant ready!";
      default:
        return "Tenant ready!";
    }
  })();

  const firmaMessage = (() => {
    switch (firmaProvisioning?.status) {
      case "failed":
        return (
          firmaProvisioning.message ??
          "Tenant ready, but Firma workspace creation failed. You can retry in Account Settings."
        );
      default:
        return null;
    }
  })();

  const firmaTone = firmaProvisioning?.status === "failed" ? "warning" : "success";

  return (
    <div className="text-center">
      <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--brand-primary)_15%,white)]">
        <Check className="h-[36px] w-[36px] text-[color:var(--brand-primary)]" strokeWidth={2.5} />
      </div>
      <h2 className="mt-[24px] text-[30px] font-semibold leading-[36px] text-[#0f172a]" style={interStyle}>
        {headline}
      </h2>
      <p className="mx-auto mt-[12px] max-w-lg text-[16px] leading-[24px] text-[#64748b]" style={interStyle}>
        Applicant portal:{" "}
        <span className="font-mono text-[#0f172a]">
          {createdDomain ? `https://${createdDomain}` : createdSlug ? `tenant “${createdSlug}”` : "—"}
        </span>
        . Sign in with the recruiter you created, then share your subdomain URL with applicants.
      </p>
      {firmaProvisioning?.workspaceId &&
      (firmaProvisioning.status === "created" || firmaProvisioning.status === "already_configured") ? (
        <p className="mx-auto mt-[12px] max-w-lg text-[14px] leading-[22px] text-[#64748b]" style={interStyle}>
          Firma workspace ID:{" "}
          <span className="font-mono text-[#0f172a]">{firmaProvisioning.workspaceId}</span>
        </p>
      ) : null}
      {firmaMessage ? (
        <div
          className={`mx-auto mt-[20px] max-w-lg rounded-[12px] border px-4 py-3 text-left text-[14px] leading-[22px] ${
            firmaTone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
          role="status"
        >
          <p>{firmaMessage}</p>
        </div>
      ) : null}
      <div className="mt-[32px] flex flex-wrap justify-center gap-3">
        <Link
          href="/admin_recruiter/dashboard"
          className="inline-flex h-[52px] min-w-[200px] items-center justify-center rounded-[12px] px-8 text-[15px] font-semibold text-white"
          style={primaryButtonStyle(true)}
        >
          Go to recruiter dashboard
        </Link>
        <Link
          href={withTenant(APPLICATION_ROUTES.addResume, createdSlug)}
          className="inline-flex h-[52px] min-w-[200px] items-center justify-center rounded-[12px] border border-[#e2e8f0] px-8 text-[15px] font-semibold text-[#0f172a]"
        >
          View applicant onboarding
        </Link>
      </div>
    </div>
  );
}

export { ErrorBanner };
