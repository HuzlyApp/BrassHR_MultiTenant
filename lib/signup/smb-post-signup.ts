import type { OwnerSignupPayload } from "@/lib/signup/owner-signup";
import { tenantCategoryFromStaffingFlag } from "@/lib/signup/owner-signup";
import { validateTenantSubdomainInput } from "@/lib/tenant/subdomain-validation";

/** Post-signup landing for both editions (inside the admin shell). */
export const ADMIN_LAUNCH_PAD_ROUTE = "/admin_recruiter/launch-pad";
export const OWNER_WORKSPACE_PREPARATION_ROUTE = "/signup/prepare-workspace";

/** True when the owner chose “No” for staffing (SMB edition). */
export function isSmbOwnerSignup(
  payload: Pick<OwnerSignupPayload, "isStaffingCompany"> | { isStaffingCompany?: boolean | null }
): boolean {
  return payload.isStaffingCompany === false;
}

export function isSmbTenantCategory(value: unknown): boolean {
  return String(value ?? "")
    .trim()
    .toLowerCase() === "smb";
}

/** Build a DNS-safe subdomain candidate from a company name. */
export function subdomainCandidateFromCompanyName(companyName: string): string {
  const base = companyName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const padded = base.length >= 3 ? base : `org-${base || "smb"}`.slice(0, 48);
  const parsed = validateTenantSubdomainInput(padded);
  if ("subdomain" in parsed) return parsed.subdomain;
  return `smb-${Date.now().toString(36)}`.slice(0, 63);
}

export function withSubdomainSuffix(base: string, attempt: number): string {
  if (attempt <= 0) return base;
  const suffix = `-${attempt + 1}`;
  const trimmed = base.slice(0, Math.max(3, 63 - suffix.length));
  const candidate = `${trimmed.replace(/-+$/g, "")}${suffix}`;
  const parsed = validateTenantSubdomainInput(candidate);
  if ("subdomain" in parsed) return parsed.subdomain;
  return `smb${Date.now().toString(36)}`.slice(0, 63);
}

export function smbCategoryLabel(
  payload: Pick<OwnerSignupPayload, "isStaffingCompany">
): "SMB" | "Staffing" {
  return tenantCategoryFromStaffingFlag(payload.isStaffingCompany);
}
