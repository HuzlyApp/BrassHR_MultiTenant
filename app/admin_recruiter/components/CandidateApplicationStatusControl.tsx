"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";

type StatusOption = {
  id: string;
  name: string;
  systemKey: string | null;
};

type StatusHistoryItem = {
  id: string;
  fromStatus: { id: string | null; name: string | null };
  toStatus: { id: string | null; name: string };
  note: string | null;
  changedBy: { id: string | null; name: string | null };
  changedAt: string;
};

type ApplicationContext = {
  applicationId: string | null;
  ambiguous: boolean;
  statusId: string | null;
  statusName: string | null;
  jobTitle: string | null;
};

type CandidateApplicationStatusControlProps = {
  workerId: string;
  /** Fallback label when no application status exists (e.g. worker pipeline label). */
  fallbackStatus?: string | null;
  compact?: boolean;
  onStatusChanged?: (next: { statusName: string; statusId: string }) => void;
};

function formatHistoryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CandidateApplicationStatusControl({
  workerId,
  fallbackStatus,
  compact = true,
  onStatusChanged,
}: CandidateApplicationStatusControlProps) {
  const [ctx, setCtx] = useState<ApplicationContext | null>(null);
  const [options, setOptions] = useState<StatusOption[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState<StatusOption | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!workerId) return;
    setLoading(true);
    try {
      const [ctxRes, statusRes] = await Promise.all([
        fetch(`/api/admin/workers/${encodeURIComponent(workerId)}/application-status`, {
          cache: "no-store",
        }),
        fetch("/api/admin/application-statuses?activeOnly=1", { cache: "no-store" }),
      ]);
      const ctxPayload = await ctxRes.json();
      const statusPayload = await statusRes.json();
      if (!ctxRes.ok) throw new Error(ctxPayload.error || "Failed to load application status");
      if (!statusRes.ok) throw new Error(statusPayload.error || "Failed to load statuses");

      setCtx({
        applicationId: ctxPayload.applicationId ?? null,
        ambiguous: Boolean(ctxPayload.ambiguous),
        statusId: ctxPayload.status?.id ?? null,
        statusName: ctxPayload.status?.name ?? null,
        jobTitle: ctxPayload.jobTitle ?? null,
      });
      setOptions(
        ((statusPayload.statuses ?? []) as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          name: String(row.name),
          systemKey: (row.systemKey as string | null) ?? null,
        }))
      );
    } catch (error) {
      console.error(error);
      setCtx(null);
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const label =
    ctx?.statusName?.trim() ||
    fallbackStatus?.trim() ||
    (loading ? "…" : "No status");

  function beginChange(option: StatusOption) {
    if (!ctx?.applicationId) {
      toast.error("This candidate has no job application to update.");
      return;
    }
    if (ctx.ambiguous) {
      toast.error("This candidate has multiple applications. Update status from Applications.");
      return;
    }
    if (option.id === ctx.statusId) {
      setMenuOpen(false);
      return;
    }
    setMenuOpen(false);
    setPending(option);
    setNote("");
  }

  async function confirmChange() {
    if (!ctx?.applicationId || !pending) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(ctx.applicationId)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            statusId: pending.id,
            note: note.trim() || undefined,
          }),
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to update status");

      const nextName = String(payload.application?.statusName ?? pending.name);
      const nextId = String(payload.application?.statusId ?? pending.id);
      setCtx((current) =>
        current
          ? {
              ...current,
              statusId: nextId,
              statusName: nextName,
            }
          : current
      );
      setPending(null);
      setNote("");
      toast.success(
        payload.unchanged ? "Status unchanged" : `Status updated to ${nextName}`
      );
      onStatusChanged?.({ statusName: nextName, statusId: nextId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  const chipClass = compact
    ? "inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 truncate rounded-md border border-[#D1D5DB] bg-white px-1.5 text-center text-[10px] font-semibold leading-4 text-[#111827] min-[700px]:max-w-none min-[700px]:flex-none min-[700px]:px-3 min-[700px]:text-xs disabled:opacity-50"
    : "inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 text-sm text-[#334155] disabled:opacity-50";

  return (
    <>
      <div className="relative min-w-0 flex-1 min-[700px]:flex-none">
        <button
          type="button"
          disabled={loading || busy || !ctx?.applicationId}
          onClick={() => setMenuOpen((open) => !open)}
          className={chipClass}
          title={
            ctx?.ambiguous
              ? "Multiple applications — open Applications to change status"
              : ctx?.jobTitle
                ? `Application status for ${ctx.jobTitle}`
                : "Change application status"
          }
        >
          <span className="min-w-0 truncate">{label}</span>
          {ctx?.applicationId && !ctx.ambiguous ? (
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${menuOpen ? "rotate-180" : ""}`} />
          ) : null}
        </button>
        {menuOpen ? (
          <div className="absolute right-0 z-30 mt-1 max-h-64 min-w-[12rem] overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => beginChange(option)}
                className="flex min-h-9 w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
              >
                <span>{option.name}</span>
                {option.id === ctx?.statusId ? (
                  <Check className="h-4 w-4 text-[color:var(--brand-primary)]" />
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="candidate-change-status-title"
            className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xl"
          >
            <h2
              id="candidate-change-status-title"
              className="text-lg font-semibold text-[#0F172A]"
            >
              Change Status
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              {label} → {pending.name}
            </p>
            <label className="mt-4 block space-y-1.5">
              <span className="text-sm font-medium text-[#0F172A]">Note (optional)</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                className="w-full resize-none rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#334155] outline-none"
                placeholder="Add context for this status change…"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPending(null);
                  setNote("");
                }}
                className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#334155]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmChange()}
                className="h-10 rounded-xl bg-[#012352] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Updating…" : "Update Status"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function CandidateStatusHistoryPanel({
  workerId,
  layout = "page",
}: {
  workerId: string;
  layout?: "page" | "sidebar";
}) {
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!workerId) return;
      setLoading(true);
      setError(null);
      try {
        const ctxRes = await fetch(
          `/api/admin/workers/${encodeURIComponent(workerId)}/application-status`,
          { cache: "no-store" }
        );
        const ctxPayload = await ctxRes.json();
        if (!ctxRes.ok) throw new Error(ctxPayload.error || "Failed to load status");
        const appId = typeof ctxPayload.applicationId === "string" ? ctxPayload.applicationId : null;
        if (cancelled) return;
        setApplicationId(appId);
        if (!appId) {
          setHistory([]);
          return;
        }
        const histRes = await fetch(
          `/api/admin/job-applications/${encodeURIComponent(appId)}/status-history`,
          { cache: "no-store" }
        );
        const histPayload = await histRes.json();
        if (!histRes.ok) throw new Error(histPayload.error || "Failed to load history");
        if (!cancelled) {
          setHistory((histPayload.history ?? []) as StatusHistoryItem[]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load status history");
          setHistory([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [workerId]);

  if (!applicationId && !loading) {
    return null;
  }

  return (
    <section
      className={
        layout === "page"
          ? "mb-6 rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-5"
          : "mb-4 rounded-xl border border-[#E5E7EB] bg-white p-3"
      }
    >
      <h3 className="text-sm font-semibold text-[#0F172A]">Status History</h3>
      {loading ? (
        <p className="mt-2 text-xs text-[#94A3B8]">Loading history…</p>
      ) : error ? (
        <p className="mt-2 text-xs text-[#B91C1C]">{error}</p>
      ) : history.length === 0 ? (
        <p className="mt-2 text-xs text-[#94A3B8]">No status changes yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {history.map((entry) => (
            <div key={entry.id} className="border-l-2 border-[#CBD5E1] pl-3">
              <p className="text-sm font-medium text-[#0F172A]">{entry.toStatus.name}</p>
              <p className="mt-0.5 text-xs text-[#94A3B8]">
                {formatHistoryDate(entry.changedAt)} · {entry.changedBy.name || "System"}
              </p>
              {entry.fromStatus.name ? (
                <p className="mt-0.5 text-xs text-[#64748B]">From {entry.fromStatus.name}</p>
              ) : (
                <p className="mt-0.5 text-xs text-[#64748B]">Application created</p>
              )}
              {entry.note?.trim() ? (
                <p className="mt-1 text-xs leading-5 text-[#475569]">{entry.note}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
