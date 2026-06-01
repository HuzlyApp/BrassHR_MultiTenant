"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SuccessModal from "@/app/components/SuccessModal";
import {
  filterTenantConsoleRows,
  tenantStatusLabel,
  type TenantStatusFilter,
} from "@/lib/godadmin/filter-tenant-console-rows";
import {
  formatTenantConsoleTimestamp,
  isTenantDeactivated,
  type TenantConsoleRow,
} from "@/lib/godadmin/tenant-account-status";
import { supabaseBrowser } from "@/lib/supabase-browser";

function StatusBadge({ status }: { status: TenantConsoleRow["status"] }) {
  const isActive = status === "active";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
      }`}
    >
      {tenantStatusLabel(status)}
    </span>
  );
}

const VIEW_ERROR_MESSAGES: Record<string, string> = {
  "invalid-tenant": "Could not open tenant view: invalid tenant id.",
  "tenant-not-found": "Could not open tenant view: tenant not found.",
  "tenant-inactive": "Only active tenants can be viewed.",
  "view-failed": "Could not open tenant view. Try again.",
};

export default function TenantsConsolePage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Loading tenants…
        </div>
      }
    >
      <TenantsConsoleContent />
    </Suspense>
  );
}

function TenantsConsoleContent() {
  const searchParams = useSearchParams();
  const [tenants, setTenants] = useState<TenantConsoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TenantStatusFilter>("all");

  const [confirmTenant, setConfirmTenant] = useState<TenantConsoleRow | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/godadmin/tenants", {
        cache: "no-store",
        headers: await authHeaders(),
      });
      const body = (await res.json().catch(() => ({}))) as {
        tenants?: TenantConsoleRow[];
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setTenants([]);
        setError(body.detail || body.error || `Failed to load tenants (${res.status})`);
        return;
      }
      setTenants(body.tenants ?? []);
    } catch {
      setTenants([]);
      setError("Network error while loading tenants.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    const code = searchParams.get("error")?.trim();
    if (!code) return;
    setError(VIEW_ERROR_MESSAGES[code] ?? VIEW_ERROR_MESSAGES["view-failed"]);
  }, [searchParams]);

  const filtered = useMemo(
    () => filterTenantConsoleRows(tenants, { search, status: statusFilter }),
    [tenants, search, statusFilter]
  );

  const handleConfirmDeactivate = async () => {
    if (!confirmTenant) return;
    setDeactivating(true);
    setDeactivateError(null);
    try {
      const res = await fetch(`/api/godadmin/tenants/${confirmTenant.id}/deactivate`, {
        method: "PATCH",
        headers: await authHeaders(),
      });
      const body = (await res.json().catch(() => ({}))) as {
        tenant?: TenantConsoleRow;
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setDeactivateError(body.detail || body.error || `Deactivation failed (${res.status})`);
        return;
      }
      if (body.tenant) {
        setTenants((prev) => prev.map((t) => (t.id === body.tenant!.id ? body.tenant! : t)));
      } else {
        await loadTenants();
      }
      setConfirmTenant(null);
      setSuccessMessage(`Tenant "${confirmTenant.name}" has been deactivated.`);
      setSuccessOpen(true);
    } catch {
      setDeactivateError("Network error while deactivating tenant.");
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Tenants Console</h2>
        <p className="mt-1 text-sm text-slate-600">
          View and manage all tenant accounts. Use View to open a tenant&apos;s Admin Recruiter
          dashboard in read-only context. Deactivation preserves data for audit and history.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <label className="block flex-1 text-sm">
            <span className="mb-1 block font-medium text-slate-700">Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tenant name or slug…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </label>
          <label className="block w-full text-sm sm:w-48">
            <span className="mb-1 block font-medium text-slate-700">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TenantStatusFilter)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => void loadTenants()}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Loading tenants…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-700">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          {tenants.length === 0
            ? "No tenant accounts found."
            : "No tenants match your search or filter."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Tenant name</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Slug</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Last updated</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((tenant) => {
                  const deactivated = isTenantDeactivated(tenant.status);
                  return (
                    <tr key={tenant.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900">{tenant.name || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{tenant.slug || "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={tenant.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatTenantConsoleTimestamp(tenant.created_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatTenantConsoleTimestamp(tenant.updated_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          {!deactivated ? (
                            <Link
                              href={`/godadmin/tenants/${tenant.id}/view`}
                              className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100"
                            >
                              View
                            </Link>
                          ) : null}
                          <button
                            type="button"
                            disabled={deactivated || deactivating}
                            onClick={() => {
                              setDeactivateError(null);
                              setConfirmTenant(tenant);
                            }}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent"
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmTenant ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="presentation"
          onClick={() => !deactivating && setConfirmTenant(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-tenant-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="deactivate-tenant-title" className="text-lg font-semibold text-slate-900">
              Deactivate tenant?
            </h3>
            <p className="mt-3 text-sm text-slate-600">
              Are you sure you want to deactivate this tenant account? Users under this tenant may
              lose access.
            </p>
            <p className="mt-2 text-sm font-medium text-slate-800">{confirmTenant.name}</p>
            {deactivateError ? (
              <p className="mt-3 text-sm text-red-600">{deactivateError}</p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deactivating}
                onClick={() => setConfirmTenant(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deactivating}
                onClick={() => void handleConfirmDeactivate()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deactivating ? "Deactivating…" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Tenant deactivated"
        message={successMessage}
        autoCloseMs={4000}
      />
    </div>
  );
}
