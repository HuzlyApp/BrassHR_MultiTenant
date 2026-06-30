import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import {
  readOnboardingTenantSlugFromRequest,
  resolveOnboardingWorker,
} from "@/lib/onboarding/resolve-onboarding-worker";
import { WORKER_REQUIRED_FILES_BUCKET } from "@/lib/supabase-storage-buckets";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, {
      namespace: "onboarding-documents-upload",
      key: getClientIp(req),
      limit: Number(process.env.RATE_LIMIT_UPLOADS_PER_HOUR ?? 20),
      windowMs: 60 * 60 * 1000,
      failClosed: false,
    });
    if (limited) return limited;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const applicantId = String(formData.get("applicantId") ?? "").trim();
    const requiredDocumentId = String(formData.get("requiredDocumentId") ?? "").trim();
    const tenantSlug = readOnboardingTenantSlugFromRequest(req, formData);

    if (!file || !applicantId || !requiredDocumentId) {
      return NextResponse.json({ error: "Missing file, applicantId, or requiredDocumentId" }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const ctx = await resolveOnboardingWorker(supabase, applicantId, tenantSlug);
    if (!ctx) {
      return NextResponse.json(
        { error: "Worker not found for this organization. Complete resume upload first." },
        { status: 404 }
      );
    }

    const { data: reqDoc, error: docErr } = await supabase
      .from("tenant_required_documents")
      .select("id, tenant_id, onboarding_step_id, max_file_size_mb, accepted_file_types")
      .eq("id", requiredDocumentId)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (docErr) throw docErr;
    if (!reqDoc) {
      console.warn("[onboarding/documents/upload] requirement missing", {
        requiredDocumentId,
        tenantId: ctx.tenantId,
        tenantSlug,
        workerId: ctx.workerId,
        applicantId,
      });
      return NextResponse.json(
        {
          error:
            "Document requirement not found for this organization. Refresh the page and try again.",
        },
        { status: 404 }
      );
    }

    const maxMb = Number(reqDoc.max_file_size_mb) || 10;
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: `File exceeds ${maxMb}MB limit` }, { status: 400 });
    }

    const accepted = Array.isArray(reqDoc.accepted_file_types)
      ? (reqDoc.accepted_file_types as string[])
      : [];
    if (accepted.length && file.type && !accepted.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const objectPath = `${ctx.tenantId}/${ctx.workerId}/${requiredDocumentId}/${randomUUID()}-${sanitizeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from(WORKER_REQUIRED_FILES_BUCKET)
      .upload(objectPath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const row = {
      worker_id: ctx.workerId,
      tenant_id: ctx.tenantId,
      required_document_id: requiredDocumentId,
      file_url: objectPath,
      original_file_name: file.name,
      file_type: file.type || null,
      file_size: file.size,
      status: "uploaded",
      uploaded_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("worker_submitted_documents")
      .select("id")
      .eq("worker_id", ctx.workerId)
      .eq("required_document_id", requiredDocumentId)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase.from("worker_submitted_documents").update(row).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("worker_submitted_documents").insert(row);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, path: objectPath, bucket: WORKER_REQUIRED_FILES_BUCKET });
  } catch (err: unknown) {
    console.error("[onboarding/documents/upload]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
