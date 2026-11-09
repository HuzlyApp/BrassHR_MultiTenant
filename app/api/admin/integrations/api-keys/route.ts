import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { createTenantApiKey, listTenantApiKeys } from "@/lib/integrations/api-keys";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const keys = await listTenantApiKeys(supabase, tenantId);
    return NextResponse.json({
      keys: keys.map((key) => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        scopes: key.scopes,
        lastUsedAt: key.lastUsedAt,
        revokedAt: key.revokedAt,
        createdAt: key.createdAt,
      })),
    });
  } catch (error) {
    console.error("[admin/integrations/api-keys GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list API keys" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const created = await createTenantApiKey(supabase, {
      tenantId,
      name,
      createdByUserId: auth.devBypass ? null : auth.userId,
    });

    void writeActivityLog({
      actorUserId: auth.devBypass ? null : auth.userId,
      action: "integrations.api_key.create",
      entityType: "tenant_api_key",
      entityId: created.id,
      tenantId,
      metadata: {
        name: created.name,
        key_prefix: created.keyPrefix,
      },
      request: req,
    });

    return NextResponse.json(
      {
        key: {
          id: created.id,
          name: created.name,
          keyPrefix: created.keyPrefix,
          scopes: created.scopes,
          createdAt: created.createdAt,
          apiKey: created.apiKey,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[admin/integrations/api-keys POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create API key" },
      { status: 500 }
    );
  }
}
