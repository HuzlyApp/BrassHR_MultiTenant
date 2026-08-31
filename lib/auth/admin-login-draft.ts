/** In-progress admin login state so legal pages can return without losing form data. */

export type AdminLoginDraft = {
  tenantSlug: string | null
  email: string
  password: string
  agree: boolean
  rememberMe: boolean
}

const STORAGE_KEY = "braasAdminLoginInProgress"

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined"
}

export function readAdminLoginDraft(tenantSlug: string | null): AdminLoginDraft | null {
  if (!canUseSessionStorage()) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AdminLoginDraft>
    if (!parsed || typeof parsed !== "object") return null

    const draftTenant = parsed.tenantSlug?.trim().toLowerCase() || null
    const currentTenant = tenantSlug?.trim().toLowerCase() || null
    if (draftTenant && currentTenant && draftTenant !== currentTenant) return null

    return {
      tenantSlug: draftTenant,
      email: String(parsed.email ?? ""),
      password: String(parsed.password ?? ""),
      agree: Boolean(parsed.agree),
      rememberMe: Boolean(parsed.rememberMe),
    }
  } catch {
    return null
  }
}

export function writeAdminLoginDraft(draft: AdminLoginDraft): void {
  if (!canUseSessionStorage()) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function clearAdminLoginDraft(): void {
  if (!canUseSessionStorage()) return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
