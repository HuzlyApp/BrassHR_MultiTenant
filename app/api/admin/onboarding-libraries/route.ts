import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import {
  createOnboardingLibrary,
  listOnboardingLibraries,
} from "@/lib/onboarding/onboarding-libraries";

export const runtime = "nodejs";

async function resolveTenantId(
  supabase: OnboardingDbClient,
  auth: Awaited<ReturnType<typeof requireStaffApiSession>>
): Promise<string | null> {
  if (auth instanceof NextResponse) return null;
  return resolveEffectiveAdminTenantId(supabase, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });
}

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const tenantId = await resolveTenantId(supabase as OnboardingDbClient, auth);
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant selected", code: "TENANT_REQUIRED" },
        { status: 400 }
      );
    }

    const libraries = await listOnboardingLibraries(supabase as OnboardingDbClient, tenantId);
    return NextResponse.json({ libraries, tenantId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load libraries";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type CreateBody = {
  name?: string;
  description?: string;
};

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: CreateBody = {};
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const tenantId = await resolveTenantId(supabase as OnboardingDbClient, auth);
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant selected", code: "TENANT_REQUIRED" },
        { status: 400 }
      );
    }

    const library = await createOnboardingLibrary(supabase as OnboardingDbClient, tenantId, {
      name: body.name?.trim() || "New Library",
      description: body.description,
      createdBy: auth.userId,
    });

    return NextResponse.json({ library });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create library";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
