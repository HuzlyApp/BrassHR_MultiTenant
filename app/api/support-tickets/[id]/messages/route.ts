import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { isStaffRole } from "@/lib/auth/app-role";
import {
  getTicketThread,
  insertTicketMessage,
  listTicketAttachments,
} from "@/lib/support-tickets/support-ticket-messages";
import { getSupportTicketById } from "@/lib/support-tickets/support-ticket-service";
import type { SupportTicketSenderRole } from "@/lib/support-tickets/types";
import { getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type RouteContext = { params: Promise<{ id: string }> };

async function authorizeTicketAccess(
  req: NextRequest,
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  ticketId: string
) {
  const ticket = await getSupportTicketById(supabase, ticketId);
  if (!ticket) {
    return { error: NextResponse.json({ error: "Ticket not found." }, { status: 404 }) };
  }

  const applicantAuth = await requireApprovedApplicant(req);
  if (!(applicantAuth instanceof NextResponse)) {
    if (ticket.applicant_id !== applicantAuth.applicant.id) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return {
      ticket,
      senderRole: "applicant" as SupportTicketSenderRole,
      userId: applicantAuth.user.id,
      supabase: applicantAuth.supabase,
    };
  }

  const staffAuth = await requireStaffApiSession();
  if (staffAuth instanceof NextResponse) return { error: staffAuth };
  if (!isStaffRole(staffAuth.role) && !staffAuth.godAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const scope = await resolveStaffTenantScope(staffAuth.authUser);
  if (scope.mode === "scoped" && ticket.tenant_id !== scope.tenantId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return {
    ticket,
    senderRole: "staff" as SupportTicketSenderRole,
    userId: staffAuth.authUser.id,
    supabase,
  };
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const auth = await authorizeTicketAccess(req, supabase, id);
  if ("error" in auth) return auth.error;

  try {
    const [messages, attachments] = await Promise.all([
      getTicketThread(auth.supabase, id),
      listTicketAttachments(auth.supabase, id),
    ]);
    return NextResponse.json({ messages, attachments, ticket: auth.ticket });
  } catch (err) {
    console.error("[support-tickets/:id/messages:get]", err);
    return NextResponse.json({ error: "Could not load ticket messages." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const auth = await authorizeTicketAccess(req, supabase, id);
  if ("error" in auth) return auth.error;

  if (auth.ticket.status === "Closed") {
    return NextResponse.json({ error: "This ticket is closed." }, { status: 400 });
  }

  const isFormData = req.headers.get("content-type")?.toLowerCase().includes("multipart/form-data");
  let message = "";
  const files: File[] = [];

  if (isFormData) {
    const form = await req.formData();
    message = String(form.get("message") ?? form.get("body") ?? "").trim();
    for (const entry of form.getAll("file")) {
      if (entry instanceof File && entry.size > 0) files.push(entry);
    }
    for (const entry of form.getAll("files")) {
      if (entry instanceof File && entry.size > 0) files.push(entry);
    }
  } else {
    const body = (await req.json().catch(() => ({}))) as { message?: string; body?: string };
    message = (body.message ?? body.body ?? "").trim();
  }

  if (!message && files.length === 0) {
    return NextResponse.json({ error: "Message or attachment is required." }, { status: 400 });
  }

  const result = await insertTicketMessage(auth.supabase, {
    tenantId: auth.ticket.tenant_id,
    ticketId: id,
    senderId: auth.userId,
    senderRole: auth.senderRole,
    message,
    files,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (auth.senderRole === "staff" && auth.ticket.status === "Open") {
    await auth.supabase
      .from("support_tickets")
      .update({ status: "In Progress", updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  return NextResponse.json({ message: result.message }, { status: 201 });
}
