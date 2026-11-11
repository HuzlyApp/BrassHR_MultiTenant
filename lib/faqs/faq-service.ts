import type { SupabaseClient } from "@supabase/supabase-js";
import type { FaqListItem } from "@/lib/faqs/types";

export async function listStaffFaqs(
  supabase: SupabaseClient,
  tenantId?: string
): Promise<FaqListItem[]> {
  let query = supabase
    .from("faqs")
    .select("id, tenant_id, category, question, answer, created_at")
    .order("category", { ascending: true })
    .order("created_at", { ascending: true });

  if (tenantId) {
    query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as FaqListItem[];
}

/** Published FAQs visible to an approved applicant for their tenant (plus platform FAQs). */
export async function listApplicantFaqs(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FaqListItem[]> {
  return listStaffFaqs(supabase, tenantId);
}
