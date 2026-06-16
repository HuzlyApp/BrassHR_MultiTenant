import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { findApplicantByUserId, normalizeApplicantStatus } from "@/lib/applicant-portal";

export const runtime = "nodejs";

type AttachmentMessageRow = {
  id: string;
  worker_id: string;
  attachment_bucket: string | null;
  attachment_path: string | null;
};

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function resolveApplicantUserId(req: NextRequest): Promise<string | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Supabase service role not configured");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return data.user.id;
}

export async function GET(req: NextRequest) {
  try {
    const messageId = req.nextUrl.searchParams.get("messageId")?.trim() ?? "";
    if (!messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data, error } = await supabase
      .from("applicant_messages")
      .select("id, worker_id, attachment_bucket, attachment_path")
      .eq("id", messageId)
      .maybeSingle();
    if (error) throw error;
    const row = data as AttachmentMessageRow | null;
    if (!row?.id || !row.attachment_bucket || !row.attachment_path) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const staffAuth = await requireStaffApiSession();
    let allowed = false;

    if (!(staffAuth instanceof NextResponse)) {
      const { data: worker, error: workerError } = await supabase
        .from("worker")
        .select("id, user_id")
        .eq("id", row.worker_id)
        .maybeSingle();
      if (workerError) throw workerError;
      if (worker?.id && canAccessWorkerRecord(staffAuth, { id: String(worker.id), user_id: worker.user_id })) {
        allowed = true;
      }
    }

    if (!allowed) {
      const applicantUserId = await resolveApplicantUserId(req);
      if (applicantUserId) {
        const applicant = await findApplicantByUserId(supabase, applicantUserId);
        if (
          applicant?.id &&
          normalizeApplicantStatus(applicant.status) === "approved" &&
          applicant.id === row.worker_id
        ) {
          allowed = true;
        }
      }
    }

    if (!allowed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const signed = await supabase.storage.from(row.attachment_bucket).createSignedUrl(row.attachment_path, 60 * 10);
    if (signed.error || !signed.data?.signedUrl) throw signed.error ?? new Error("Could not load attachment");
    return NextResponse.redirect(signed.data.signedUrl, { status: 302 });
  } catch (err) {
    console.error("[applicant-portal/messages/attachment:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
