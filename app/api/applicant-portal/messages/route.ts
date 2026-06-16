import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { findApplicantByUserId, normalizeApplicantStatus } from "@/lib/applicant-portal";
import { APPLICANT_CHAT_BUCKET } from "@/lib/supabase-storage-buckets";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type MessageRow = {
  id: string;
  sender_role: "applicant" | "recruiter";
  body: string | null;
  created_at: string;
  message_type?: "text" | "image" | "file";
  attachment_bucket?: string | null;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  attachment_url?: string | null;
};

const MAX_CHAT_ATTACHMENT_BYTES = Number(process.env.MAX_CHAT_ATTACHMENT_BYTES ?? 10 * 1024 * 1024);
const ALLOWED_CHAT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 180);
}

function withAttachmentUrl(row: MessageRow): MessageRow {
  return {
    ...row,
    attachment_url: row.attachment_path
      ? `/api/applicant-portal/messages/attachment?messageId=${encodeURIComponent(row.id)}`
      : null,
  };
}

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function resolveApplicantRequest(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) return null;

  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Supabase service role not configured");

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;

  const applicant = await findApplicantByUserId(supabase, data.user.id);
  if (!applicant?.id || normalizeApplicantStatus(applicant.status) !== "approved") return null;

  return { supabase, workerId: applicant.id, tenantId: applicant.tenant_id, userId: data.user.id };
}

async function resolveStaffRequest(req: NextRequest, workerIdRaw: string) {
  const idCheck = parseRequiredUuid(workerIdRaw, "workerId");
  if (!idCheck.ok) return { error: NextResponse.json({ error: idCheck.error }, { status: 400 }) };

  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return { error: auth };

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 }) };
  }

  const { data: worker, error } = await supabase
    .from("worker")
    .select("id, user_id, tenant_id, email, first_name, last_name")
    .eq("id", idCheck.value)
    .maybeSingle();
  if (error) throw error;
  if (!worker?.id || !worker.tenant_id) {
    return { error: NextResponse.json({ error: "Worker not found" }, { status: 404 }) };
  }
  if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const tenantId = String(worker.tenant_id);
  const scope = await resolveStaffTenantScope(auth.authUser);
  if (scope.mode === "scoped" && scope.tenantId !== tenantId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return {
    supabase,
    workerId: String(worker.id),
    tenantId,
    userId: auth.devBypass ? null : auth.userId,
    applicant: worker,
  };
}

export async function GET(req: NextRequest) {
  try {
    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() ?? "";
    const resolved = workerIdRaw
      ? await resolveStaffRequest(req, workerIdRaw)
      : await resolveApplicantRequest(req);

    if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ("error" in resolved) return resolved.error;

    const { data, error } = await resolved.supabase
      .from("applicant_messages")
      .select(
        "id, sender_role, body, created_at, message_type, attachment_bucket, attachment_path, attachment_name, attachment_mime, attachment_size"
      )
      .eq("worker_id", resolved.workerId)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const rows = ((data as MessageRow[] | null) ?? []).map(withAttachmentUrl);
    return NextResponse.json({ messages: rows });
  } catch (err) {
    console.error("[applicant-portal/messages:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isFormData = req.headers.get("content-type")?.toLowerCase().includes("multipart/form-data");
    let message = "";
    let workerIdRaw = "";
    let file: File | null = null;

    if (isFormData) {
      const form = await req.formData();
      message = String(form.get("body") ?? "").trim();
      workerIdRaw = String(form.get("workerId") ?? "").trim();
      const maybeFile = form.get("file");
      file = maybeFile instanceof File ? maybeFile : null;
    } else {
      const body = (await req.json().catch(() => ({}))) as { body?: string; workerId?: string };
      message = body.body?.trim() ?? "";
      workerIdRaw = body.workerId?.trim() ?? "";
    }

    if (!message && !file) {
      return NextResponse.json({ error: "Enter message text or attach a file." }, { status: 400 });
    }
    const resolved = workerIdRaw
      ? await resolveStaffRequest(req, workerIdRaw)
      : await resolveApplicantRequest(req);

    if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ("error" in resolved) return resolved.error;

    const senderRole = workerIdRaw ? "recruiter" : "applicant";
    let messageType: "text" | "image" | "file" = "text";
    let attachmentPath: string | null = null;
    let attachmentName: string | null = null;
    let attachmentMime: string | null = null;
    let attachmentSize: number | null = null;

    if (file) {
      const mime = (file.type || "").toLowerCase();
      if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
        return NextResponse.json({ error: "Attachment is too large." }, { status: 400 });
      }
      if (!ALLOWED_CHAT_MIME.has(mime)) {
        return NextResponse.json({ error: "File type is not allowed." }, { status: 400 });
      }
      const safeName = sanitizeFileName(file.name || "attachment");
      const objectPath = `${resolved.tenantId}/${resolved.workerId}/${Date.now()}-${randomUUID()}-${safeName}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await resolved.supabase.storage
        .from(APPLICANT_CHAT_BUCKET)
        .upload(objectPath, bytes, {
          contentType: mime || "application/octet-stream",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      attachmentPath = objectPath;
      attachmentName = safeName;
      attachmentMime = mime || null;
      attachmentSize = file.size;
      messageType = mime.startsWith("image/") ? "image" : "file";
    }

    const { data, error } = await resolved.supabase
      .from("applicant_messages")
      .insert({
        tenant_id: resolved.tenantId,
        worker_id: resolved.workerId,
        sender_role: senderRole,
        sender_user_id: resolved.userId,
        body: message || null,
        message_type: messageType,
        attachment_bucket: attachmentPath ? APPLICANT_CHAT_BUCKET : null,
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        attachment_mime: attachmentMime,
        attachment_size: attachmentSize,
      })
      .select(
        "id, sender_role, body, created_at, message_type, attachment_bucket, attachment_path, attachment_name, attachment_mime, attachment_size"
      )
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, message: withAttachmentUrl(data as MessageRow) });
  } catch (err) {
    console.error("[applicant-portal/messages:post]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
