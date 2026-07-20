import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { deleteWorkflowMapping, saveWorkflowMapping } from "@/lib/workflow-mappings/service";
import { WorkflowMappingError } from "@/lib/workflow-mappings/types";
import { workflowMappingInputSchema } from "@/lib/workflow-mappings/schemas";

type RouteContext = { params: Promise<{ id: string }> };

function forbidden() {
  return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin" && !auth.godAdmin) return forbidden();
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { id } = await context.params;
  const body = await req.json().catch(() => null);
  const parsed = workflowMappingInputSchema.safeParse({ ...(body ?? {}), id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workflow mapping", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    const mapping = await saveWorkflowMapping(supabase, tenantId, auth.userId, parsed.data);
    return NextResponse.json({ mapping });
  } catch (error) {
    if (error instanceof WorkflowMappingError) {
      const status =
        error.code === "DUPLICATE_MAPPING" ? 409 : error.code === "INCOMPATIBLE_WORKFLOW" ? 422 : 400;
      return NextResponse.json(
        { error: error.message, code: error.code, fieldErrors: error.fieldErrors },
        { status }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update mapping" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin" && !auth.godAdmin) return forbidden();
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { id } = await context.params;

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    const result = await deleteWorkflowMapping(supabase, tenantId, id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WorkflowMappingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete mapping" },
      { status: 500 }
    );
  }
}
