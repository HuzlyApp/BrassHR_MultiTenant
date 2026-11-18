import type { SupabaseClient } from "@supabase/supabase-js";
import { sendDepartmentTicketEmail } from "@/lib/departments/send-department-ticket-email";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DepartmentContactRow = {
  id: string;
  name: string;
  primary_contact: string | null;
};

/**
 * Resolve an org department from a ticket category (department id or name)
 * and email its primary_contact when configured.
 */
export async function notifyDepartmentPrimaryContact(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    category: string | null | undefined;
    ticketId: string;
    subject: string;
    description?: string | null;
  }
): Promise<{ emailed: boolean; departmentName?: string }> {
  const category = String(params.category ?? "").trim();
  if (!category) return { emailed: false };

  let department: DepartmentContactRow | null = null;

  if (UUID_RE.test(category)) {
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, primary_contact")
      .eq("tenant_id", params.tenantId)
      .eq("id", category)
      .maybeSingle();
    if (error && !isMissingPrimaryContactColumn(error)) {
      console.error("[support-tickets:department-contact:by-id]", error);
      return { emailed: false };
    }
    if (data) department = data as DepartmentContactRow;
  }

  if (!department) {
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, primary_contact")
      .eq("tenant_id", params.tenantId)
      .ilike("name", category)
      .limit(1)
      .maybeSingle();
    if (error && !isMissingPrimaryContactColumn(error)) {
      console.error("[support-tickets:department-contact:by-name]", error);
      return { emailed: false };
    }
    if (data) department = data as DepartmentContactRow;
  }

  if (!department) return { emailed: false };

  const email = String(department.primary_contact ?? "").trim();
  if (!email) return { emailed: false, departmentName: department.name };

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", params.tenantId)
    .maybeSingle();

  const result = await sendDepartmentTicketEmail({
    email,
    departmentName: department.name,
    tenantName: String((tenant as { name?: string | null } | null)?.name ?? "your organization"),
    ticketId: params.ticketId,
    subject: params.subject,
    description: params.description,
  });

  if (!result.ok) {
    console.error("[support-tickets:department-contact:email]", result.message);
    return { emailed: false, departmentName: department.name };
  }

  return { emailed: true, departmentName: department.name };
}

function isMissingPrimaryContactColumn(error: unknown): boolean {
  const message =
    error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
      ? String((error as { message: string }).message)
      : error instanceof Error
        ? error.message
        : "";
  return /column .*primary_contact.* does not exist|Could not find the 'primary_contact' column/i.test(
    message
  );
}

/** Prefer storing a readable department name when category was a department id. */
export async function resolveTicketCategoryLabel(
  supabase: SupabaseClient,
  tenantId: string,
  category: string | null | undefined
): Promise<string> {
  const raw = String(category ?? "").trim() || "general";
  if (!UUID_RE.test(raw)) return raw;

  const { data, error } = await supabase
    .from("departments")
    .select("name")
    .eq("tenant_id", tenantId)
    .eq("id", raw)
    .maybeSingle();
  if (error || !data) return raw;
  const name = String((data as { name?: string | null }).name ?? "").trim();
  return name || raw;
}
