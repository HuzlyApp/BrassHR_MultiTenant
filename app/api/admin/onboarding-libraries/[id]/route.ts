import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { requireWorkflowAdmin } from "@/lib/auth/workflow-admin";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import { LibraryManagementError, manageOnboardingLibrary } from "@/lib/onboarding/onboarding-libraries";
type Context = { params: Promise<{ id: string }> };
async function mutate(req: NextRequest, context: Context, remove: boolean) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  try {
    const tenantId = await resolveEffectiveAdminTenantId(supabase, { userId: auth.userId, authUser: auth.authUser, godAdmin: auth.godAdmin });
    if (!tenantId) return NextResponse.json({ error: "Select a tenant first." }, { status: 400 });
    const id = parseRequiredUuid((await context.params).id, "folder id");
    if (!id.ok) return NextResponse.json({ error: id.error }, { status: 400 });
    const body = remove ? null : await req.json().catch(() => null);
    if (!remove && typeof body?.name !== "string") return NextResponse.json({ error: "Folder name is required." }, { status: 400 });
    await manageOnboardingLibrary(supabase, tenantId, id.value, remove ? { delete: true } : { name: body.name });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof LibraryManagementError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[onboarding-libraries mutation]", error);
    return NextResponse.json({ error: "Could not update workflow folder." }, { status: 500 });
  }
}
export const PATCH = (req: NextRequest, context: Context) => mutate(req, context, false);
export const DELETE = (req: NextRequest, context: Context) => mutate(req, context, true);
