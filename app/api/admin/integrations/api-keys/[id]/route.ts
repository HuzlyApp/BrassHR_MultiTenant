import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { revokeTenantApiKey } from "@/lib/integrations/api-keys";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { API_KEY_RESPONSE_HEADERS, rejectCrossOriginKeyMutation } from "@/lib/integrations/management-security";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = rejectCrossOriginKeyMutation(req);
  if (forbidden) return forbidden;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { id } = await context.params;
  const keyId = String(id ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(keyId)) {
    return NextResponse.json({ error: "A valid API key id is required" }, { status: 400 });
  }

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const revoked = await revokeTenantApiKey(supabase, { tenantId, keyId });
    if (!revoked) {
      return NextResponse.json({ error: "API key not found or already revoked" }, { status: 404 });
    }

    void writeActivityLog({
      actorUserId: auth.devBypass ? null : auth.userId,
      action: "integrations.api_key.revoke",
      entityType: "tenant_api_key",
      entityId: revoked.id,
      tenantId,
      metadata: {
        name: revoked.name,
        key_prefix: revoked.keyPrefix,
      },
      request: req,
    });

    return NextResponse.json({
      key: {
        id: revoked.id,
        name: revoked.name,
        keyPrefix: revoked.keyPrefix,
        revokedAt: revoked.revokedAt,
      },
    }, { headers: API_KEY_RESPONSE_HEADERS });
  } catch (error) {
    console.error("[admin/integrations/api-keys DELETE]", error);
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
