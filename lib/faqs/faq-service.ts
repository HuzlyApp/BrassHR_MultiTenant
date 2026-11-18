import type { SupabaseClient } from "@supabase/supabase-js";
import type { FaqListItem, FaqUpsertInput } from "@/lib/faqs/types";

const FAQ_SELECT =
  "id, tenant_id, category, question, answer, sort_order, is_published, created_at, updated_at";
const FAQ_SELECT_LEGACY = "id, tenant_id, category, question, answer, created_at";

function isMissingColumnError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code?: string }).code) : "";
  const message = "message" in err ? String((err as { message?: string }).message) : "";
  return code === "42703" || /column .* does not exist/i.test(message);
}

function normalizeFaqRow(row: Record<string, unknown>): FaqListItem {
  return {
    id: String(row.id),
    tenant_id: (row.tenant_id as string | null) ?? null,
    category: String(row.category ?? "General"),
    question: String(row.question ?? ""),
    answer: String(row.answer ?? ""),
    sort_order: Number(row.sort_order ?? 0),
    is_published: row.is_published !== false,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? row.created_at ?? ""),
  };
}

function normalizeCategory(value: string): string {
  const text = value.trim().replace(/\s+/g, " ");
  return text || "General";
}

function normalizeQuestion(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeAnswer(value: string): string {
  return value.trim();
}

export class FaqServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "FAQ_ERROR") {
    super(message);
    this.name = "FaqServiceError";
    this.status = status;
    this.code = code;
  }
}

function assertUpsertInput(input: FaqUpsertInput): {
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
} {
  const category = normalizeCategory(input.category ?? "");
  const question = normalizeQuestion(input.question ?? "");
  const answer = normalizeAnswer(input.answer ?? "");
  if (!question) throw new FaqServiceError("Question is required.", 400, "VALIDATION_ERROR");
  if (!answer) throw new FaqServiceError("Answer is required.", 400, "VALIDATION_ERROR");
  if (question.length > 300) {
    throw new FaqServiceError("Question must be 300 characters or fewer.", 400, "VALIDATION_ERROR");
  }
  if (answer.length > 8000) {
    throw new FaqServiceError("Answer must be 8000 characters or fewer.", 400, "VALIDATION_ERROR");
  }
  if (category.length > 80) {
    throw new FaqServiceError("Category must be 80 characters or fewer.", 400, "VALIDATION_ERROR");
  }
  const sortOrder =
    typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
      ? Math.max(0, Math.floor(input.sortOrder))
      : 0;
  const isPublished = input.isPublished !== false;
  return { category, question, answer, sortOrder, isPublished };
}

export async function listStaffFaqs(
  supabase: SupabaseClient,
  tenantId?: string,
  options?: { includeUnpublished?: boolean }
): Promise<FaqListItem[]> {
  const includeUnpublished = options?.includeUnpublished === true;

  const run = async (select: string, withPublishFilter: boolean) => {
    let query = supabase.from("faqs").select(select);
    if (select.includes("sort_order")) {
      query = query.order("sort_order", { ascending: true });
    }
    query = query.order("category", { ascending: true }).order("created_at", { ascending: true });
    if (tenantId) {
      query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    }
    if (withPublishFilter && !includeUnpublished) {
      query = query.eq("is_published", true);
    }
    return query;
  };

  let result = await run(FAQ_SELECT, true);
  if (result.error && isMissingColumnError(result.error)) {
    result = await run(FAQ_SELECT_LEGACY, false);
  }
  if (result.error) throw result.error;

  return ((result.data ?? []) as unknown as Record<string, unknown>[]).map(normalizeFaqRow);
}

/** Published FAQs visible to an approved applicant for their tenant (plus platform FAQs). */
export async function listApplicantFaqs(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FaqListItem[]> {
  return listStaffFaqs(supabase, tenantId, { includeUnpublished: false });
}

export async function createTenantFaq(
  supabase: SupabaseClient,
  tenantId: string,
  input: FaqUpsertInput
): Promise<FaqListItem> {
  const normalized = assertUpsertInput(input);
  const payload = {
    tenant_id: tenantId,
    category: normalized.category,
    question: normalized.question,
    answer: normalized.answer,
    sort_order: normalized.sortOrder,
    is_published: normalized.isPublished,
    updated_at: new Date().toISOString(),
  };

  let result = await supabase.from("faqs").insert(payload).select(FAQ_SELECT).single();
  if (result.error && isMissingColumnError(result.error)) {
    result = await supabase
      .from("faqs")
      .insert({
        tenant_id: tenantId,
        category: normalized.category,
        question: normalized.question,
        answer: normalized.answer,
      })
      .select(FAQ_SELECT_LEGACY)
      .single();
  }
  if (result.error) throw result.error;
  return normalizeFaqRow(result.data as unknown as Record<string, unknown>);
}

export async function updateTenantFaq(
  supabase: SupabaseClient,
  tenantId: string,
  faqId: string,
  input: FaqUpsertInput
): Promise<FaqListItem> {
  const normalized = assertUpsertInput(input);
  const { data: existing, error: existingError } = await supabase
    .from("faqs")
    .select("id, tenant_id")
    .eq("id", faqId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new FaqServiceError("FAQ not found.", 404, "NOT_FOUND");
  if (!existing.tenant_id) {
    throw new FaqServiceError("Platform FAQs are read-only for tenant admins.", 403, "PLATFORM_READONLY");
  }
  if (String(existing.tenant_id) !== tenantId) {
    throw new FaqServiceError("Forbidden", 403, "FORBIDDEN");
  }

  let result = await supabase
    .from("faqs")
    .update({
      category: normalized.category,
      question: normalized.question,
      answer: normalized.answer,
      sort_order: normalized.sortOrder,
      is_published: normalized.isPublished,
      updated_at: new Date().toISOString(),
    })
    .eq("id", faqId)
    .eq("tenant_id", tenantId)
    .select(FAQ_SELECT)
    .single();

  if (result.error && isMissingColumnError(result.error)) {
    result = await supabase
      .from("faqs")
      .update({
        category: normalized.category,
        question: normalized.question,
        answer: normalized.answer,
      })
      .eq("id", faqId)
      .eq("tenant_id", tenantId)
      .select(FAQ_SELECT_LEGACY)
      .single();
  }

  if (result.error) throw result.error;
  return normalizeFaqRow(result.data as unknown as Record<string, unknown>);
}

export async function deleteTenantFaq(
  supabase: SupabaseClient,
  tenantId: string,
  faqId: string
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from("faqs")
    .select("id, tenant_id")
    .eq("id", faqId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new FaqServiceError("FAQ not found.", 404, "NOT_FOUND");
  if (!existing.tenant_id) {
    throw new FaqServiceError("Platform FAQs are read-only for tenant admins.", 403, "PLATFORM_READONLY");
  }
  if (String(existing.tenant_id) !== tenantId) {
    throw new FaqServiceError("Forbidden", 403, "FORBIDDEN");
  }

  const { error } = await supabase.from("faqs").delete().eq("id", faqId).eq("tenant_id", tenantId);
  if (error) throw error;
}
