import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { parseContactPersonFromAbout } from "@/lib/facilities/address";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { formatApiError } from "@/lib/api/format-api-error";

export const runtime = "nodejs";

export type ClientTableRow = {
  id: string;
  company_name: string;
  client_contact: string;
  open_orders: number;
  on_assignment: number;
  status: "Onboarded" | "Active" | "Hiring for them";
  facilitiesCount?: number;
  facilities?: Array<{ id: string; name: string }>;
  created_at: string;
};

export type ClientsMetrics = {
  activeClients: number;
  facilitiesCount: number;
  programsCount: number;
  directHireCount: number;
  openOrders: number;
  unfilledThisWeek: number;
  onAssignment: number;
  directHireOpens: number;
};

type ClientRow = {
  id: string;
  company_name: string | null;
  verification_status: string | null;
  onboarding_status: string | null;
  onboarding_completed_at: string | null;
  w2_capable: boolean | null;
  created_at: string | null;
};

type FacilityRow = {
  id: string;
  client_id: string | null;
  name: string | null;
  about: string | null;
};

type ShiftRow = {
  id: string;
  client_id: string | null;
  start_date: string | null;
  completed_at: string | null;
  number_of_people_needed: number | null;
};

type AssignmentRow = {
  id: string;
  client_id: string | null;
  status: string | null;
};

const ACTIVE_ASSIGNMENT_STATUSES = new Set([
  "confirmed",
  "active",
  "assigned",
  "in_progress",
  "accepted",
]);

