/** In-progress tenant signup state so legal pages can return without losing form data. */

export type TenantSignupDraftStep = "details" | "password"

export type TenantSignupDraftForm = {
  firstName: string
  lastName: string
  workEmail: string
  jobTitle: string
  city: string
  state: string
  zipCode: string
  address1: string
  address2: string
}

export type TenantSignupDraft = {
  form: TenantSignupDraftForm
  step: TenantSignupDraftStep
  password: string
  verifyPassword: string
  termsAccepted: boolean
}

const STORAGE_KEY = "braasTenantSignupInProgress"

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined"
}

export function readTenantSignupDraft(): TenantSignupDraft | null {
  if (!canUseSessionStorage()) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TenantSignupDraft>
    if (!parsed || typeof parsed !== "object" || !parsed.form) return null
    return {
      form: {
        firstName: String(parsed.form.firstName ?? ""),
        lastName: String(parsed.form.lastName ?? ""),
        workEmail: String(parsed.form.workEmail ?? ""),
        jobTitle: String(parsed.form.jobTitle ?? ""),
        city: String(parsed.form.city ?? ""),
        state: String(parsed.form.state ?? ""),
        zipCode: String(parsed.form.zipCode ?? ""),
        address1: String(parsed.form.address1 ?? ""),
        address2: String(parsed.form.address2 ?? ""),
      },
      step: parsed.step === "password" ? "password" : "details",
      password: String(parsed.password ?? ""),
      verifyPassword: String(parsed.verifyPassword ?? ""),
      termsAccepted: Boolean(parsed.termsAccepted),
    }
  } catch {
    return null
  }
}

export function writeTenantSignupDraft(draft: TenantSignupDraft): void {
  if (!canUseSessionStorage()) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function clearTenantSignupDraft(): void {
  if (!canUseSessionStorage()) return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Build a legal doc URL that returns to a safe in-app path. */
export function legalReturnHref(legalPath: string, returnTo: string): string {
  const safeReturn = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/signup"
  const [pathname, query = ""] = legalPath.split("?")
  const params = new URLSearchParams(query)
  params.set("returnTo", safeReturn)
  return `${pathname}?${params.toString()}`
}
