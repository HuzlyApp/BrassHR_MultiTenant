import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { bindTenantIndustries } from "./bind-tenant";
import { industryKeyFromLegacyLabel } from "./industry-catalog";

export async function syncTenantIndustryFromLabels(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    primaryLabel?: string | null;
    additionalLabels?: string[] | null;
    additionalKeys?: string[] | null;
  }
): Promise<void> {
  const keys = new Set<string>();
  const primary = industryKeyFromLegacyLabel(args.primaryLabel) ?? null;
  if (primary) keys.add(primary);
  for (const label of args.additionalLabels ?? []) {
    const key = industryKeyFromLegacyLabel(label);
    if (key) keys.add(key);
  }
  for (const key of args.additionalKeys ?? []) {
    if (key.trim()) keys.add(key.trim());
  }
  if (!keys.size && !primary) return;
  await bindTenantIndustries(supabase, {
    tenantId: args.tenantId,
    industryKeys: [...keys],
    primaryIndustryKey: primary,
  });
}
