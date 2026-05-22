import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import {
  loadTenantOnboardingConfig,
  type OnboardingDbClient,
} from "@/lib/onboarding/load-tenant-config";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import { persistTenantOnboardingConfig } from "@/lib/onboarding/persist-tenant-onboarding-config";

export const runtime = "nodejs";

function tenantRequiredResponse(detail: string): NextResponse {
  return NextResponse.json(
    { error: "No tenant selected", code: "TENANT_REQUIRED", detail },
    { status: 400 }
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const tenantId =
      req.nextUrl.searchParams.get("tenantId")?.trim() ||
      (await resolveEffectiveAdminTenantId(supabase, {
        userId: auth.userId,
        authUser: auth.authUser,
        godAdmin: auth.godAdmin,
      }));

    if (!tenantId) {
      return tenantRequiredResponse(
        auth.godAdmin
          ? "Select a tenant using the tenant switcher in the header."
          : "Your account is not linked to a tenant. Contact an administrator."
      );
    }

    const config = await loadTenantOnboardingConfig(
      supabase as OnboardingDbClient,
      tenantId,
      { workerFacing: false }
    );
    return NextResponse.json({ config, tenantId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type SaveBody = {
  steps?: OnboardingStepDraft[];
};

export async function PUT(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
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
    const tenantId = await resolveEffectiveAdminTenantId(supabase, {
      userId: auth.userId,
      authUser: auth.authUser,
      godAdmin: auth.godAdmin,
    });

    if (!tenantId) {
      return tenantRequiredResponse(
        auth.godAdmin
          ? "Select a tenant before saving onboarding settings."
          : "Your account is not linked to a tenant. Contact an administrator."
      );
    }

    await persistTenantOnboardingConfig(supabase as OnboardingDbClient, tenantId, steps);
    const config = await loadTenantOnboardingConfig(supabase as OnboardingDbClient, tenantId);
    return NextResponse.json({ config, tenantId });
  } catch (err: unknown) {
    console.error("[admin/onboarding/config]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
