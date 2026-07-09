import type { SupabaseClient } from "@supabase/supabase-js";
import { emailLookupVariants } from "@/lib/email/email-domain";

export const UNAPPROVED_APPLICANT_MESSAGE =
  "Your application has not been approved yet. You will be able to access your applicant dashboard once your application has been approved.";

export type ApplicationStatusKey = "pending" | "under_review" | "approved" | "rejected";

export type ApplicantWorkerRow = {
  id: string;
  user_id: string | null;
  tenant_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
  applicant_password_set_at: string | null;
};

export function normalizeApplicantStatus(status: string | null | undefined): ApplicationStatusKey {
  const value = String(status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (value === "approved") return "approved";
  if (value === "rejected" || value === "disapproved" || value === "declined") return "rejected";
  if (value === "under_review" || value === "review") return "under_review";
  return "pending";
}

export function applicantStatusLabel(status: string | null | undefined): string {
  const normalized = normalizeApplicantStatus(status);
  if (normalized === "under_review") return "Under Review";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export async function resolveTenantIdForApplicantPortal(
  supabase: SupabaseClient,
  tenantSlug?: string | null
): Promise<string | null> {
  const slug = tenantSlug?.trim().toLowerCase();
  if (!slug) return null;

  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .or(`slug.eq.${slug},subdomain.eq.${slug}`)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data?.id ? String(data.id) : null;
}

export async function findApplicantByEmail(
  supabase: SupabaseClient,
  email: string,
  tenantId?: string | null
): Promise<ApplicantWorkerRow | null> {
  const variants = emailLookupVariants(email);
  if (variants.length === 0) return null;

  let query = supabase
    .from("worker")
    .select("id, user_id, tenant_id, email, first_name, last_name, status, applicant_password_set_at")
    .in("email", variants)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as ApplicantWorkerRow | null) ?? null;
}

export async function findApplicantByUserId(
  supabase: SupabaseClient,
  userId: string,
  tenantId?: string | null
): Promise<ApplicantWorkerRow | null> {
  let query = supabase
    .from("worker")
    .select("id, user_id, tenant_id, email, first_name, last_name, status, applicant_password_set_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as ApplicantWorkerRow | null) ?? null;
}

export function applicantDisplayName(worker: ApplicantWorkerRow): string {
  const name = [worker.first_name, worker.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name || worker.email || "Applicant";
}
