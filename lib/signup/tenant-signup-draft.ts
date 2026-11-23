/** In-progress tenant signup state so legal pages can return without losing form data. */

export type TenantSignupDraftStep = "personal" | "company" | "details" | "password";

export type TenantSignupDraftForm = {
  firstName: string;
  lastName: string;
  workEmail: string;
  phone: string;
  companyName: string;
  companyWebsite: string;
  industry: string;
  industries: string[];
  isStaffingCompany: boolean | null;
  city: string;
  state: string;
  /** Legacy fields kept for draft compatibility / API mapping. */
  jobTitle: string;
  zipCode: string;
  address1: string;
  address2: string;
  hqState: string;
  primaryCity: string;
  primaryState: string;
};

export type TenantSignupDraft = {
  form: TenantSignupDraftForm;
  step: TenantSignupDraftStep;
  password: string;
  verifyPassword: string;
  termsAccepted: boolean;
};

const STORAGE_KEY = "braasTenantSignupInProgress";

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function normalizeStep(step: unknown): TenantSignupDraftStep {
  if (step === "company") return "company";
  if (step === "password" || step === "details") return "personal";
  return "personal";
}

export function readTenantSignupDraft(): TenantSignupDraft | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TenantSignupDraft>;
    if (!parsed || typeof parsed !== "object" || !parsed.form) return null;
    const staffing = parsed.form.isStaffingCompany;
    const industry = String(parsed.form.industry ?? "");
    const industriesRaw = Array.isArray((parsed.form as { industries?: unknown }).industries)
      ? ((parsed.form as { industries: unknown[] }).industries)
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
      : [];
    const industries =
      industriesRaw.length > 0 ? industriesRaw : industry.trim() ? [industry.trim()] : [];
    return {
      form: {
        firstName: String(parsed.form.firstName ?? ""),
        lastName: String(parsed.form.lastName ?? ""),
        workEmail: String(parsed.form.workEmail ?? ""),
        phone: String(parsed.form.phone ?? ""),
        companyName: String(parsed.form.companyName ?? ""),
        companyWebsite: String(parsed.form.companyWebsite ?? ""),
        industry: industries[0] ?? industry,
        industries,
        isStaffingCompany: staffing === true ? true : staffing === false ? false : null,
        city: String(parsed.form.city ?? ""),
        state: String(parsed.form.state ?? ""),
        jobTitle: String(parsed.form.jobTitle ?? ""),
        zipCode: String(parsed.form.zipCode ?? ""),
        address1: String(parsed.form.address1 ?? ""),
        address2: String(parsed.form.address2 ?? ""),
        hqState: String(parsed.form.hqState ?? ""),
        primaryCity: String(parsed.form.primaryCity ?? ""),
        primaryState: String(parsed.form.primaryState ?? ""),
      },
      step: normalizeStep(parsed.step),
      password: String(parsed.password ?? ""),
      verifyPassword: String(parsed.verifyPassword ?? ""),
      termsAccepted: Boolean(parsed.termsAccepted),
    };
  } catch {
    return null;
  }
}

export function writeTenantSignupDraft(draft: TenantSignupDraft): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function clearTenantSignupDraft(): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Build a legal doc URL that returns to a safe in-app path. */
export function legalReturnHref(legalPath: string, returnTo: string): string {
  const safeReturn = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/signup";
  const [pathname, query = ""] = legalPath.split("?");
  const params = new URLSearchParams(query);
  params.set("returnTo", safeReturn);
  return `${pathname}?${params.toString()}`;
}
