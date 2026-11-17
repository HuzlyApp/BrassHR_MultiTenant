import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  createAdminLegalDocument,
  deleteAdminLegalDocument,
  listAdminLegalDocuments,
  resetAdminLegalDocumentToDefault,
  updateAdminLegalDocument,
} from "@/lib/legal/admin-service";
import { isSystemLegalDocumentKey } from "@/lib/legal/document-keys";
import {
  createLegalDocumentSchema,
  updateLegalDocumentSchema,
} from "@/lib/legal/validation";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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
  if (e && typeof e === "object" && "status" in e && typeof (e as { status: unknown }).status === "number") {
    const err = e as { status: number; message?: string; code?: string };
    return NextResponse.json(
      { error: err.message ?? "Request failed", code: err.code ?? "ERROR" },
      { status: err.status }
    );
  }
  console.error("[admin/legal-documents]", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

async function resolveTenant() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return { auth };

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return {
      auth,
      error: NextResponse.json({ error: "Supabase is not configured" }, { status: 503 }),
    };
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });

  if (!tenantId) {
    return {
      auth,
      supabase,
      error: NextResponse.json(
        {
          error: "No tenant selected",
          code: "TENANT_REQUIRED",
          detail:
            "Select a tenant using the tenant switcher in the header, or sign in with a tenant-scoped account.",
        },
        { status: 400 }
      ),
    };
  }

  return { auth, supabase, tenantId };
}

/** GET — list legal documents for the effective admin tenant (seeds system defaults). */
export async function GET() {
  try {
    const ctx = await resolveTenant();
    if (ctx.auth instanceof NextResponse) return ctx.auth;
    if (ctx.error) return ctx.error;

    const { data: tenantRow } = await ctx.supabase!
      .from("tenants")
      .select("id, name")
      .eq("id", ctx.tenantId!)
      .maybeSingle();

    const documents = await listAdminLegalDocuments(
      ctx.supabase!,
      ctx.tenantId!,
      ctx.auth.userId
    );

    return NextResponse.json({
      tenantId: ctx.tenantId,
      tenantName: (tenantRow as { name?: string } | null)?.name ?? null,
      documents,
    });
  } catch (e) {
    return handleError(e);
  }
}

/** POST — create a custom legal document, or reset a system document to defaults. */
export async function POST(req: Request) {
  try {
    const ctx = await resolveTenant();
    if (ctx.auth instanceof NextResponse) return ctx.auth;
    if (ctx.error) return ctx.error;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.action === "reset") {
      const key = typeof body.document_key === "string" ? body.document_key.trim() : "";
      if (!isSystemLegalDocumentKey(key)) {
        return NextResponse.json(
          { error: "Only system policies can be reset.", code: "INVALID_KEY" },
          { status: 400 }
        );
      }
      const document = await resetAdminLegalDocumentToDefault(
        ctx.supabase!,
        ctx.tenantId!,
        ctx.auth.userId,
        key
      );
      return NextResponse.json({ document });
    }

    const parsed = createLegalDocumentSchema.parse(body);
    const document = await createAdminLegalDocument(
      ctx.supabase!,
      ctx.tenantId!,
      ctx.auth.userId,
      parsed
    );
    return NextResponse.json({ document }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

/** PUT — update an existing legal document. */
export async function PUT(req: Request) {
  try {
    const ctx = await resolveTenant();
    if (ctx.auth instanceof NextResponse) return ctx.auth;
    if (ctx.error) return ctx.error;

    const body = await req.json().catch(() => ({}));
    const parsed = updateLegalDocumentSchema.parse(body);
    const document = await updateAdminLegalDocument(
      ctx.supabase!,
      ctx.tenantId!,
      ctx.auth.userId,
      parsed
    );
    return NextResponse.json({ document });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE — remove a custom (non-system) legal document. */
export async function DELETE(req: Request) {
  try {
    const ctx = await resolveTenant();
    if (ctx.auth instanceof NextResponse) return ctx.auth;
    if (ctx.error) return ctx.error;

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim() || "";
    if (!id) {
      return NextResponse.json({ error: "Document id is required." }, { status: 400 });
    }

    await deleteAdminLegalDocument(ctx.supabase!, ctx.tenantId!, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
