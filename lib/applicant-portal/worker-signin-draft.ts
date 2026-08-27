import type { ApplicantSignInMode } from "@/lib/applicant-portal/use-applicant-sign-in"

/** In-progress worker sign-in state so legal pages can return without losing form data. */

export type WorkerSignInDraft = {
  tenantSlug: string | null
  email: string
  password: string
  confirmPassword: string
  mode: ApplicantSignInMode
  agree: boolean
  rememberMe: boolean
}

const STORAGE_KEY = "braasWorkerSignInInProgress"

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined"
}

export function readWorkerSignInDraft(tenantSlug: string | null): WorkerSignInDraft | null {
  if (!canUseSessionStorage()) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WorkerSignInDraft>
    if (!parsed || typeof parsed !== "object") return null

    const draftTenant = parsed.tenantSlug?.trim().toLowerCase() || null
    const currentTenant = tenantSlug?.trim().toLowerCase() || null
    if (draftTenant && currentTenant && draftTenant !== currentTenant) return null

    const mode =
      parsed.mode === "password" || parsed.mode === "setup" || parsed.mode === "email"
        ? parsed.mode
        : "email"

    return {
      tenantSlug: draftTenant,
      email: String(parsed.email ?? ""),
      password: String(parsed.password ?? ""),
      confirmPassword: String(parsed.confirmPassword ?? ""),
      mode,
      agree: Boolean(parsed.agree),
      rememberMe: Boolean(parsed.rememberMe),
    }
  } catch {
    return null
  }
}

export function writeWorkerSignInDraft(draft: WorkerSignInDraft): void {
  if (!canUseSessionStorage()) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function clearWorkerSignInDraft(): void {
  if (!canUseSessionStorage()) return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
