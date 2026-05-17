import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import { persistTenantOnboardingConfig } from "@/lib/onboarding/persist-tenant-onboarding-config";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { ONBOARDING_STEP_TYPES } from "@/lib/onboarding/types";

export const runtime = "nodejs";

type Body = {
  tenantId?: string;
  steps?: OnboardingStepDraft[];
};

function isValidStepType(t: string): boolean {
  return (ONBOARDING_STEP_TYPES as readonly string[]).includes(t);
}

/** Saves onboarding steps during tenant signup (service role; no admin session yet). */
export async function POST(req: Request) {
  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tenantId = String(body.tenantId ?? "").trim();
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const steps = body.steps;
  if (!Array.isArray(steps) || !steps.length) {
    return NextResponse.json({ error: "steps array is required" }, { status: 400 });
  }

  for (const s of steps) {
    if (!s.step_key?.trim() || !s.title?.trim() || !isValidStepType(s.step_type)) {
      return NextResponse.json({ error: "Invalid step in payload" }, { status: 400 });
    }
  }

  const { data: tenant } = await svc.from("tenants").select("id").eq("id", tenantId).maybeSingle();
  if (!tenant?.id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  try {
    await persistTenantOnboardingConfig(svc, tenantId, steps);
    const config = await loadTenantOnboardingConfig(svc, tenantId);
    return NextResponse.json({ ok: true, config });
  } catch (err: unknown) {
    console.error("[tenant-onboarding/save-onboarding-config]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
