import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { invalidateAiPromptCaches } from "./cache";
import {
  InvalidIndustryKeyError,
  parseIndustryKey,
  type UserFacingIndustryKey,
} from "./industry-catalog";

export async function bindTenantIndustries(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    industryKeys: string[];
    primaryIndustryKey: string | null;
  }
): Promise<void> {
  const unique = [...new Set(args.industryKeys.map((key) => key.trim()).filter(Boolean))];
  const parsed: UserFacingIndustryKey[] = unique.map((key) => {
    const value = parseIndustryKey(key);
    if (!value) throw new InvalidIndustryKeyError(key);
    return value;
  });
  const primary = args.primaryIndustryKey ? parseIndustryKey(args.primaryIndustryKey) : parsed[0] ?? null;
  if (primary && !parsed.includes(primary)) {
    parsed.unshift(primary);
  }

  const { error } = await supabase.rpc("bind_tenant_ai_industries", {
    p_tenant_id: args.tenantId,
    p_industry_keys: parsed,
    p_primary_industry_key: primary,
  });
  if (error) throw error;
  await invalidateAiPromptCaches();
}
