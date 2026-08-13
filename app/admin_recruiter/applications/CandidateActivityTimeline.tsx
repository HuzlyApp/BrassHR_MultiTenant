"use client";

import { useEffect, useState } from "react";

type ActivityItem = {
  id: string;
  at: string;
  title: string;
  detail: string;
  actor: string | null;
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CandidateActivityTimeline({
  applicationId,
  reloadToken = 0,
}: {
  applicationId: string;
  reloadToken?: number;
}) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/admin/job-applications/${applicationId}/activity`, { credentials: "include" })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { items?: ActivityItem[]; error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error || "Failed to load activity");
        setItems(json.items ?? []);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load activity");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, reloadToken]);

  if (loading) {
    return <p className="px-5 py-8 text-sm text-[#64748B]">Loading activity…</p>;
  }
  if (error) {
    return <p className="px-5 py-8 text-sm text-red-600">{error}</p>;
  }
  if (!items.length) {
    return <p className="px-5 py-8 text-sm text-[#64748B]">No activity yet for this application.</p>;
  }

  return (
    <ol className="space-y-4 px-5 py-5">
      {items.map((item) => (
        <li key={item.id} className="border-l-2 border-[#CBD5E1] pl-4">
          <p className="text-xs font-medium text-[#94A3B8]">{formatWhen(item.at)}</p>
          <p className="mt-0.5 text-sm font-semibold text-[#0F172A]">{item.title}</p>
          <p className="mt-0.5 text-sm text-[#475569]">{item.detail}</p>
          {item.actor ? <p className="mt-0.5 text-xs text-[#64748B]">{item.actor}</p> : null}
        </li>
      ))}
    </ol>
  );
}
