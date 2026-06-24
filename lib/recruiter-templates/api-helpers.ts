import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { FirmaError } from "@/lib/firma/errors";
import { FirmaWorkspaceConfigError } from "@/lib/firma/resolve-tenant-workspace";
import { RecruiterTemplateError } from "@/lib/recruiter-templates/errors";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function requireRecruiterTemplateAdminContext() {
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
        detail:
          "Select a tenant using the tenant switcher in the header, or sign in with a tenant-scoped account.",
      },
      { status: 400 }
    );
  }

  return { auth, supabase, tenantId };
}

export function handleRecruiterTemplateRouteError(e: unknown): NextResponse {
  if (e instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 }
    );
  }

  if (e instanceof RecruiterTemplateError) {
    return NextResponse.json(
      {
        error: e.message,
        code: e.code,
        ...(e.details ? { details: e.details } : {}),
      },
      { status: e.status }
    );
  }

  if (e instanceof FirmaWorkspaceConfigError) {
    return NextResponse.json(
      {
        error: e.message,
        code: "NOT_CONFIGURED",
      },
      { status: e.status }
    );
  }

  if (e instanceof FirmaError) {
    return NextResponse.json(
      {
        error: e.message,
        code: e.code,
        ...(e.details ? { details: e.details } : {}),
      },
      { status: e.status }
    );
  }

  console.error("[admin/recruiter-templates]", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
