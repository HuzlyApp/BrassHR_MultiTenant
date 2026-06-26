import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { listMailDrafts, upsertMailDraft } from "@/lib/communication/mail-drafts";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

const saveDraftSchema = z.object({
  workerId: z.string().uuid(),
  subject: z.string().max(500).default(""),
  body: z.string().max(50_000).default(""),
  bodyHtml: z.string().max(50_000).nullable().optional(),
  templateKey: z.string().max(100).nullable().optional(),
});

/** GET — list current recruiter mail drafts for the tenant. */
export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });

  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected", code: "TENANT_REQUIRED" }, { status: 400 });
  }

  const drafts = await listMailDrafts(supabase, tenantId, auth.userId);
  return NextResponse.json({ drafts }, { headers: { "Cache-Control": "no-store" } });
}

/** POST — create or update a mail draft (auto-save / save draft). */
export async function POST(req: Request) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = saveDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const workerCheck = parseRequiredUuid(parsed.data.workerId, "workerId");
  if (!workerCheck.ok) {
    return NextResponse.json({ error: workerCheck.error }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });

  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected", code: "TENANT_REQUIRED" }, { status: 400 });
  }

  try {
    const draft = await upsertMailDraft(supabase, {
      tenantId,
      authorUserId: auth.userId,
      workerId: workerCheck.value,
      subject: parsed.data.subject,
      body: parsed.data.body,
      bodyHtml: parsed.data.bodyHtml ?? null,
      templateKey: parsed.data.templateKey ?? null,
    });

    return NextResponse.json({ draft, saved: Boolean(draft) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
