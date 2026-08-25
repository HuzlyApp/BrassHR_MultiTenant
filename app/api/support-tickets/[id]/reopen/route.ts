import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { isStaffRole } from "@/lib/auth/app-role";
import {
  getSupportTicketById,
  reopenSupportTicket,
} from "@/lib/support-tickets/support-ticket-service";
import { getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  if (!isStaffRole(auth.role) && !auth.godAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  let existing;
  try {
    existing = await getSupportTicketById(supabase, id);
  } catch (err) {
    console.error("[support-tickets/:id/reopen:get]", err);
    return NextResponse.json({ error: "Could not load support ticket." }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const scope = await resolveStaffTenantScope(auth.authUser);
  if (scope.mode === "scoped" && existing.tenant_id !== scope.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (existing.status === "Open" || existing.status === "In Progress" || existing.status === "Pending") {
    return NextResponse.json({ ticket: existing });
  }

  const result = await reopenSupportTicket(supabase, { ticketId: id });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const ticket = await getSupportTicketById(supabase, id);
  return NextResponse.json({ ticket: ticket ?? result.ticket });
}
