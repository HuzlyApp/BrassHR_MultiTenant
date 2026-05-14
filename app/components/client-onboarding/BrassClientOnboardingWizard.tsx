"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Coins,
  Monitor,
  PieChart,
  Sparkles,
  Timer,
  UserPlus,
} from "lucide-react";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars, defaultTenantBranding } from "@/lib/tenant/tenant-branding";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";

const brassGold = "#bc8b41";
const brassLight = "#e9b771";
const brassNavy = "#012352";
const labelColor = "#374151";
const captionColor = "#6b7280";
const borderField = "#cbd5e1";
const borderGrey = "#e5e7eb";
const brandLiteBg = "#ecf1f9";

const STEP_LABELS = ["Select Goals", "Business Information", "Customize Branding", "Setting up Brass Domain"] as const;

const GOAL_OPTIONS = [
  { id: "hr-data", label: "HR Data & Reporting", Icon: PieChart },
  { id: "time", label: "Time & Attendance", Icon: Timer },
  { id: "hiring", label: "Hiring & Onboarding", Icon: UserPlus },
  { id: "performance", label: "Performance Management", Icon: Monitor },
  { id: "comp", label: "Compensation Planning", Icon: Coins },
  { id: "ai", label: "AI Powered HR", Icon: Sparkles },
] as const;

type WizardStep = 0 | 1 | 2 | 3;

function BrassLogoHeader() {
  return (
    <div className="flex flex-col items-center pb-5">
      <div className="flex flex-col items-center">
        <span className="text-[26px] font-bold lowercase leading-none tracking-tight" style={{ color: brassGold }}>
          brass
        </span>
        <svg className="mt-1 h-[6px] w-[72px]" viewBox="0 0 72 6" fill="none" aria-hidden>
          <path
            d="M0 3C6 0 12 6 18 3C24 0 30 6 36 3C42 0 48 6 54 3C60 0 66 6 72 3"
            stroke={brassGold}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: brassNavy }}>
          HR simplified
        </span>
      </div>
    </div>
  );
}

