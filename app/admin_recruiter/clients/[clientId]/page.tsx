"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useModulePermission } from "@/lib/admin/hooks/use-staff-module-access";
import { parseContactPersonFromAbout } from "@/lib/facilities/address";

type Client = { id: string; company_name: string; address: string | null; city: string | null; state: string | null; zip_code: string | null; archived_at: string | null };
type Facility = { id: string; name: string; address: string | null; phone: string | null; about: string | null; archived_at: string | null };

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { canEdit } = useModulePermission("organization");
  const [client, setClient] = useState<Client | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load client.");
      setClient(payload.client); setFacilities(payload.facilities ?? []); setName(payload.client.company_name);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load client."); }
    finally { setLoading(false); }
  }, [clientId]);
  useEffect(() => { void load(); }, [load]);

  async function update(action: "edit" | "archive" | "restore") {
    if (!client || busy || !canEdit) return;
    if (action !== "edit" && !window.confirm(`${action === "archive" ? "Archive" : "Restore"} ${client.company_name}? Facilities and history will be preserved.`)) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, companyName: name }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update client.");
      setEditing(false); await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not update client."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5 p-4 sm:p-8">
    <Link href="/admin_recruiter/clients" className="text-sm underline">Back to clients</Link>
    {error ? <div role="alert" className="text-sm text-red-700">{error}<button type="button" className="ml-3 underline" onClick={() => void load()}>Try again</button></div> : null}
    {loading ? <p role="status">Loading client…</p> : client ? <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{client.company_name}{client.archived_at ? " (Archived)" : ""}</h1>
        {canEdit ? <div className="flex gap-2">
          {!client.archived_at ? <button type="button" disabled={busy} className="rounded border px-3 py-2" onClick={() => setEditing(true)}>Edit client</button> : null}
          <button type="button" disabled={busy} className="rounded border px-3 py-2" onClick={() => void update(client.archived_at ? "restore" : "archive")}>{client.archived_at ? "Restore client" : "Archive client"}</button>
        </div> : null}
      </div>
      {editing ? <form className="space-y-3 rounded-xl border bg-white p-4" onSubmit={(event) => { event.preventDefault(); void update("edit"); }}>
        <label className="block text-sm">Company name<input className="mt-1 block w-full rounded border px-3 py-2" required maxLength={120} minLength={2} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <button type="submit" disabled={busy} className="rounded border px-3 py-2">{busy ? "Saving…" : "Save client"}</button>
        <button type="button" disabled={busy} className="ml-3 underline" onClick={() => { setName(client.company_name); setEditing(false); }}>Cancel</button>
      </form> : null}
      <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Client address</h2><p className="mt-2 text-sm">{[client.address, client.city, client.state, client.zip_code].filter(Boolean).join(", ") || "No address on file"}</p></section>
      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">Facilities and contacts</h2><Link href={`/admin_recruiter/facilities?client=${encodeURIComponent(clientId)}`} className="text-sm underline">Manage facilities</Link></div>
        {facilities.length ? <ul className="divide-y">{facilities.map((facility) => <li key={facility.id} className="space-y-1 py-3 text-sm">
          <p className="font-medium">{facility.name}{facility.archived_at ? " (Archived)" : ""}</p>
          <p>{facility.address || "No address on file"}</p>
          {parseContactPersonFromAbout(facility.about) ? <p>Contact: {parseContactPersonFromAbout(facility.about)}</p> : null}
          {facility.phone ? <a className="underline" href={`tel:${facility.phone}`}>{facility.phone}</a> : null}
        </li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No facilities linked to this client.</p>}
      </section>
    </> : null}
  </div>;
}
