import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiSession } from "@/lib/auth/api-session";
import { isStaffRole } from "@/lib/auth/app-role";
import { getSupabaseUrl } from "@/lib/supabase-env";
import {
  loadTenantOnboardingConfig,
  type OnboardingDbClient,
} from "@/lib/onboarding/load-tenant-config";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import { persistTenantOnboardingConfig } from "@/lib/onboarding/persist-tenant-onboarding-config";

export const runtime = "nodejs";

async function resolveStaffTenantId(
  supabase: OnboardingDbClient,
  userId: string
): Promise<string | null> {
  const { data: userRow } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  const u = userRow as { tenant_id?: string | null } | null;
  if (u?.tenant_id) return String(u.tenant_id);

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("tenant_id")
    .eq("user_id", userId)
    .not("tenant_id", "is", null)
    .limit(1)
    .maybeSingle();
  const r = roleRow as { tenant_id?: string | null } | null;
  return r?.tenant_id ? String(r.tenant_id) : null;
}

export async function GET(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  if (!isStaffRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const supabase = createClient(url, key) as OnboardingDbClient;
    const tenantId =
      req.nextUrl.searchParams.get("tenantId")?.trim() ||
      (await resolveStaffTenantId(supabase, auth.userId));
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not resolved" }, { status: 400 });
    }
    const config = await loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: false });
    return NextResponse.json({ config });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type SaveBody = {
  steps?: OnboardingStepDraft[];
};

export async function PUT(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  if (!isStaffRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: SaveBody = {};
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const steps = body.steps;
  if (!Array.isArray(steps) || !steps.length) {
    return NextResponse.json({ error: "steps array required" }, { status: 400 });
  }

  try {
    const supabase = createClient(url, key) as OnboardingDbClient;
    const tenantId = await resolveStaffTenantId(supabase, auth.userId);
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not resolved" }, { status: 400 });
    }

    await persistTenantOnboardingConfig(supabase, tenantId, steps);
    const config = await loadTenantOnboardingConfig(supabase, tenantId);
    return NextResponse.json({ config });
  } catch (err: unknown) {
    console.error("[admin/onboarding/config]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