function OnboardingStepper({ current }: { current: WizardStep }) {
  const n = STEP_LABELS.length;

  return (
    <div className="w-full py-5">
      <div className="flex w-full items-start">
        {STEP_LABELS.map((label, i) => {
          const done = current > i;
          const active = current === i;
          /** Segment to the right of node i (connects i → i+1) is brass while user is on or past step i. */
          const segmentRightGold = i < n - 1 && current >= i;

          return (
            <div key={label} className="flex min-w-0 flex-1 flex-col items-center gap-3">
              <div className="flex w-full items-center">
                <div className="h-4 min-w-0 flex-1">
                  {i > 0 ? (
                    <div className="flex h-4 items-center">
                      <div
                        className="h-0.5 w-full"
                        style={{ backgroundColor: current >= i - 1 ? brassGold : "#ecf1f9" }}
                      />
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}
                </div>
                <div
                  className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: done || active ? brassGold : "#e2e8f0",
                    backgroundColor: done ? brassGold : active ? "#fff8eb" : "white",
                  }}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} /> : null}
                  {active && !done ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: brassGold }} /> : null}
                </div>
                <div className="h-4 min-w-0 flex-1">
                  {i < n - 1 ? (
                    <div className="flex h-4 items-center">
                      <div
                        className="h-0.5 w-full"
                        style={{ backgroundColor: segmentRightGold ? brassGold : "#ecf1f9" }}
                      />
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}
                </div>
              </div>
              <p
                className={`max-w-[100px] text-center text-xs leading-4 ${
                  done || active ? "font-normal" : "text-slate-400"
                }`}
                style={{ color: done || active ? brassNavy : undefined }}
              >
                {i === 3 ? (
                  <>
                    Setting up
                    <br />
                    Brass Domain
                  </>
                ) : i === 1 ? (
                  <>
                    Business
                    <br />
                    Information
                  </>
                ) : i === 2 ? (
                  <>
                    Customize
                    <br />
                    Branding
                  </>
                ) : (
                  STEP_LABELS[i]
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrimaryButton({ children, className = "", ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={`flex w-full items-center justify-center rounded-xl bg-gradient-to-r px-5 py-4 text-base font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{
        backgroundImage: `linear-gradient(90deg, ${brassGold}, ${brassLight})`,
        boxShadow: "0 10px 24px rgba(188, 139, 65, 0.28)",
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function OutlineNavButton({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-center rounded-xl border-2 bg-white px-5 py-4 text-base font-semibold transition hover:bg-slate-50"
      style={{ borderColor: brassNavy, color: brassNavy }}
      {...props}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <span className="text-sm" style={{ color: labelColor }}>
      {children}
      {required ? <span className="text-rose-600"> *</span> : null}
    </span>
  );
}

function TextInput(props: React.ComponentProps<"input">) {
  return (
    <input
      className="h-14 w-full rounded-lg border bg-white px-3.5 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-300"
      style={{ borderColor: borderField }}
      {...props}
    />
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        className="h-14 w-full cursor-pointer appearance-none rounded-lg border bg-white px-3.5 pr-10 text-base text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
        style={{ borderColor: borderField }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden />
    </div>
  );
}

function PreviewCard({ b }: { b: TenantBranding }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md">
      <div
        className="grid gap-6 p-6 md:grid-cols-[1fr_minmax(0,240px)]"
        style={{
          background: `linear-gradient(135deg, ${b.primaryHex}22 0%, ${b.secondaryHex}33 100%)`,
        }}
      >
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-slate-900">{b.headline}</h3>
          <p className="text-sm text-slate-600">{b.subtitle}</p>
          <span className="inline-block rounded-lg px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: b.primaryHex }}>
            Start application (preview)
          </span>
        </div>
        <div className="relative flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-white/70 bg-white/90 p-3 text-center">
          <img src={b.logoUrl} alt="" className="h-12 max-w-[180px] object-contain" />
          <p className="text-xs text-slate-600">{b.tagline}</p>
        </div>
      </div>
    </div>
  );
}

export default function BrassClientOnboardingWizard() {
  const shell = defaultTenantBranding();
  const [step, setStep] = useState<WizardStep>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [goals, setGoals] = useState<Set<string>>(() => new Set());

  const [orgName, setOrgName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessType, setBusinessType] = useState("Staffing");
  const [employeeRange, setEmployeeRange] = useState("10-30");
  const [city, setCity] = useState("Los Angeles");
  const [stateVal, setStateVal] = useState("California");
  const [zip, setZip] = useState("");
  const [ein, setEin] = useState("");

  const [logoUrl, setLogoUrl] = useState("");
  const [primaryHex, setPrimaryHex] = useState(shell.primaryHex);
  const [secondaryHex, setSecondaryHex] = useState(shell.secondaryHex);
  const [accentHex, setAccentHex] = useState(shell.accentHex);
  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");

  const [slug, setSlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [flowComplete, setFlowComplete] = useState(false);

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

  const toggleGoal = (id: string) => {
    setGoals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canContinueGoals = goals.size >= 1;
  const canContinueBusiness = orgName.trim().length >= 2 && zip.trim().length >= 3;
  const canContinueBranding = true;
  const canSubmit =
    adminEmail.includes("@") && adminPassword.length >= 6 && orgName.trim().length >= 2;

  const finalize = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const slugBody =
        slug.trim().length > 2
          ? slug
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, "-")
          : undefined;
      const res = await fetch("/api/tenant-onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: orgName.trim(),
          slug: slugBody,
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
      const payload = (await res.json().catch(() => ({}))) as { error?: string; slug?: string };
      if (!res.ok) {
        setError(payload.error ?? "Something went wrong");
        setSubmitting(false);
        return;
      }
      setCreatedSlug(String(payload.slug ?? "").trim());
      document.cookie = `${ONBOARDING_TENANT_SLUG_COOKIE}=${encodeURIComponent(payload.slug ?? "")}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      setFlowComplete(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  const done = flowComplete && createdSlug !== null;

  return (
    <TenantBrandingProvider branding={shell}>
      <main className="min-h-screen bg-slate-100 px-4 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-[720px] rounded-[28px] bg-white p-8 shadow-xl sm:p-12 sm:px-14">
          <nav className="mb-8 flex flex-wrap justify-center gap-4 text-sm" style={{ color: captionColor }}>
            <Link href="/" className="font-semibold hover:underline" style={{ color: brassNavy }}>
              Home
            </Link>
            <Link href="/login" className="hover:underline" style={{ color: brassNavy }}>
              Recruiter sign in
            </Link>
          </nav>

          <BrassLogoHeader />

          {!done ? (
            <>
              <div className="mb-2 text-center">
                <h1
                  className="bg-clip-text text-2xl font-semibold text-transparent sm:text-2xl"
                  style={{
                    backgroundImage: `linear-gradient(90deg, ${brassGold} 0%, ${brassLight} 100%)`,
                  }}
                >
                  Welcome to BrassHR!
                </h1>
                <p className="mt-2 text-lg font-semibold leading-7 text-black">Get started by following these 4 easy steps.</p>
              </div>

              <OnboardingStepper current={step} />

              {error ? (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
              ) : null}

              {step === 0 ? (
                <div className="space-y-5 px-1">
                  <div>
                    <h2 className="text-3xl font-semibold leading-9 text-black">What brings you to brassHR</h2>
                    <p className="mt-2 text-base leading-6" style={{ color: captionColor }}>
                      Choose what matters most to you, and we&apos;ll make sure to help you hit your goals.
                    </p>
                  </div>
                  <div className="grid gap-5">
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="grid gap-5 sm:grid-cols-2">
                        {GOAL_OPTIONS.slice(row * 2, row * 2 + 2).map(({ id, label, Icon }) => {
                          const selected = goals.has(id);
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => toggleGoal(id)}
                              className="flex w-full items-center gap-5 rounded-lg border bg-white p-4 text-left transition hover:border-slate-300"
                              style={{
                                borderColor: selected ? brassGold : borderGrey,
                                boxShadow: selected ? "0 0 0 1px rgba(188,139,65,0.35)" : undefined,
                              }}
                            >
                              <div
                                className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-lg p-2"
                                style={{ backgroundColor: brandLiteBg, color: brassNavy }}
                              >
                                <Icon className="h-6 w-6" strokeWidth={1.75} />
                              </div>
                              <span className="min-w-0 flex-1 text-sm font-normal leading-5" style={{ color: brassNavy }}>
                                {label}
                              </span>
                              <span
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border"
                                style={{
                                  borderColor: selected ? brassGold : "#95929e",
                                  backgroundColor: selected ? brassGold : "white",
                                }}
                                aria-hidden
                              >
                                {selected ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <PrimaryButton disabled={!canContinueGoals} onClick={() => setStep(1)}>
                    Continue
                  </PrimaryButton>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-8 px-1">
                  <div>
                    <h2 className="text-3xl font-semibold leading-9 text-black">Business Information</h2>
                    <p className="mt-2 text-base leading-6" style={{ color: captionColor }}>
                      Add your business info
                    </p>
                  </div>
                  <div className="space-y-8">
                    <label className="block space-y-2">
                      <FieldLabel required>Company Name</FieldLabel>
                      <TextInput value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="ABC Company" />
                    </label>
                    <label className="block space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <FieldLabel>Business Address</FieldLabel>
                        <span className="text-[10px] leading-[15px]" style={{ color: captionColor }}>
                          Building, Floor, etc...
                        </span>
                      </div>
                      <TextInput
                        value={businessAddress}
                        onChange={(e) => setBusinessAddress(e.target.value)}
                        placeholder="123 Maple Street, Springfield, IL 62704, USA"
                      />
                    </label>
                    <div className="grid gap-8 sm:grid-cols-2">
                      <label className="block space-y-2">
                        <FieldLabel required>Business Type</FieldLabel>
                        <SelectField
                          value={businessType}
                          onChange={setBusinessType}
                          options={[
                            { value: "Staffing", label: "Staffing" },
                            { value: "Healthcare", label: "Healthcare" },
                            { value: "Other", label: "Other" },
                          ]}
                        />
                      </label>
                      <label className="block space-y-2">
                        <FieldLabel>Number of Employees</FieldLabel>
                        <SelectField
                          value={employeeRange}
                          onChange={setEmployeeRange}
                          options={["1-9", "10-30", "31-100", "100+"].map((v) => ({ value: v, label: v }))}
                        />
                      </label>
                    </div>
                    <div className="grid gap-8 sm:grid-cols-2">
                      <label className="block space-y-2">
                        <FieldLabel required>City</FieldLabel>
                        <SelectField
                          value={city}
                          onChange={setCity}
                          options={["Los Angeles", "San Diego", "San Francisco", "Sacramento", "Phoenix", "Dallas", "Houston"].map((v) => ({
                            value: v,
                            label: v,
                          }))}
                        />
                      </label>
                      <label className="block space-y-2">
                        <FieldLabel required>State</FieldLabel>
                        <SelectField
                          value={stateVal}
                          onChange={setStateVal}
                          options={["California", "Arizona", "Texas", "New York", "Florida", "Illinois"].map((v) => ({
                            value: v,
                            label: v,
                          }))}
                        />
                      </label>
                    </div>
                    <div className="grid gap-8 sm:grid-cols-2">
                      <label className="block space-y-2">
                        <FieldLabel required>Zip Code</FieldLabel>
                        <TextInput value={zip} onChange={(e) => setZip(e.target.value)} placeholder="40170" inputMode="numeric" />
                      </label>
                      <label className="block space-y-2">
                        <FieldLabel>EIN Number</FieldLabel>
                        <TextInput value={ein} onChange={(e) => setEin(e.target.value)} placeholder="902231829" />
                      </label>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <OutlineNavButton onClick={() => setStep(0)}>Back</OutlineNavButton>
                      <PrimaryButton disabled={!canContinueBusiness} onClick={() => setStep(2)}>
                        Save and Continue
                      </PrimaryButton>
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-6 px-1">
                  <div>
                    <h2 className="text-3xl font-semibold leading-9 text-black">Customize Branding</h2>
                    <p className="mt-2 text-base leading-6" style={{ color: captionColor }}>
                      Logo, colors, and applicant-facing welcome copy.
                    </p>
                  </div>
                  <label className="block space-y-2">
                    <FieldLabel>Logo URL</FieldLabel>
                    <TextInput value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="/images/logo.svg or https://…" />
                  </label>
                  <div className="grid gap-6 sm:grid-cols-3">
                    <label className="flex flex-col gap-2 text-sm font-medium" style={{ color: labelColor }}>
                      Primary
                      <input type="color" value={primaryHex} onChange={(e) => setPrimaryHex(e.target.value)} className="h-12 w-full cursor-pointer rounded-lg border" style={{ borderColor: borderField }} />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium" style={{ color: labelColor }}>
                      Secondary
                      <input type="color" value={secondaryHex} onChange={(e) => setSecondaryHex(e.target.value)} className="h-12 w-full cursor-pointer rounded-lg border" style={{ borderColor: borderField }} />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium" style={{ color: labelColor }}>
                      Accent
                      <input type="color" value={accentHex} onChange={(e) => setAccentHex(e.target.value)} className="h-12 w-full cursor-pointer rounded-lg border" style={{ borderColor: borderField }} />
                    </label>
                  </div>
                  <label className="block space-y-2">
                    <FieldLabel>Welcome headline</FieldLabel>
                    <TextInput value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Welcome to your team" />
                  </label>
                  <label className="block space-y-2">
                    <FieldLabel>Subtitle</FieldLabel>
                    <TextInput value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Short tagline for applicants" />
                  </label>
                  <label className="block space-y-2">
                    <FieldLabel>Auth background URL (optional)</FieldLabel>
                    <TextInput value={backgroundUrl} onChange={(e) => setBackgroundUrl(e.target.value)} placeholder="/images/handshake.jpg" />
                  </label>
                  <TenantBrandingProvider branding={preview}>
                    <PreviewCard b={preview} />
                  </TenantBrandingProvider>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <OutlineNavButton onClick={() => setStep(1)}>Back</OutlineNavButton>
                    <PrimaryButton disabled={!canContinueBranding} onClick={() => setStep(3)}>
                      Save and Continue
                    </PrimaryButton>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-6 px-1">
                  <div>
                    <h2 className="text-3xl font-semibold leading-9 text-black">Setting up Brass Domain</h2>
                    <p className="mt-2 text-base leading-6" style={{ color: captionColor }}>
                      Choose a URL slug and create your first recruiting admin.
                    </p>
                  </div>
                  <label className="block space-y-2">
                    <FieldLabel>URL slug (optional)</FieldLabel>
                    <TextInput value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-staff" />
                  </label>
                  <label className="block space-y-2">
                    <FieldLabel required>Admin email</FieldLabel>
                    <TextInput type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} autoComplete="email" />
                  </label>
                  <label className="block space-y-2">
                    <FieldLabel required>Password (min 6 characters)</FieldLabel>
                    <TextInput type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} autoComplete="new-password" />
                  </label>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <OutlineNavButton onClick={() => setStep(2)}>Back</OutlineNavButton>
                    <PrimaryButton disabled={!canSubmit || submitting} onClick={() => void finalize()}>
                      {submitting ? "Saving…" : "Complete setup"}
                    </PrimaryButton>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-6 px-1 text-center">
              <h1
                className="bg-clip-text text-3xl font-semibold text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${brassGold}, ${brassLight})` }}
              >
                Tenant ready!
              </h1>
              <p className="text-base" style={{ color: captionColor }}>
                Tenant slug:&nbsp;<span className="font-mono font-semibold text-slate-900">{createdSlug ?? "—"}</span>
              </p>
              <p className="text-sm" style={{ color: captionColor }}>
                Sign in with the recruiter you created, then open the applicant onboarding link anytime.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl px-8 py-3 text-sm font-semibold text-white"
                  style={{ backgroundImage: `linear-gradient(90deg, ${brassGold}, ${brassLight})` }}
                >
                  Go to recruiter login
                </Link>
                <Link
                  href="/application/step-1-upload"
                  className="inline-flex items-center justify-center rounded-xl border-2 px-8 py-3 text-sm font-semibold"
                  style={{ borderColor: brassNavy, color: brassNavy }}
                >
                  View applicant onboarding
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </TenantBrandingProvider>
  );
}
