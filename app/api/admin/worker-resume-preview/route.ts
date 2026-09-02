import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiSession } from "@/lib/auth/api-session";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets";
import { normalizeResumeStorageObjectPath } from "@/lib/onboarding/normalize-resume-storage-path";
import {
  buildDocxResumePreviewHtml,
  DOCX_PREVIEW_HTML_HEADERS,
  wordResumePreviewFallbackHtml,
} from "@/lib/resume/docx-to-preview-html";
import { resolveResumeFileType } from "@/lib/resume/validate-resume-upload";

export const runtime = "nodejs";

function fileNameFromPath(path: string) {
  const seg = path.split("/").pop();
  return (seg && seg.trim()) || "resume.pdf";
}

export async function GET(req: NextRequest) {
  try {
    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() || "";
    const idCheck = parseRequiredUuid(workerIdRaw, "workerId");
    if (!idCheck.ok) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 });
    }
    const workerId = idCheck.value;

    const auth = await requireApiSession();
    if (auth instanceof NextResponse) return auth;

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }
    const supabase = createClient(url, key);

    const { data: worker, error: workerErr } = await supabase
      .from("worker")
      .select("id, user_id")
      .eq("id", workerId)
      .maybeSingle();
    if (workerErr) throw workerErr;
    if (!worker?.id) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }
    if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userIdForLegacy =
      worker.user_id != null && String(worker.user_id).trim() !== "" ? String(worker.user_id) : null;
    const { data: reqRows, error: reqErr } = await supabase
      .from("worker_requirements")
      .select("resume_path")
      .or(userIdForLegacy ? `worker_id.eq.${workerId},worker_id.eq.${userIdForLegacy}` : `worker_id.eq.${workerId}`)
      .limit(1);
    if (reqErr) throw reqErr;

    const reqRow = Array.isArray(reqRows) ? reqRows[0] : null;
    const resumePathRaw = (reqRow as { resume_path?: string } | null | undefined)?.resume_path;
    const normalized = resumePathRaw ? normalizeResumeStorageObjectPath(resumePathRaw) : null;
    const resumePath = normalized?.trim() || "";
    if (!resumePath) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const { data: blob, error: fileErr } = await supabase.storage
      .from(WORKER_RESUMES_BUCKET)
      .download(resumePath);
    if (fileErr || !blob) {
      return NextResponse.json({ error: "Unable to load resume file" }, { status: 404 });
    }

    const fileName = fileNameFromPath(resumePath);
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileType = resolveResumeFileType({ name: fileName, type: blob.type });

    if (fileType === "docx") {
      try {
        const html = await buildDocxResumePreviewHtml(buffer);
        return new NextResponse(html, { status: 200, headers: DOCX_PREVIEW_HTML_HEADERS });
      } catch (err) {
        console.error("[admin/worker-resume-preview] docx preview", err);
        return new NextResponse(
          wordResumePreviewFallbackHtml(
            "This Word resume could not be previewed. Use Download Resume to open the original file."
          ),
          { status: 200, headers: DOCX_PREVIEW_HTML_HEADERS }
        );
      }
    }

    if (fileType === "doc") {
      return new NextResponse(
        wordResumePreviewFallbackHtml(
          "Legacy .doc files cannot be previewed in the browser. Use Download Resume to open the file."
        ),
        { status: 200, headers: DOCX_PREVIEW_HTML_HEADERS }
      );
    }

    const looksLikePdf =
      fileType === "pdf" ||
      (buffer.length >= 4 && buffer.subarray(0, 4).toString("latin1") === "%PDF");
    const contentType = looksLikePdf ? "application/pdf" : blob.type || "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, max-age=120",
        "X-Frame-Options": "SAMEORIGIN",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[admin/worker-resume-preview]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
