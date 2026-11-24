import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

async function clientContext(context: { params: Promise<{ clientId: string }> }) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const db = createServiceRoleClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(db, auth);
  if (!tenantId) return NextResponse.json({ error: "Select a company first." }, { status: 400 });
  const { clientId } = await context.params;
  if (!parseRequiredUuid(clientId, "clientId").ok) return NextResponse.json({ error: "Invalid client" }, { status: 400 });
  return { db, tenantId, clientId };
}

export async function GET(_req: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  const scope = await clientContext(context);
  if (scope instanceof NextResponse) return scope;
  const { db, tenantId, clientId } = scope;
  const [client, facilities] = await Promise.all([
    db.from("clients").select("id, company_name, address, city, state, zip_code, archived_at, created_at").eq("tenant_id", tenantId).eq("id", clientId).maybeSingle(),
    db.from("facility").select("id, name, address, phone, about, archived_at").eq("tenant_id", tenantId).eq("client_id", clientId).order("name"),
  ]);
  if (client.error || facilities.error) return NextResponse.json({ error: "Could not load the client." }, { status: 500 });
  if (!client.data) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  return NextResponse.json({ client: client.data, facilities: facilities.data ?? [] });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  const scope = await clientContext(context);
  if (scope instanceof NextResponse) return scope;
  const body = await req.json().catch(() => null);
  const patch: { company_name?: string; archived_at?: string | null } = {};
  if (body?.action === "archive" || body?.action === "restore") patch.archived_at = body.action === "archive" ? new Date().toISOString() : null;
  else if (body?.action === "edit") {
    const name = typeof body.companyName === "string" ? body.companyName.trim() : "";
    if (!name || name.length > 200) return NextResponse.json({ error: "Company name is required and must be 200 characters or fewer." }, { status: 400 });
    patch.company_name = name;
  } else return NextResponse.json({ error: "Choose edit, archive or restore." }, { status: 400 });
  const { data, error } = await scope.db.from("clients").update(patch).eq("tenant_id", scope.tenantId).eq("id", scope.clientId).select("id, company_name, archived_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not update client." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  return NextResponse.json({ client: data });
}
