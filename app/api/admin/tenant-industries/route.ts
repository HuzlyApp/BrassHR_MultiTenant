import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { requireWorkflowAdmin } from "@/lib/auth/workflow-admin";
import {
  activeUserFacingIndustries,
  industryLabelForKey,
  parseIndustryKey,
} from "@/lib/ai-catalog/industry-catalog";
import { bindTenantIndustries } from "@/lib/ai-catalog/bind-tenant";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

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
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const [{ data: tenant, error: tenantError }, { data: rows, error: industryError }] =
    await Promise.all([
      supabase.from("tenants").select("primary_industry_key").eq("id", tenantId).maybeSingle(),
      supabase
        .from("tenant_industry")
        .select("industry_key, is_primary")
        .eq("tenant_id", tenantId),
    ]);
  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 500 });
  }
  if (industryError) {
    return NextResponse.json({ error: industryError.message }, { status: 500 });
  }

  const selectedKeys = (rows ?? [])
    .map((row) => String(row.industry_key ?? "").trim())
    .filter(Boolean);
  const primaryKey =
    (tenant?.primary_industry_key as string | null)?.trim() ||
    (rows ?? []).find((row) => row.is_primary === true)?.industry_key?.toString().trim() ||
    selectedKeys[0] ||
    null;

  return NextResponse.json({
    primaryIndustryKey: primaryKey,
    selectedIndustryKeys: selectedKeys,
    catalog: activeUserFacingIndustries().map((entry) => ({
      key: entry.key,
      label: entry.label,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

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
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { industryKey?: string };
  let industryKey: string;
  try {
    const parsed = parseIndustryKey(body.industryKey);
    if (!parsed) {
      return NextResponse.json({ error: "Choose an industry to add." }, { status: 400 });
    }
    industryKey = parsed;
  } catch {
    return NextResponse.json({ error: "That industry is not supported." }, { status: 400 });
  }

  const [{ data: tenant, error: tenantError }, { data: rows, error: industryError }] =
    await Promise.all([
      supabase.from("tenants").select("primary_industry_key").eq("id", tenantId).maybeSingle(),
      supabase
        .from("tenant_industry")
        .select("industry_key, is_primary")
        .eq("tenant_id", tenantId),
    ]);
  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 500 });
  }
  if (industryError) {
    return NextResponse.json({ error: industryError.message }, { status: 500 });
  }

  const currentKeys = (rows ?? [])
    .map((row) => String(row.industry_key ?? "").trim())
    .filter(Boolean);
  if (currentKeys.includes(industryKey)) {
    return NextResponse.json({
      ok: true,
      alreadyAdded: true,
      industryKey,
      industryLabel: industryLabelForKey(industryKey),
    });
  }

  const primaryKey =
    (tenant?.primary_industry_key as string | null)?.trim() ||
    (rows ?? []).find((row) => row.is_primary === true)?.industry_key?.toString().trim() ||
    industryKey;

  try {
    await bindTenantIndustries(supabase, {
      tenantId,
      industryKeys: [...currentKeys, industryKey],
      primaryIndustryKey: primaryKey,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not add industry.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    alreadyAdded: false,
    industryKey,
    industryLabel: industryLabelForKey(industryKey),
  });
}
