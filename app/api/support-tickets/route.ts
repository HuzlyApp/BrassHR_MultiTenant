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
      return NextResponse.json({ tickets });
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
    return NextResponse.json({ tickets });
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

  const auth = await requireApprovedApplicant(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    subject?: string;
    description?: string;
    inquiry?: string;
    category?: string;
    priority?: string;
    source?: string;
  };

  const description = (body.description ?? body.inquiry ?? "").trim();
  const subject = body.subject?.trim() ?? "";
  const priority = body.priority?.trim().toLowerCase() as SupportTicketPriority | undefined;

  if (!subject) {
    return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Please describe your issue." }, { status: 400 });
  }
  if (priority && !PRIORITIES.has(priority)) {
    return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
  }

  const result = await insertSupportTicket(auth.supabase, {
    tenantId: auth.applicant.tenant_id,
    userId: auth.user.id,
    applicantId: auth.applicant.id,
    input: {
      subject,
      description,
      category: body.category,
      priority,
      source: body.source ?? "manual",
    },
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ticket: result.ticket }, { status: 201 });
}
