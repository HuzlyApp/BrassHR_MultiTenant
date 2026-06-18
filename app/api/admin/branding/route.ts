import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { TenantBrandingRow } from "@/lib/tenant/tenant-branding";
import { brandingFromTenantRow, defaultTenantBranding } from "@/lib/tenant/tenant-branding";
import {
  buildTenantBrandingUpdate,
  invalidateTenantBrandingCache,
  TENANT_BRANDING_SELECT,
  type TenantBrandingUpdateInput,
} from "@/lib/tenant/branding-fields";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";

async function loadTenantRow(tenantId: string): Promise<TenantBrandingRow | null> {
  const sb = createServiceRoleClient();
  if (!sb) return null;
  const { data } = await sb
    .from("tenants")
    .select(TENANT_BRANDING_SELECT)
    .eq("id", tenantId)
    .maybeSingle<TenantBrandingRow>();
  return data ?? null;
}

function viewerPayload(auth: { godAdmin: boolean }, tenantId: string | null, tenantName: string | null) {
  return {
    godAdmin: auth.godAdmin,
    scoped: Boolean(tenantId),
    tenantId,
    tenantName,
  };
}

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });

  if (!tenantId) {
    return Response.json({
      branding: defaultTenantBranding(),
      tenantId: null,
      viewer: viewerPayload(auth, null, null),
    });
  }

  const row = await loadTenantRow(tenantId);
  return Response.json({
    branding: brandingFromTenantRow(row),
    tenantId,
    viewer: viewerPayload(auth, tenantId, row?.name ?? null),
  });
}

export async function PUT(req: Request) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });

  if (!tenantId) {
    return NextResponse.json({ error: "No organization selected. Switch tenant and try again." }, { status: 400 });
  }

  let body: TenantBrandingUpdateInput;
  try {
    body = (await req.json()) as TenantBrandingUpdateInput;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  let patch: ReturnType<typeof buildTenantBrandingUpdate>;
  try {
    patch = buildTenantBrandingUpdate(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid branding values.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No branding fields to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tenants")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", tenantId)
    .select(TENANT_BRANDING_SELECT)
    .maybeSingle<TenantBrandingRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await invalidateTenantBrandingCache(tenantId);

  return Response.json({
    ok: true,
    branding: brandingFromTenantRow(data),
    tenantId,
    viewer: viewerPayload(auth, tenantId, data?.name ?? null),
  });
}
