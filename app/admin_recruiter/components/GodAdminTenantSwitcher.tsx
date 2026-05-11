"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type TenantRow = { id: string; name: string; slug: string };

/**
 * Scoped “view as” tenant for platform god admins (`app_metadata.god_admin` / `role: god_admin`).
 * Cookie is HTTP-only — selection syncs via `reload` after POST.
 */
export default function GodAdminTenantSwitcher() {
  const [isGodAdmin, setIsGodAdmin] = useState(false);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      const accessToken = session?.access_token ?? null;

      const authHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

      const syncRes = await fetch("/api/admin/effective-branding", {
        cache: "no-store",
        headers: authHeaders,
      });
      const sync = (await syncRes.json().catch(() => ({}))) as {
        branding?: { id?: string | null };
        viewer?: { scoped?: boolean; godAdmin?: boolean };
        error?: string;
        detail?: string;
      };
      if (!alive) return;
      const god = sync.viewer?.godAdmin === true;
      setIsGodAdmin(god);
      if (!god) return;

      setSelected(sync.viewer?.scoped && sync.branding?.id ? String(sync.branding.id) : "");

      setLoadingTenants(true);
      setTenantError(null);
      try {
        const tr = await fetch("/api/admin/tenants", {
          cache: "no-store",
          headers: authHeaders,
        });
        const js = (await tr.json().catch(() => ({}))) as {
          tenants?: TenantRow[];
          error?: string;
          detail?: string;
        };
        if (process.env.NODE_ENV !== "production") {
          console.info("[GodAdminTenantSwitcher] /api/admin/tenants", {
            status: tr.status,
            payload: js,
          });
        }
        if (!alive) return;
        if (!tr.ok) {
          setTenants([]);
          if (process.env.NODE_ENV !== "production") {
            setTenantError(js.detail || js.error || `Failed to load tenants (${tr.status})`);
          }
          return;
        }
        setTenants((js.tenants as TenantRow[]) ?? []);
      } finally {
        if (alive) setLoadingTenants(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!isGodAdmin) {
    return null;
  }

  return (
    <label className="mr-6 flex items-center gap-2 text-[12px] text-[#475569]">
      <span className="whitespace-nowrap font-semibold text-[#0F172A]">View as</span>
      <select
        aria-label="View as tenant"
        className="min-w-[180px] max-w-[260px] cursor-pointer truncate rounded-lg border border-[#cbd5e1] bg-white px-2 py-2 text-[12px] text-[#0F172A] shadow-inner disabled:opacity-60"
        value={selected}
        onChange={async (e) => {
          const tenantId = e.target.value.trim();
          setSelected(tenantId);
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
        {loadingTenants ? (
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
