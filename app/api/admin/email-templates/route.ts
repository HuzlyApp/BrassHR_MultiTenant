import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  adminSaveEmailTemplateSchema,
  listAdminEmailTemplates,
  saveAdminTenantEmailTemplate,
} from "@/lib/email-templates/admin-service";
import { EmailTemplateError } from "@/lib/email-templates/errors";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { getResendFromDomainForUi } from "@/lib/email/from-address";

function handleError(e: unknown): NextResponse {
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
  if (e instanceof EmailTemplateError) {
    return NextResponse.json(
      { error: e.message, code: e.code, ...(e.details ? { details: e.details } : {}) },
      { status: e.status }
    );
  }
  console.error("[admin/email-templates]", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** GET — list manageable templates for the effective admin tenant. */
export async function GET(req: Request) {
  try {
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

    const url = new URL(req.url);
    const locale = url.searchParams.get("locale")?.trim() || "en";

    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("id", tenantId)
      .maybeSingle();

    const templates = await listAdminEmailTemplates(supabase, tenantId, locale);

    return NextResponse.json({
      tenantId,
      tenantName: (tenantRow as { name?: string } | null)?.name ?? null,
      locale,
      resendFromDomain: getResendFromDomainForUi(),
      templates,
    });
  } catch (e) {
    return handleError(e);
  }
}

/** PUT — save tenant-specific template body (creates override when needed). */
export async function PUT(req: Request) {
  try {
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
          detail: "Select a tenant before saving email templates.",
        },
        { status: 400 }
      );
    }

    const body = adminSaveEmailTemplateSchema.parse(await req.json());
    const template = await saveAdminTenantEmailTemplate(
      supabase,
      tenantId,
      auth.userId,
      body
    );

    return NextResponse.json({ template, saved: true });
  } catch (e) {
    return handleError(e);
  }
}
