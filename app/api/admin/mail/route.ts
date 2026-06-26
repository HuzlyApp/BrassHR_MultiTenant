import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { listTenantMailInbox } from "@/lib/communication/list-tenant-mail-inbox";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { getResendFromDomainForUi } from "@/lib/email/from-address";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/** GET — tenant-wide email inbox summary for admin recruiter mail screen. */
export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });

  if (!tenantId) {
    return NextResponse.json(
      {
        error: "No tenant selected",
        code: "TENANT_REQUIRED",
      },
      { status: 400 }
    );
  }

  const items = await listTenantMailInbox(supabase, tenantId);
  const resendFromDomain = getResendFromDomainForUi();

  return NextResponse.json({
    tenantId,
    emailConfigured: Boolean(resendFromDomain?.trim()),
    resendFromDomain,
    items,
  });
}
