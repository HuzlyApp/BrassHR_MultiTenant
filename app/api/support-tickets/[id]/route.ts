import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { isStaffRole } from "@/lib/auth/app-role";
import { getSupportTicketById } from "@/lib/support-tickets/support-ticket-service";
import { getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  let ticket;
  try {
    ticket = await getSupportTicketById(supabase, id);
  } catch (err) {
    console.error("[support-tickets/:id:get]", err);
    return NextResponse.json({ error: "Could not load support ticket." }, { status: 500 });
  }

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const applicantAuth = await requireApprovedApplicant(req);
  if (!(applicantAuth instanceof NextResponse)) {
    if (ticket.applicant_id !== applicantAuth.applicant.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ ticket });
  }

  const staffAuth = await requireStaffApiSession();
  if (staffAuth instanceof NextResponse) return staffAuth;
  if (!isStaffRole(staffAuth.role) && !staffAuth.godAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scope = await resolveStaffTenantScope(staffAuth.authUser);
  if (scope.mode === "scoped" && ticket.tenant_id !== scope.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ticket });
}
