import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { authorizeStaffHttpAccess } from "@/lib/auth/module-access.server";
import { isGodAdminUser } from "@/lib/auth/god-admin";

export async function authorizeTenantSetup(tenantId: string, resourcePath: string) {
  const { data, error } = await (await createClient()).auth.getUser();
  if (error || !data.user || data.user.is_anonymous) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceRoleClient();
  if (!svc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const { data: profile } = await svc.from("users").select("god_admin").eq("id", data.user.id).maybeSingle();
  const scoped = await resolveEffectiveAdminTenantId(svc, { userId: data.user.id, authUser: data.user, godAdmin: isGodAdminUser(data.user) || profile?.god_admin === true });
  if (!scoped || scoped !== tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const decision = await authorizeStaffHttpAccess({ user: data.user, pathname: resourcePath, method: "POST" });
  return decision.ok ? null : NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
