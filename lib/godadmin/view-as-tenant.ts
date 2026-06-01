import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { tenantStatusFromIsActive } from "@/lib/godadmin/tenant-account-status";
import { VIEW_AS_TENANT_COOKIE } from "@/lib/tenant/constants";

export const TENANT_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const VIEW_AS_TENANT_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export type ViewAsTenantTarget = {
  id: string;
  name: string;
  slug: string;
};

export function normalizeTenantId(raw: string | null | undefined): string | null {
  const s = raw?.trim().toLowerCase() ?? "";
  return TENANT_ID_UUID_RE.test(s) ? s : null;
}

/** God Admin may only impersonate an existing, active tenant. */
export async function resolveViewAsTenantTarget(
  tenantId: string
): Promise<{ ok: true; tenant: ViewAsTenantTarget } | { ok: false; status: number; error: string }> {
  const id = normalizeTenantId(tenantId);
  if (!id) {
    return { ok: false, status: 400, error: "Invalid tenant id" };
  }

  const sb = createServiceRoleClient();
  if (!sb) {
    return { ok: false, status: 503, error: "Supabase not configured" };
  }

  const { data, error } = await sb
    .from("tenants")
    .select("id, name, slug, is_active")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: "Failed to load tenant" };
  }
  if (!data?.id) {
    return { ok: false, status: 404, error: "Tenant not found" };
  }

  const status = tenantStatusFromIsActive(data.is_active as boolean | null | undefined);
  if (status !== "active") {
    return {
      ok: false,
      status: 403,
      error: "Only active tenants can be viewed. Reactivate the tenant first.",
    };
  }

  return {
    ok: true,
    tenant: {
      id: String(data.id),
      name: String(data.name ?? ""),
      slug: String(data.slug ?? ""),
    },
  };
}

/** Active tenant id from view-as cookie, or null if missing / invalid / deactivated. */
export async function readValidatedViewAsTenantId(): Promise<string | null> {
  const jar = await cookies();
  const raw = normalizeTenantId(jar.get(VIEW_AS_TENANT_COOKIE)?.value);
  if (!raw) return null;
  const resolved = await resolveViewAsTenantTarget(raw);
  return resolved.ok ? resolved.tenant.id : null;
}
