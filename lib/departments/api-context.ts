import { NextResponse } from "next/server";
import { requireStaffApiSession, type StaffApiAuthContext } from "@/lib/auth/api-session";
import { requireWorkflowAdmin } from "@/lib/auth/workflow-admin";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DepartmentApiContext = {
  supabase: SupabaseClient;
  tenantId: string;
  auth: StaffApiAuthContext;
};

export async function requireDepartmentRead(): Promise<DepartmentApiContext | NextResponse> {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(supabase, auth);
  if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  return { supabase, tenantId, auth };
}

export async function requireDepartmentWrite(): Promise<DepartmentApiContext | NextResponse> {
  const resolved = await requireDepartmentRead();
  if (resolved instanceof NextResponse) return resolved;
  const forbidden = requireWorkflowAdmin(resolved.auth);
  if (forbidden) return forbidden;
  return resolved;
}

export function departmentErrorStatus(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : "Could not update departments";
  if (/already exists/i.test(message)) return { status: 409, message };
  if (/not found/i.test(message)) return { status: 404, message };
  if (/enter a department|characters or fewer|activate this department|before deleting|before assigning/i.test(message)) {
    return { status: 400, message };
  }
  return { status: 500, message };
}
