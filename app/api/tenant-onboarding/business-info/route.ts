import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  firstBusinessInfoError,
  isBusinessInfoValid,
  normalizeBusinessInfoBody,
  validateBusinessInfoForm,
} from "@/lib/tenant/business-info-validation";
import { resolveBusinessInfoValidationContext } from "@/lib/tenant/resolve-business-info-context";

/**
 * Validates tenant onboarding business information (stateless).
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const input = normalizeBusinessInfoBody(body);
  const context = await resolveBusinessInfoValidationContext(svc, input.state);
  const errors = validateBusinessInfoForm(input, context);

  if (!isBusinessInfoValid(input, context)) {
    return NextResponse.json(
      {
        error: firstBusinessInfoError(errors) ?? "Please correct the highlighted fields.",
        errors,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
