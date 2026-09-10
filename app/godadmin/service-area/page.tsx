"use client";

import { useEffect, useState } from "react";

type Policy = {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  match_type: string;
};

type WaitlistRow = {
  id: string;
  email: string;
  city: string | null;
  state: string | null;
  source: string;
  created_at: string;
};

export default function GodAdminServiceAreaPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [reason, setReason] = useState("");

  async function load() {
    const [policyRes, waitRes] = await Promise.all([
      fetch("/api/godadmin/service-area/policies"),
      fetch("/api/godadmin/service-area/waitlist"),
    ]);
    const policyJson = await policyRes.json().catch(() => ({}));
    const waitJson = await waitRes.json().catch(() => ({}));
    if (!policyRes.ok) setError(policyJson.error ?? "Failed to load policies");
    setPolicies(policyJson.policies ?? []);
    setWaitlist(waitJson.waitlist ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Service area</h1>
        <p className="mt-1 text-sm text-slate-600">
          Platform holds and signup waitlist. Opening a state is a deactivate, not a deploy.
        </p>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Platform policies</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {policies.map((policy) => (
            <li key={policy.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">{policy.label}</p>
                <p className="text-xs text-slate-500">
                  {policy.code} · {policy.match_type} · {policy.is_active ? "active" : "inactive"}
                </p>
              </div>
              {policy.is_active ? (
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  onClick={async () => {
                    await fetch(`/api/godadmin/service-area/policies/${policy.id}/deactivate`, {
                      method: "POST",
                    });
                    void load();
                  }}
                >
                  Deactivate
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Activate waitlisted tenant</h2>
        <p className="mt-1 text-xs text-slate-500">
          Primary work location must already be allowed. This cannot authorize a hold worksite.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="Tenant ID"
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
          />
          <input
            className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <button
            type="button"
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm text-white"
            onClick={async () => {
              const res = await fetch("/api/godadmin/service-area/overrides", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenantId, reason }),
              });
              if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                setError(payload.error?.messageKey || payload.error || "Override failed");
                return;
              }
              setTenantId("");
              setReason("");
              void load();
            }}
          >
            Activate
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Waitlist</h2>
        <ul className="mt-3 max-h-[480px] overflow-auto text-sm">
          {waitlist.map((row) => (
            <li key={row.id} className="border-b border-slate-100 py-2">
              <span className="font-medium">{row.email}</span>
              <span className="ml-2 text-slate-500">
                {row.city} {row.state} · {row.source}
              </span>
            </li>
          ))}
          {waitlist.length === 0 ? <li className="text-slate-500">No waitlist entries yet.</li> : null}
        </ul>
      </section>
    </main>
  );
}
