import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdFromUser } from "@/lib/auth/staff-tenant-scope";
import { VIEW_AS_TENANT_COOKIE } from "@/lib/tenant/constants";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Effective tenant for recruiter admin (matches effective-branding). */
export async function resolveEffectiveAdminTenantId(
  supabase: SupabaseClient,
  params: { userId: string; authUser: User; godAdmin: boolean }
): Promise<string | null> {
  if (params.godAdmin) {
    const cookieId = (await cookies()).get(VIEW_AS_TENANT_COOKIE)?.value?.trim() ?? "";
    if (cookieId && UUID_RE.test(cookieId)) {
      return cookieId.toLowerCase();
    }
    return null;
  }

  const fromJwt = tenantIdFromUser(params.authUser);
  if (fromJwt) return fromJwt;

  const { data } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", params.userId)
    .maybeSingle<{ tenant_id: string | null }>();

  if (data?.tenant_id && UUID_RE.test(data.tenant_id)) {
    return String(data.tenant_id).toLowerCase();
  }
  return null;
}
