import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSignedPortalFileUrl } from "@/lib/applicant-portal/upload";
import { requireApiSession } from "@/lib/auth/api-session";
import { isStaffRole } from "@/lib/auth/app-role";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { canAccessWorkerRecord, canAccessWorkerSensitiveData } from "@/lib/auth/worker-record-access";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { resolveStorageAccessibleUrl } from "@/lib/supabase/resolve-storage-accessible-url";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() || "";
    const source = req.nextUrl.searchParams.get("source")?.trim() ?? "";
    const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";

    if (!workerIdRaw) {
      return NextResponse.json({ error: "Missing workerId" }, { status: 400 });
    }
    if (!id) {
      return NextResponse.json({ error: "Missing document id." }, { status: 400 });
    }

    const idCheck = parseRequiredUuid(workerIdRaw, "workerId");
    if (!idCheck.ok) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 });
    }
    const workerId = idCheck.value;

    const auth = await requireApiSession();
    if (auth instanceof NextResponse) return auth;
    if (isStaffRole(auth.role) && !canAccessWorkerSensitiveData(auth)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);

    let workerQuery = supabase.from("worker").select("id, user_id, tenant_id").eq("id", workerId);
    if (isStaffRole(auth.role)) {
      if (!auth.authUser) return NextResponse.json({error:"Forbidden"},{status:403});
      const scope = await resolveEffectiveAdminTenantId(supabase, { userId:auth.userId, authUser:auth.authUser, godAdmin:auth.godAdmin });
      if (!scope) return NextResponse.json({error:"Forbidden"},{status:403});
      workerQuery = workerQuery.eq("tenant_id",scope);
    } else workerQuery = workerQuery.eq("user_id",auth.userId);
    const { data: worker, error: workerErr } = await workerQuery.maybeSingle();

    if (workerErr) throw workerErr;
    if (!worker?.id) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    if (
      !(await canAccessWorkerRecord(auth, {
        id: String(worker.id),
        user_id: (worker as { user_id?: unknown }).user_id,
      }))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenantId = String(worker.tenant_id ?? "");
    if (!tenantId) return NextResponse.json({ error: "Document unavailable" }, { status: 404 });
    const auditDownload = () => writeActivityLog({actorUserId:auth.userId,tenantId,action:"worker.document.download_link",entityType:"worker",entityId:workerId,metadata:{source,document_id:id,expires_in:120},request:req});
    let storagePath: string | null = null;

    if (source === "credential") {
      const { data, error } = await supabase
        .from("worker_credentials")
        .select("storage_path, document_url")
        .eq("id", id)
        .eq("worker_id", workerId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      storagePath =
        (data?.storage_path as string | null)?.trim() ||
        (data?.document_url as string | null)?.trim() ||
        null;
    } else if (source === "license") {
      const { data, error } = await supabase
        .from("worker_license_records")
        .select("storage_path, file_url")
        .eq("id", id)
        .eq("worker_id", workerId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      storagePath =
        (data?.storage_path as string | null)?.trim() ||
        (data?.file_url as string | null)?.trim() ||
        null;
    } else if (source === "portal") {
      const { data, error } = await supabase
        .from("worker_portal_documents")
        .select("storage_path, file_url")
        .eq("id", id)
        .eq("worker_id", workerId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      storagePath =
        (data?.storage_path as string | null)?.trim() ||
        (data?.file_url as string | null)?.trim() ||
        null;
    } else if (source === "required") {
      const { data, error } = await supabase
        .from("worker_submitted_documents")
        .select("file_url")
        .eq("id", id)
        .eq("worker_id", workerId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      const fileUrl = (data?.file_url as string | null)?.trim() || null;
      if (!fileUrl) {
        return NextResponse.json({ error: "Document file not found." }, { status: 404 });
      }
      const accessibleUrl = await resolveStorageAccessibleUrl(supabase, fileUrl);
      if (!accessibleUrl) {
        return NextResponse.json({ error: "Could not create download link." }, { status: 500 });
      }
      await auditDownload();
      return NextResponse.json({ url: accessibleUrl }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    } else {
      return NextResponse.json({ error: "Invalid document source." }, { status: 400 });
    }

    if (!storagePath) {
      return NextResponse.json({ error: "Document file not found." }, { status: 404 });
    }

    const accessibleUrl =
      (await resolveStorageAccessibleUrl(supabase, storagePath)) ??
      (await createSignedPortalFileUrl(supabase, storagePath));

    if (!accessibleUrl) {
      return NextResponse.json({ error: "Could not create download link." }, { status: 500 });
    }

    await auditDownload();
      return NextResponse.json({ url: accessibleUrl }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (err) {
    console.error("[admin/worker-account-files:get]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load file" },
      { status: 500 }
    );
  }
}
