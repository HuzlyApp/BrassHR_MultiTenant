import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { requireApprovedApplicant, bearerToken } from "@/lib/applicant-portal/request";
import { isStaffRole } from "@/lib/auth/app-role";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type AttachmentRow = {
  id: string;
  tenant_id: string;
  ticket_id: string;
  file_path: string;
  storage_bucket: string;
  support_tickets:
    | { applicant_id: string | null; user_id: string }
    | { applicant_id: string | null; user_id: string }[]
    | null;
};

function ticketFromAttachment(row: AttachmentRow) {
  const ticket = row.support_tickets;
  if (!ticket) return null;
  return Array.isArray(ticket) ? ticket[0] ?? null : ticket;
}

export async function GET(req: NextRequest) {
  try {
    const attachmentId = req.nextUrl.searchParams.get("attachmentId")?.trim() ?? "";
    if (!attachmentId) {
      return NextResponse.json({ error: "attachmentId is required" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data, error } = await supabase
      .from("support_ticket_attachments")
      .select(
        "id, tenant_id, ticket_id, file_path, storage_bucket, support_tickets: ticket_id (applicant_id, user_id)"
      )
      .eq("id", attachmentId)
      .maybeSingle();

    if (error) throw error;
    const row = data as AttachmentRow | null;
    if (!row?.file_path || !row.storage_bucket) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    let allowed = false;

    const staffAuth = await requireStaffApiSession();
    if (!(staffAuth instanceof NextResponse)) {
      if (isStaffRole(staffAuth.role) || staffAuth.godAdmin) {
        const scope = await resolveStaffTenantScope(staffAuth.authUser);
        if (scope.mode === "all" || scope.tenantId === row.tenant_id) {
          allowed = true;
        }
      }
    }

    if (!allowed) {
      const applicantAuth = await requireApprovedApplicant(req);
      if (!(applicantAuth instanceof NextResponse)) {
        const ticket = ticketFromAttachment(row);
        if (
          ticket?.applicant_id === applicantAuth.applicant.id ||
          ticket?.user_id === applicantAuth.user.id
        ) {
          allowed = true;
        }
      }
    }

    if (!allowed && bearerToken(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const signed = await supabase.storage
      .from(row.storage_bucket)
      .createSignedUrl(row.file_path, 60 * 10);
    if (signed.error || !signed.data?.signedUrl) {
      throw signed.error ?? new Error("Could not load attachment");
    }

    return NextResponse.redirect(signed.data.signedUrl, { status: 302 });
  } catch (err) {
    console.error("[support-tickets/attachment:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
