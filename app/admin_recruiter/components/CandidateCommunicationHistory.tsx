"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, MessageSquare, RefreshCw } from "lucide-react";

type CommunicationRow = {
  id: string;
  channel: "email" | "sms";
  recipient: string;
  subject: string | null;
  body: string;
  status: "sent" | "failed";
  error_message: string | null;
  created_at: string;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Props = {
  workerId: string;
  refreshKey?: number;
};

export default function CandidateCommunicationHistory({ workerId, refreshKey = 0 }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CommunicationRow[]>([]);

  const load = useCallback(async () => {
    if (!workerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/candidates/${encodeURIComponent(workerId)}/communications`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        communications?: CommunicationRow[];
        error?: string;
      };
      if (!res.ok) {
        setRows([]);
        setError(json.error || `Failed to load (${res.status})`);
        return;
      }
      setRows(json.communications ?? []);
    } catch {
      setRows([]);
      setError("Could not load communication history.");
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className="mx-auto mb-4 mt-0 w-full max-w-[1300px] rounded-lg border border-[#D1D5DB] bg-white">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-3">
        <h3 className="text-[16px] font-semibold text-[#111827]">Communication history</h3>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#0D9488] hover:underline disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No messages sent yet.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {row.channel === "email" ? (
                    <Mail className="h-4 w-4 text-teal-700" aria-hidden />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-teal-700" aria-hidden />
                  )}
                  <span className="font-medium capitalize text-slate-900">{row.channel}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.status === "sent"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {row.status}
                  </span>
                  <span className="text-xs text-slate-500">{formatWhen(row.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">To: {row.recipient}</p>
                {row.subject ? (
                  <p className="mt-1 font-medium text-slate-800">Subject: {row.subject}</p>
                ) : null}
                <p className="mt-1 whitespace-pre-wrap text-slate-700 line-clamp-4">{row.body}</p>
                {row.error_message ? (
                  <p className="mt-1 text-xs text-red-600">{row.error_message}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
