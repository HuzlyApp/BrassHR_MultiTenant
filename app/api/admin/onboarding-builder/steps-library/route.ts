import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import { loadOnboardingStepLibrary } from "@/lib/onboarding/load-step-library";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const tenantId = await resolveEffectiveAdminTenantId(supabase as OnboardingDbClient, {
      userId: auth.userId,
      authUser: auth.authUser,
      godAdmin: auth.godAdmin,
    });

    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant selected", code: "TENANT_REQUIRED" },
        { status: 400 }
      );
    }

    const categories = await loadOnboardingStepLibrary(supabase as OnboardingDbClient, tenantId);

    if (!categories.length) {
      return NextResponse.json({
        categories: [],
        error: "No step library entries found. Seed onboarding_step_library in Supabase.",
      });
    }

    return NextResponse.json({ categories });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load step library";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
