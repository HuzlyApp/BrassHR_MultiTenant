import { NextRequest, NextResponse } from "next/server";
import { applicantDisplayName } from "@/lib/applicant-portal";
import { validateApplicantProfileInput } from "@/lib/applicant-portal/profile-validation";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";

export const runtime = "nodejs";

type WorkerProfileRow = {
  id: string;
  tenant_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  job_role: string | null;
  status: string | null;
};

function serializeProfile(worker: WorkerProfileRow) {
  return {
    id: worker.id,
    tenantId: worker.tenant_id,
    firstName: worker.first_name ?? "",
    lastName: worker.last_name ?? "",
    email: worker.email ?? "",
    phone: worker.phone ?? "",
    address1: worker.address1 ?? "",
    address2: worker.address2 ?? "",
    city: worker.city ?? "",
    state: worker.state ?? "",
    zip: worker.zip ?? "",
    jobRole: worker.job_role ?? "",
    statusLabel: worker.status ?? "Approved",
    displayName: applicantDisplayName({
      id: worker.id,
      tenant_id: worker.tenant_id,
      user_id: null,
      email: worker.email,
      first_name: worker.first_name,
      last_name: worker.last_name,
      status: worker.status,
      applicant_password_set_at: null,
    }),
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const { data, error } = await auth.supabase
      .from("worker")
      .select(
        "id, tenant_id, first_name, last_name, email, phone, address1, address2, city, state, zip, job_role, status"
      )
      .eq("id", auth.applicant.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    return NextResponse.json({ profile: serializeProfile(data as WorkerProfileRow) });
  } catch (err) {
    console.error("[applicant-portal/profile:get]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const validation = validateApplicantProfileInput({
      first_name: typeof body.firstName === "string" ? body.firstName : "",
      last_name: typeof body.lastName === "string" ? body.lastName : "",
      email: typeof body.email === "string" ? body.email : "",
      phone: typeof body.phone === "string" ? body.phone : "",
      address1: typeof body.address1 === "string" ? body.address1 : "",
      address2: typeof body.address2 === "string" ? body.address2 : "",
      city: typeof body.city === "string" ? body.city : "",
      state: typeof body.state === "string" ? body.state : "",
      zip: typeof body.zip === "string" ? body.zip : "",
    });
    if (!validation.ok) {
      const fieldErrors = {
        firstName: validation.errors.first_name,
        lastName: validation.errors.last_name,
        email: validation.errors.email,
        phone: validation.errors.phone,
        address1: validation.errors.address1,
        address2: validation.errors.address2,
        city: validation.errors.city,
        state: validation.errors.state,
        zip: validation.errors.zip,
      };
      return NextResponse.json({ error: "Validation failed", fieldErrors }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("worker")
      .update({
        first_name: validation.value.first_name,
        last_name: validation.value.last_name,
        email: validation.value.email,
        phone: validation.value.phone,
        address1: validation.value.address1,
        address2: validation.value.address2 || null,
        city: validation.value.city,
        state: validation.value.state,
        zip: validation.value.zip,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.applicant.id)
      .select(
        "id, tenant_id, first_name, last_name, email, phone, address1, address2, city, state, zip, job_role, status"
      )
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, profile: serializeProfile(data as WorkerProfileRow) });
  } catch (err) {
    console.error("[applicant-portal/profile:patch]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update profile" },
      { status: 500 }
    );
  }
}
