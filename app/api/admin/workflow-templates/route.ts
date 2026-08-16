import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import {
  applyPublishedTemplateToEmploymentFlow,
  createWorkflowTemplate,
  listWorkflowTemplates,
} from "@/lib/onboarding/workflow-templates";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import { requireWorkflowAdmin } from "@/lib/auth/workflow-admin";

export const runtime = "nodejs";

async function resolveTenantId(
  supabase: OnboardingDbClient,
  auth: Awaited<ReturnType<typeof requireStaffApiSession>>
): Promise<string | null> {
  if (auth instanceof NextResponse) return null;
  return resolveEffectiveAdminTenantId(supabase, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });
}

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const tenantId = await resolveTenantId(supabase as OnboardingDbClient, auth);
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant selected", code: "TENANT_REQUIRED" },
        { status: 400 }
      );
    }

    const lists = await listWorkflowTemplates(supabase as OnboardingDbClient, tenantId);
    return NextResponse.json(lists);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load templates";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type CreateBody = {
  name?: string;
  folder?: "presets" | "saved-templates";
  builderDraft?: SerializableWorkflowState;
  flowName?: string;
  status?: "draft" | "published" | "unpublished";
  publish?: boolean;
  employmentType?: "W2" | "1099" | null;
};

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: CreateBody = {};
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const builderDraft =
    body.builderDraft && isSerializableWorkflowState(body.builderDraft)
      ? body.builderDraft
      : { nodes: [], edges: [] };

  try {
    const tenantId = await resolveTenantId(supabase as OnboardingDbClient, auth);
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant selected", code: "TENANT_REQUIRED" },
        { status: 400 }
      );
    }

    const publish = body.publish === true || body.status === "published";
    if (publish && !builderDraft.nodes.length) {
      return NextResponse.json({ error: "Cannot publish an empty template" }, { status: 400 });
    }

    const template = await createWorkflowTemplate(supabase as OnboardingDbClient, tenantId, {
      name: body.name?.trim() || body.flowName?.trim() || "New Template",
      folder: "saved-templates",
      builderDraft,
      flowName: body.flowName,
      createdBy: auth.userId,
      status: publish ? "published" : "draft",
      employmentType: body.employmentType,
    });

    let appliedFlowId: string | null = null;
    if (template.status === "published") {
      const applied = await applyPublishedTemplateToEmploymentFlow(
        supabase as OnboardingDbClient,
        tenantId,
        {
          templateId: template.id,
          employmentType: template.employmentType,
          builderDraft,
          updatedBy: auth.userId,
        }
      );
      appliedFlowId = applied?.flowId ?? null;
    }

    return NextResponse.json({ template, appliedFlowId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create template";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
