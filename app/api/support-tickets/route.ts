import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { isStaffRole } from "@/lib/auth/app-role";
import {
  insertSupportTicket,
  listApplicantSupportTickets,
  listStaffSupportTickets,
} from "@/lib/support-tickets/support-ticket-service";
import { enrichTicketsWithMessagePreviews } from "@/lib/support-tickets/support-ticket-messages";
import { parseSupportTicketCreateBody } from "@/lib/support-tickets/parse-create-request";
import type { SupportTicketPriority } from "@/lib/support-tickets/types";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const PRIORITIES = new Set<SupportTicketPriority>(["low", "normal", "high", "urgent"]);

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const applicantAuth = await requireApprovedApplicant(req);
  if (!(applicantAuth instanceof NextResponse)) {
    try {
      const tickets = await listApplicantSupportTickets(supabase, applicantAuth.applicant.id);
      const conversations = await enrichTicketsWithMessagePreviews(supabase, tickets);
      return NextResponse.json({ tickets: conversations });
    } catch (err) {
      console.error("[support-tickets:get:applicant]", err);
      return NextResponse.json({ error: "Could not load support tickets." }, { status: 500 });
    }
  }

  const staffAuth = await requireStaffApiSession();
  if (staffAuth instanceof NextResponse) return staffAuth;
  if (!isStaffRole(staffAuth.role) && !staffAuth.godAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const scope = await resolveStaffTenantScope(staffAuth.authUser);
    const tenantId = scope.mode === "scoped" ? scope.tenantId : undefined;
    const tickets = await listStaffSupportTickets(supabase, tenantId);
    const conversations = await enrichTicketsWithMessagePreviews(supabase, tickets);
    return NextResponse.json({ tickets: conversations });
  } catch (err) {
    console.error("[support-tickets:get:staff]", err);
    return NextResponse.json({ error: "Could not load support tickets." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, {
    namespace: "support-tickets-create",
    key: getClientIp(req),
    limit: Number(process.env.RATE_LIMIT_APPLICANT_HELP_TICKETS_PER_HOUR ?? 10),
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });
  if (limited) return limited;

  const parsed = await parseSupportTicketCreateBody(req);
  const { subject, description, category, priority, source, files, applicantId } = parsed;

  if (!subject) {
    return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Please describe your issue." }, { status: 400 });
  }
  if (priority && !PRIORITIES.has(priority)) {
    return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
  }

  const applicantAuth = await requireApprovedApplicant(req);
  if (!(applicantAuth instanceof NextResponse)) {
    const result = await insertSupportTicket(applicantAuth.supabase, {
      tenantId: applicantAuth.applicant.tenant_id,
      userId: applicantAuth.user.id,
      applicantId: applicantAuth.applicant.id,
      input: {
        subject,
        description,
        category: category || "general",
        priority,
        source: source || "manual",
      },
      files,
      notifyStaff: true,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ticket: result.ticket }, { status: 201 });
  }

  const staffAuth = await requireStaffApiSession();
  if (staffAuth instanceof NextResponse) return staffAuth;
  if (!isStaffRole(staffAuth.role) && !staffAuth.godAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!applicantId) {
    return NextResponse.json(
      { error: "Select a worker to create a support ticket on their behalf." },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const scope = await resolveStaffTenantScope(staffAuth.authUser);
  if (scope.mode !== "scoped") {
    return NextResponse.json({ error: "Select a tenant before creating a ticket." }, { status: 400 });
  }

  const { data: worker, error: workerError } = await supabase
    .from("worker")
    .select("id, tenant_id, user_id, first_name, last_name, email")
    .eq("id", applicantId)
    .maybeSingle();

  if (workerError || !worker) {
    return NextResponse.json({ error: "Worker not found." }, { status: 404 });
  }

  if (worker.tenant_id !== scope.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!worker.user_id) {
    return NextResponse.json(
      { error: "This worker does not have a linked user account yet." },
      { status: 400 }
    );
  }

  const result = await insertSupportTicket(supabase, {
    tenantId: worker.tenant_id,
    userId: String(worker.user_id),
    applicantId: String(worker.id),
    input: {
      subject,
      description,
      category: category || "general",
      priority,
      source: source || "staff_on_behalf",
    },
    files,
    createdByStaffUserId: staffAuth.userId,
    initialSenderRole: "staff",
    notifyStaff: false,
    notifyApplicant: true,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const name = `${worker.first_name ?? ""} ${worker.last_name ?? ""}`.trim() || null;
  return NextResponse.json(
    {
      ticket: {
        ...result.ticket,
        applicant_name: name,
        applicant_email: worker.email ?? null,
      },
    },
    { status: 201 }
  );
}
