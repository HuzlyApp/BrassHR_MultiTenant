import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { checkSubdomainAvailabilityForOnboarding } from "@/lib/tenant/check-subdomain-availability";

type Body = {
  subdomain?: string | null;
};

/**
 * Validates subdomain format and availability before advancing past the domain step.
 */
export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const result = await checkSubdomainAvailabilityForOnboarding(svc, String(body.subdomain ?? ""));
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, subdomain: result.subdomain });
}
