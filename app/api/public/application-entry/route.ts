import { NextRequest, NextResponse } from "next/server";
import {
  JobApplicationGateError,
  resolveTenantApplicationEntry,
} from "@/lib/jobs/validate-job-application";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/** Resolve where a tenant applicant should go: job list, single job apply, or empty state. */
export async function GET(req: NextRequest) {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Applications are temporarily unavailable" }, { status: 503 });
  }

  try {
    const route = await resolveTenantApplicationEntry(
      supabase,
      req.nextUrl.searchParams.get("tenant")
    );
    return NextResponse.json({
      kind: route.kind,
      path: route.path,
      jobToken: route.kind === "apply" ? route.jobToken : undefined,
      message: route.kind === "empty" ? route.message : undefined,
      tenantSlug: route.tenantSlug,
    });
  } catch (error) {
    if (error instanceof JobApplicationGateError) {
      const status = error.code === "TENANT_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve application entry" },
      { status: 500 }
    );
  }
}
