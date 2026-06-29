"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { staffFetchInit } from "@/lib/staff-auth-headers";
import { useEffectiveBranding } from "@/lib/admin/hooks/use-effective-branding";

type TenantRow = { id: string; name: string; slug: string };

const ADMIN_TENANTS_QUERY_KEY = ["admin-tenants-list"] as const;

async function fetchAdminTenants(): Promise<TenantRow[]> {
  const res = await fetch("/api/admin/tenants", {
    ...(await staffFetchInit()),
    cache: "no-store",
  });
  const js = (await res.json()) as { tenants?: TenantRow[]; error?: string; detail?: string };
  if (!res.ok) {
    throw new Error(js.detail || js.error || `Failed to load tenants (${res.status})`);
  }
  return js.tenants ?? [];
}

/**
 * Scoped “view as” tenant for platform god admins (`app_metadata.god_admin` / `role: god_admin`).
 * Cookie is HTTP-only — selection syncs via `reload` after POST.
 */
export default function GodAdminTenantSwitcher() {
  const { branding, viewer } = useEffectiveBranding();
  const isGodAdmin = viewer?.godAdmin === true;

  const tenantsQuery = useQuery({
    queryKey: ADMIN_TENANTS_QUERY_KEY,
    queryFn: fetchAdminTenants,
    enabled: isGodAdmin,
    staleTime: 60_000,
  });

  const selected = useMemo(() => {
    if (!viewer?.scoped) return "";
    return branding?.id ? String(branding.id) : viewer.tenantId ?? "";
  }, [branding?.id, viewer?.scoped, viewer?.tenantId]);

  if (!isGodAdmin) {
    return null;
  }

  const tenants = tenantsQuery.data ?? [];
  const tenantError =
    tenantsQuery.isError && tenantsQuery.error instanceof Error
      ? tenantsQuery.error.message
      : null;

  return (
    <label className="mr-6 flex items-center gap-2 text-[12px] text-[#475569]">
      <span className="whitespace-nowrap font-semibold text-[#0F172A]">View as</span>
      <select
        aria-label="View as tenant"
        className="min-w-[180px] max-w-[260px] cursor-pointer truncate rounded-lg border border-[#cbd5e1] bg-white px-2 py-2 text-[12px] text-[#0F172A] shadow-inner disabled:opacity-60"
        value={selected}
        onChange={async (e) => {
          const tenantId = e.target.value.trim();
          await fetch("/api/admin/view-as-tenant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantId: tenantId ? tenantId : null,
            }),
          });
          window.location.reload();
        }}
      >
        <option value="">All tenants</option>
        {tenantsQuery.isLoading ? (
          <option value="" disabled>
            Loading tenants...
          </option>
        ) : null}
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {tenantError ? <span className="text-[11px] text-red-600">{tenantError}</span> : null}
    </label>
  );
}
