import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { isStaffRole } from "@/lib/auth/app-role";
import {
  deleteTenantFaq,
  FaqServiceError,
  updateTenantFaq,
} from "@/lib/faqs/faq-service";
import { getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function handleFaqError(err: unknown, fallback: string) {
  if (err instanceof FaqServiceError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error(fallback, err);
  return NextResponse.json({ error: "Could not process FAQ request." }, { status: 500 });
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const staffAuth = await requireStaffApiSession(req);
  if (staffAuth instanceof NextResponse) return staffAuth;
  if (!isStaffRole(staffAuth.role) && !staffAuth.godAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scope = await resolveStaffTenantScope(staffAuth.authUser);
  if (scope.mode !== "scoped") {
    return NextResponse.json(
      { error: "Select a tenant before updating an FAQ.", code: "TENANT_REQUIRED" },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  const faqId = id?.trim();
  if (!faqId) {
    return NextResponse.json({ error: "FAQ id is required." }, { status: 400 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const faq = await updateTenantFaq(supabase, scope.tenantId, faqId, {
      category: typeof body.category === "string" ? body.category : "",
      question: typeof body.question === "string" ? body.question : "",
      answer: typeof body.answer === "string" ? body.answer : "",
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      isPublished: body.isPublished !== false,
    });
    return NextResponse.json({ faq });
  } catch (err) {
    return handleFaqError(err, "[admin/faqs/:id:patch]");
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const staffAuth = await requireStaffApiSession(req);
  if (staffAuth instanceof NextResponse) return staffAuth;
  if (!isStaffRole(staffAuth.role) && !staffAuth.godAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scope = await resolveStaffTenantScope(staffAuth.authUser);
  if (scope.mode !== "scoped") {
    return NextResponse.json(
      { error: "Select a tenant before deleting an FAQ.", code: "TENANT_REQUIRED" },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  const faqId = id?.trim();
  if (!faqId) {
    return NextResponse.json({ error: "FAQ id is required." }, { status: 400 });
  }

  try {
    await deleteTenantFaq(supabase, scope.tenantId, faqId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleFaqError(err, "[admin/faqs/:id:delete]");
  }
}
