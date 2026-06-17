import { NextRequest, NextResponse } from "next/server";
import { loadFacilitiesForTenant } from "@/lib/facilities/facility-management-service";
import { createFacility, validateFacilityFormInput } from "@/lib/facilities/facility-service";
import type { CreateFacilityResult, FacilityFormInput } from "@/lib/facilities/types";
import { resolveWorkerContext } from "@/lib/facilities/worker-access";
import { resolveStaffFacilityTenantContext } from "@/lib/facilities/staff-tenant-access";

export const runtime = "nodejs";

function parseFacilityInput(body: Record<string, unknown>): FacilityFormInput {
  return {
    name: String(body.name ?? ""),
    streetAddress: String(body.streetAddress ?? ""),
    city: String(body.city ?? ""),
    state: String(body.state ?? ""),
    zipCode: String(body.zipCode ?? ""),
    mailingAddress: body.mailingAddress != null ? String(body.mailingAddress) : undefined,
    facilityType: body.facilityType != null ? String(body.facilityType) : undefined,
    phone: body.phone != null ? String(body.phone) : undefined,
    email: body.email != null ? String(body.email) : undefined,
    contactPerson: body.contactPerson != null ? String(body.contactPerson) : undefined,
    notes: body.notes != null ? String(body.notes) : undefined,
  };
}

async function resolveTenantContext(tenantIdFromBody?: string) {
  return resolveStaffFacilityTenantContext(tenantIdFromBody);
}

export async function GET() {
  try {
    const resolved = await resolveStaffFacilityTenantContext();
    if ("error" in resolved && resolved.error) return resolved.error;

    const data = await loadFacilitiesForTenant(resolved.supabase, resolved.tenantId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/facilities GET]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown> & {
      workerId?: string;
      assignToWorker?: boolean;
    };

    const input = parseFacilityInput(body);
    const validationError = validateFacilityFormInput(input);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const workerIdRaw = body.workerId?.trim() || "";
    const shouldAssign = body.assignToWorker !== false;

    if (workerIdRaw) {
      const resolved = await resolveWorkerContext(workerIdRaw);
      if ("error" in resolved && resolved.error) return resolved.error;

      const result = await createFacility(resolved.supabase, resolved.tenantId, input, {
        assignToWorkerAuthId: shouldAssign ? resolved.workerAuthId : undefined,
        staffUserId: resolved.staffUserId,
      });

      if ("duplicate" in result && result.duplicate) {
        return NextResponse.json(
          {
            duplicate: true,
            facility: result.facility,
            message: "A facility with this name and address already exists.",
          },
          { status: 409 }
        );
      }

      const created = result as CreateFacilityResult;
      return NextResponse.json({
        facility: created.facility,
        assigned: created.assigned,
        assignmentId: created.assignmentId ?? null,
      });
    }

    const tenantResolved = await resolveTenantContext(
      typeof body.tenantId === "string" ? body.tenantId : undefined
    );
    if ("error" in tenantResolved && tenantResolved.error) return tenantResolved.error;

    const result = await createFacility(tenantResolved.supabase, tenantResolved.tenantId, input, {
      staffUserId: tenantResolved.staffUserId,
    });

    if ("duplicate" in result && result.duplicate) {
      return NextResponse.json(
        {
          duplicate: true,
          facility: result.facility,
          message: "A facility with this name and address already exists.",
        },
        { status: 409 }
      );
    }

    const created = result as CreateFacilityResult;
    return NextResponse.json({
      facility: created.facility,
      assigned: false,
      assignmentId: null,
    });
  } catch (err) {
    console.error("[admin/facilities POST]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