function startOfWeekUtc(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function endOfWeekUtc(startIso: string): string {
  const d = new Date(`${startIso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

function resolveClientStatus(
  client: ClientRow,
  openOrders: number
): ClientTableRow["status"] {
  const onboarding = (client.onboarding_status ?? "").trim().toLowerCase();
  const verification = (client.verification_status ?? "").trim().toLowerCase();
  if (
    client.onboarding_completed_at ||
    onboarding === "completed" ||
    onboarding === "onboarded" ||
    verification === "verified"
  ) {
    return openOrders > 0 ? "Hiring for them" : "Onboarded";
  }
  if (openOrders > 0) return "Hiring for them";
  return "Active";
}

function emptyMetrics(): ClientsMetrics {
  return {
    activeClients: 0,
    facilitiesCount: 0,
    programsCount: 0,
    directHireCount: 0,
    openOrders: 0,
    unfilledThisWeek: 0,
    onAssignment: 0,
    directHireOpens: 0,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Tenant required." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
    }

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("q")?.trim().toLowerCase() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "5", 10) || 5));
    const tenantId = scope.tenantId;

    const [clientsRes, facilitiesRes, shiftsRes, assignmentsRes] = await Promise.all([
      supabase
        .from("clients")
        .select(
          "id, company_name, verification_status, onboarding_status, onboarding_completed_at, w2_capable, created_at"
        )
        .eq("tenant_id", tenantId)
        .filter("archived_at", searchParams.get("archived") === "1" ? "not.is" : "is", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("facility")
        .select("id, client_id, name, about")
        .eq("tenant_id", tenantId),
      supabase
        .from("shifts")
        .select("id, client_id, start_date, completed_at, number_of_people_needed")
        .eq("tenant_id", tenantId)
        .is("completed_at", null),
      supabase
        .from("worker_shift_assignments")
        .select("id, client_id, status")
        .eq("tenant_id", tenantId),
    ]);

    if (clientsRes.error) throw clientsRes.error;
    if (facilitiesRes.error) throw facilitiesRes.error;
    if (shiftsRes.error) throw shiftsRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;

    const clientsData = (clientsRes.data ?? []) as ClientRow[];
    const facilityData = (facilitiesRes.data ?? []) as FacilityRow[];
    const shiftData = (shiftsRes.data ?? []) as ShiftRow[];
    const assignmentData = (assignmentsRes.data ?? []) as AssignmentRow[];

    const facilitiesByClientId = new Map<
      string,
      Array<{ id: string; name: string; contact: string }>
    >();
    for (const facility of facilityData) {
      if (!facility.client_id) continue;
      const list = facilitiesByClientId.get(facility.client_id) ?? [];
      list.push({
        id: facility.id,
        name: (facility.name ?? "").trim() || "Facility",
        contact: parseContactPersonFromAbout(facility.about),
      });
      facilitiesByClientId.set(facility.client_id, list);
    }

    const openOrdersByClientId = new Map<string, number>();
    const weekStart = startOfWeekUtc();
    const weekEnd = endOfWeekUtc(weekStart);
    let unfilledThisWeek = 0;
    for (const shift of shiftData) {
      if (!shift.client_id) continue;
      const needed = Math.max(1, Number(shift.number_of_people_needed) || 1);
      openOrdersByClientId.set(
        shift.client_id,
        (openOrdersByClientId.get(shift.client_id) ?? 0) + needed
      );
      const startDate = shift.start_date?.slice(0, 10) ?? "";
      if (startDate && startDate >= weekStart && startDate <= weekEnd) {
        unfilledThisWeek += needed;
      }
    }

    const onAssignmentByClientId = new Map<string, number>();
    for (const assignment of assignmentData) {
      if (!assignment.client_id) continue;
      const status = (assignment.status ?? "").trim().toLowerCase();
      if (status && !ACTIVE_ASSIGNMENT_STATUSES.has(status)) continue;
      onAssignmentByClientId.set(
        assignment.client_id,
        (onAssignmentByClientId.get(assignment.client_id) ?? 0) + 1
      );
    }

    let clients: ClientTableRow[] = clientsData.map((client) => {
      const facilities = facilitiesByClientId.get(client.id) ?? [];
      const openOrders = openOrdersByClientId.get(client.id) ?? 0;
      const onAssignment = onAssignmentByClientId.get(client.id) ?? 0;
      const contact =
        facilities.map((item) => item.contact.trim()).find(Boolean) || "—";

      return {
        id: client.id,
        company_name: (client.company_name ?? "").trim() || "Unnamed client",
        client_contact: contact,
        open_orders: openOrders,
        on_assignment: onAssignment,
        status: resolveClientStatus(client, openOrders),
        facilitiesCount: facilities.length,
        facilities: facilities.map(({ id, name }) => ({ id, name })),
        created_at: client.created_at || new Date().toISOString(),
      };
    });

    if (search) {
      clients = clients.filter(
        (client) =>
          client.company_name.toLowerCase().includes(search) ||
          client.client_contact.toLowerCase().includes(search) ||
          client.status.toLowerCase().includes(search)
      );
    }

    const total = clients.length;
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * limit;
    const paginated = clients.slice(startIndex, startIndex + limit);

    const openOrdersTotal = clients.reduce((sum, row) => sum + row.open_orders, 0);
    const onAssignmentTotal = clients.reduce((sum, row) => sum + row.on_assignment, 0);
    const directHireCount = clientsData.filter((client) => client.w2_capable === false).length;

    const metrics: ClientsMetrics = {
      activeClients: clientsData.length,
      facilitiesCount: facilityData.length,
      programsCount: 0,
      directHireCount,
      openOrders: openOrdersTotal,
      unfilledThisWeek,
      onAssignment: onAssignmentTotal,
      // No job↔client link yet; keep honest until that exists.
      directHireOpens: 0,
    };

    return NextResponse.json({
      clients: paginated,
      total,
      page: safePage,
      limit,
      totalPages,
      metrics,
    });
  } catch (err) {
    console.error("[admin/clients GET]", err);
    return NextResponse.json(
      { error: formatApiError(err, "Failed to load clients.") },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Tenant required." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    const companyName = String(body.companyName ?? body.company_name ?? "").trim();
    if (!companyName) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }

    if (companyName.length > 120) return NextResponse.json({ error: "Company name must be 120 characters or fewer." }, { status: 400 });

    const contactPerson = String(body.contactPerson ?? body.contact_person ?? "").trim();

    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        tenant_id: scope.tenantId,
        user_id: null,
        company_name: companyName,
        address: body.address ? String(body.address).trim() : null,
        city: body.city ? String(body.city).trim() : null,
        state: body.state ? String(body.state).trim() : null,
        zip_code:
          body.zipCode || body.zip_code
            ? String(body.zipCode || body.zip_code).trim()
            : null,
        w2_capable: Boolean(body.w2Capable ?? body.w2_capable ?? true),
        verification_status: "verified",
        onboarding_status: "completed",
        onboarding_completed_at: new Date().toISOString(),
      })
      .select("id, company_name, address, city, state, zip_code, created_at")
      .single();

    if (error) {
      console.error("[admin/clients POST] DB error:", error);
      throw error;
    }

    // Client contact is displayed from facility.about ("Contact Person: …").
    // Seed a primary facility so the list column persists after create/reload.
    if (contactPerson && created?.id) {
      const addressParts = [
        body.address ? String(body.address).trim() : "",
        [body.city ? String(body.city).trim() : "", body.state ? String(body.state).trim() : ""]
          .filter(Boolean)
          .join(", "),
        body.zipCode || body.zip_code ? String(body.zipCode || body.zip_code).trim() : "",
      ].filter(Boolean);
      const { error: facilityError } = await supabase.from("facility").insert({
        tenant_id: scope.tenantId,
        client_id: created.id,
        name: companyName,
        address: addressParts.join(", ") || null,
        about: `Contact Person: ${contactPerson}`,
      });
      if (facilityError) {
        console.error("[admin/clients POST] facility seed error:", facilityError);
      }
    }

    return NextResponse.json(
      {
        client: {
          ...created,
          client_contact: contactPerson || "—",
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[admin/clients POST]", err);
    return NextResponse.json(
      { error: formatApiError(err, "Failed to create client.") },
      { status: 500 }
    );
  }
}
