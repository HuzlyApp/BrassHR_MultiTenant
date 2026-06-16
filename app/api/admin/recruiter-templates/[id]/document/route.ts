import { NextRequest, NextResponse } from "next/server";
import {
  handleRecruiterTemplateRouteError,
  requireRecruiterTemplateAdminContext,
} from "@/lib/recruiter-templates/api-helpers";
import { RECRUITER_TEMPLATE_DOCUMENT_BUCKET } from "@/lib/recruiter-templates/constants";
import { getRecruiterTemplateDetail } from "@/lib/recruiter-templates/service";

const MAX_BYTES = 20 * 1024 * 1024;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireRecruiterTemplateAdminContext();
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await context.params;
    const template = await getRecruiterTemplateDetail(ctx.supabase, ctx.tenantId, id);

    if (template.status === "archived") {
      return NextResponse.json(
        { error: "Archived templates cannot be updated", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file upload", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Document exceeds 20MB limit", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF and DOCX documents are supported", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const ext = file.type.includes("pdf") ? "pdf" : "docx";
    const storagePath = `${ctx.tenantId}/${id}/document.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await ctx.supabase.storage
      .from(RECRUITER_TEMPLATE_DOCUMENT_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "Failed to upload document", code: "INTERNAL_ERROR", detail: uploadError.message },
        { status: 500 }
      );
    }

    const { error: updateError } = await ctx.supabase
      .from("recruiter_templates")
      .update({
        document_storage_path: storagePath,
        document_file_name: file.name,
        updated_by: ctx.auth.userId,
      })
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save document reference", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      document_storage_path: storagePath,
      document_file_name: file.name,
    });
  } catch (e) {
    return handleRecruiterTemplateRouteError(e);
  }
}
