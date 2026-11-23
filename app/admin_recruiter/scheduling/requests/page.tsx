"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useModulePermission } from "@/lib/admin/hooks/use-staff-module-access";

type TimeOffRequest = {
  id: string; start_date: string; end_date: string; reason: string; off_type: string | null; status: string;
  worker?: { first_name: string | null; last_name: string | null } | null;
};

export default function TimeOffRequestsPage() {
  const { canEdit } = useModulePermission("scheduling");
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/v1/worker-requests?type=time_off&status=${status}&page=${page}&limit=25`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load time-off requests.");
      setRequests(data.requests ?? []); setTotal(data.total ?? 0);
    } catch (error) { setRequests([]); setTotal(0); setError(error instanceof Error ? error.message : "Could not load time-off requests."); }
    finally { setLoading(false); }
  }, [page, status]);
  useEffect(() => { void load(); }, [load]);

  async function review(id: string, decision: "approve" | "reject") {
    if (busy || !canEdit) return;
    setBusy(id); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/v1/worker-requests/${encodeURIComponent(id)}/${decision}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not review this request.");
      setMessage(decision === "approve" ? "Time-off request approved." : "Time-off request rejected.");
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not review this request."); }
    finally { setBusy(null); }
  }

  return <main className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-8">
    <Link href="/admin_recruiter/home" className="text-sm text-[color:var(--brand-primary)]">Back to dashboard</Link>
    <h1 className="text-2xl font-semibold">Time-off requests</h1>
    <label className="flex items-center gap-3 text-sm">Status<select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="rounded-lg border bg-white p-2">
      <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
    </select></label>
    {message ? <p role="status" className="text-green-800">{message}</p> : null}
    {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">{error} <button type="button" onClick={() => void load()} className="underline">Try again</button></div> : null}
    {loading ? <p role="status">Loading time-off requests…</p> : !error && requests.length === 0 ? <p>No {status} time-off requests.</p> : requests.length > 0 ? requests.map((request) => <article key={request.id} className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="font-semibold">{[request.worker?.first_name, request.worker?.last_name].filter(Boolean).join(" ") || "Worker"}</h2>
      <p className="text-sm">{request.off_type || "Time off"} · {request.start_date} – {request.end_date}</p>
      <p className="whitespace-pre-wrap break-words text-sm">{request.reason}</p>
      {request.status === "pending" && canEdit ? <div className="flex flex-wrap gap-3">
        <button type="button" disabled={Boolean(busy)} onClick={() => void review(request.id, "approve")} className="rounded-lg bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void review(request.id, "reject")} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Reject</button>
      </div> : null}
    </article>) : null}
    <nav aria-label="Time-off request pages" className="flex items-center gap-4 text-sm">
      <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button>
      <span>Page {page} of {Math.max(1, Math.ceil(total / 25))}</span>
      <button type="button" disabled={page * 25 >= total || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
    </nav>
  </main>;
}
