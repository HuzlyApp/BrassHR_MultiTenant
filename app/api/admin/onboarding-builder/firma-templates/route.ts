import { NextResponse } from "next/server";
import { requireRecruiterTemplateAdminContext } from "@/lib/recruiter-templates/api-helpers";
import { listRecruiterTemplates } from "@/lib/recruiter-templates/service";

export const runtime = "nodejs";

/** Published Firma-backed recruiter templates for the onboarding builder picker. */
export async function GET() {
  try {
    const ctx = await requireRecruiterTemplateAdminContext();
    if (ctx instanceof NextResponse) return ctx;

    const templates = await listRecruiterTemplates(ctx.supabase, ctx.tenantId, {
      status: "active",
    });

    const options = templates
      .filter((template) => Boolean(template.firma_template_id))
      .map((template) => ({
        id: template.id,
        name: template.name,
        firma_template_id: template.firma_template_id,
        category: template.category,
      }));

    return NextResponse.json({ templates: options });
  } catch (err: unknown) {
    console.error("[admin/onboarding-builder/firma-templates]", err);
    const message = err instanceof Error ? err.message : "Failed to load Firma templates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
