import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { isStaffRole } from "@/lib/auth/app-role";
import { listStaffFaqs } from "@/lib/faqs/faq-service";
import { getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const staffAuth = await requireStaffApiSession();
  if (staffAuth instanceof NextResponse) return staffAuth;
  if (!isStaffRole(staffAuth.role) && !staffAuth.godAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const scope = await resolveStaffTenantScope(staffAuth.authUser);
    const tenantId = scope.mode === "scoped" ? scope.tenantId : undefined;
    const faqs = await listStaffFaqs(supabase, tenantId);
    return NextResponse.json({ faqs });
  } catch (err) {
    console.error("[admin/faqs:get]", err);
    return NextResponse.json({ error: "Could not load knowledgebase articles." }, { status: 500 });
  }
}
