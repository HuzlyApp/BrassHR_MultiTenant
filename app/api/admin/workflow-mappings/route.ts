import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  listWorkflowMappings,
  saveWorkflowMapping,
} from "@/lib/workflow-mappings/service";
import { WorkflowMappingError } from "@/lib/workflow-mappings/types";
import { workflowMappingInputSchema } from "@/lib/workflow-mappings/schemas";

function forbidden() {
  return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin" && !auth.godAdmin) return forbidden();
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const mappings = await listWorkflowMappings(supabase, tenantId, {
      professionId: req.nextUrl.searchParams.get("professionId") || undefined,
      employmentType: req.nextUrl.searchParams.get("employmentType") || undefined,
      activeOnly: req.nextUrl.searchParams.get("activeOnly") === "true",
    });
    return NextResponse.json({ mappings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load mappings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin" && !auth.godAdmin) return forbidden();
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const parsed = workflowMappingInputSchema.safeParse(await req.json().catch(() => null));
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
    return NextResponse.json({ mapping }, { status: parsed.data.id ? 200 : 201 });
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
      { error: error instanceof Error ? error.message : "Failed to save mapping" },
      { status: 500 }
    );
  }
}
