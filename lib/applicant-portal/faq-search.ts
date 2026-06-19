import type { SupabaseClient } from "@supabase/supabase-js";
import type { FaqRow } from "@/lib/faqs/types";

export type { FaqRow };

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "for",
  "of",
  "in",
  "on",
  "at",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "i",
  "me",
  "my",
  "we",
  "you",
  "your",
  "how",
  "what",
  "when",
  "where",
  "why",
  "can",
  "do",
  "does",
  "did",
  "with",
  "from",
  "about",
  "please",
  "help",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function scoreFaq(inquiry: string, faq: FaqRow, tenantId: string): number {
  const inquiryLower = inquiry.toLowerCase().trim();
  const questionLower = faq.question.toLowerCase();
  const answerLower = faq.answer.toLowerCase();
  const categoryLower = faq.category.toLowerCase();
  let score = 0;

  if (faq.tenant_id === tenantId) score += 5;

  if (inquiryLower && questionLower.includes(inquiryLower)) score += 12;
  if (inquiryLower && answerLower.includes(inquiryLower)) score += 8;
  if (inquiryLower && categoryLower.includes(inquiryLower)) score += 4;

  const tokens = tokenize(inquiry);
  for (const token of tokens) {
    if (questionLower.includes(token)) score += 4;
    if (answerLower.includes(token)) score += 2;
    if (categoryLower.includes(token)) score += 3;
  }

  return score;
}

function formatFaqAnswer(matches: FaqRow[]): string {
  if (matches.length === 1) return matches[0].answer.trim();

  return matches
    .map((faq, index) => {
      const heading = matches.length > 1 ? `${index + 1}. ${faq.question.trim()}\n` : "";
      return `${heading}${faq.answer.trim()}`;
    })
    .join("\n\n");
}

export async function searchFaqForInquiry(
  supabase: SupabaseClient,
  tenantId: string,
  inquiry: string
): Promise<{ message: string; matches: FaqRow[]; confidence: number } | null> {
  const trimmed = inquiry.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from("faqs")
    .select("id, tenant_id, category, question, answer")
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const faqs = (data ?? []) as FaqRow[];
  if (faqs.length === 0) return null;

  const ranked = faqs
    .map((faq) => ({ faq, score: scoreFaq(trimmed, faq, tenantId) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aTenant = a.faq.tenant_id === tenantId ? 1 : 0;
      const bTenant = b.faq.tenant_id === tenantId ? 1 : 0;
      return bTenant - aTenant;
    });

  if (ranked.length === 0) return null;

  const topScore = ranked[0].score;
  const minScore = Math.max(4, Math.floor(topScore * 0.55));
  const matches = ranked.filter((item) => item.score >= minScore).slice(0, 3).map((item) => item.faq);

  if (matches.length === 0) return null;

  return {
    message: formatFaqAnswer(matches),
    matches,
    confidence: Math.min(1, Number((topScore / 24).toFixed(2))),
  };
}
