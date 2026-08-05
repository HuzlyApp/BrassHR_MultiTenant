import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  generateJobDescriptionRequestSchema,
  generateJobDescriptionWithGrok,
  getJobDescriptionModelName,
  JobDescriptionGenerationError,
  JOB_DESCRIPTION_GENERATE_ERROR,
} from "@/lib/jobs/generate-job-description";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const USER_LIMIT = Number(process.env.RATE_LIMIT_JOB_DESCRIPTION_AI_PER_HOUR ?? 30);
const TENANT_LIMIT = Number(
  process.env.RATE_LIMIT_JOB_DESCRIPTION_AI_TENANT_PER_HOUR ?? 120
);

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let tenantId: string | null = null;
  try {
    tenantId = await resolveStaffTenantId(supabase, auth);
  } catch {
    tenantId = null;
  }
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const userLimited = await enforceRateLimit(req, {
    namespace: "job-description-ai-user",
    key: `${tenantId}:${auth.userId}`,
    limit: USER_LIMIT,
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });
  if (userLimited) {
    return NextResponse.json(
      { error: JOB_DESCRIPTION_GENERATE_ERROR, code: "RATE_LIMIT" },
      { status: 429, headers: userLimited.headers }
    );
  }

  const tenantLimited = await enforceRateLimit(req, {
    namespace: "job-description-ai-tenant",
    key: tenantId,
    limit: TENANT_LIMIT,
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });
  if (tenantLimited) {
    return NextResponse.json(
      { error: JOB_DESCRIPTION_GENERATE_ERROR, code: "RATE_LIMIT" },
      { status: 429, headers: tenantLimited.headers }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = generateJobDescriptionRequestSchema.safeParse(body);
  if (!parsed.success) {
    const missingCore = parsed.error.issues.some((issue) =>
      issue.message.toLowerCase().includes("job title")
    );
    return NextResponse.json(
      {
        error: missingCore
          ? "Add a job title, profession, or specialty before generating a description."
          : "Invalid job attributes.",
        code: "VALIDATION",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const result = await generateJobDescriptionWithGrok(parsed.data);

    void writeActivityLog({
      actorUserId: auth.userId,
      action: "job_description.ai_generated",
      entityType: "job",
      tenantId,
      request: req,
      metadata: {
        model: getJobDescriptionModelName(),
        ai_generated: true,
        warning_count: result.warnings.length,
        has_title: Boolean(parsed.data.jobTitle),
        has_profession: Boolean(parsed.data.profession),
        has_specialty: Boolean(parsed.data.specialty),
        plain_text_length: result.plainText.length,
      },
    });

    return NextResponse.json({
      descriptionHtml: result.descriptionHtml,
      plainText: result.plainText,
      warnings: result.warnings,
    });
  } catch (error) {
    const code =
      error instanceof JobDescriptionGenerationError ? error.code : "UNKNOWN";

    // Avoid logging full descriptions or API keys.
    console.error("[jobs/generate-description]", {
      code,
      tenantId,
      userId: auth.userId,
      message: error instanceof Error ? error.message : "unknown",
    });

    const status =
      code === "AUTH"
        ? 502
        : code === "RATE_LIMIT"
          ? 429
          : code === "TIMEOUT" || code === "NETWORK"
            ? 504
            : code === "MISSING_CONFIG"
              ? 503
              : 502;

    return NextResponse.json(
      { error: JOB_DESCRIPTION_GENERATE_ERROR, code },
      { status }
    );
  }
}
