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

  const auth = await requireApprovedApplicant(req);
  if (auth instanceof NextResponse) return auth;

  const isFormData = req.headers.get("content-type")?.toLowerCase().includes("multipart/form-data");
  let subject = "";
  let description = "";
  let category = "general";
  let priorityRaw = "";
  let source = "manual";
  const files: File[] = [];

  if (isFormData) {
    const form = await req.formData();
    subject = String(form.get("subject") ?? "").trim();
    description = String(form.get("description") ?? form.get("inquiry") ?? "").trim();
    category = String(form.get("category") ?? "general").trim() || "general";
    priorityRaw = String(form.get("priority") ?? "").trim().toLowerCase();
    source = String(form.get("source") ?? "manual").trim() || "manual";
    for (const entry of form.getAll("file")) {
      if (entry instanceof File && entry.size > 0) files.push(entry);
    }
    for (const entry of form.getAll("files")) {
      if (entry instanceof File && entry.size > 0) files.push(entry);
    }
  } else {
    const body = (await req.json().catch(() => ({}))) as {
      subject?: string;
      description?: string;
      inquiry?: string;
      category?: string;
      priority?: string;
      source?: string;
    };
    subject = body.subject?.trim() ?? "";
    description = (body.description ?? body.inquiry ?? "").trim();
    category = body.category?.trim() || "general";
    priorityRaw = body.priority?.trim().toLowerCase() ?? "";
    source = body.source?.trim() || "manual";
  }

  const priority = priorityRaw as SupportTicketPriority | undefined;

  if (!subject) {
    return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Please describe your issue." }, { status: 400 });
  }
  if (priorityRaw && !PRIORITIES.has(priorityRaw as SupportTicketPriority)) {
    return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
  }

  const result = await insertSupportTicket(auth.supabase, {
    tenantId: auth.applicant.tenant_id,
    userId: auth.user.id,
    applicantId: auth.applicant.id,
    input: {
      subject,
      description,
      category,
      priority: priority && PRIORITIES.has(priority) ? priority : undefined,
      source,
    },
    files,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ticket: result.ticket }, { status: 201 });
}
