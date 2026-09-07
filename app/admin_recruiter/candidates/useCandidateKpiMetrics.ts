"use client";

import { useEffect, useState } from "react";
import {
  buildCandidateKpiCardsFromMetrics,
  normalizeCandidateKpiMetricsPayload,
  type CandidateKpiMetricsPayload,
} from "@/lib/workers/candidate-kpi-metrics";
import type { CandidateKpiCard } from "@/app/admin_recruiter/candidates/candidate-kpis";

export function useCandidateKpiMetrics(options?: {
  status?: string;
  enabled?: boolean;
}): {
  kpiCards: CandidateKpiCard[];
  metrics: CandidateKpiMetricsPayload | null;
  loading: boolean;
  refresh: () => void;
} {
  const status = options?.status?.trim() || "";
  const enabled = options?.enabled !== false;
  const [metrics, setMetrics] = useState<CandidateKpiMetricsPayload | null>(null);
  const [kpiCards, setKpiCards] = useState<CandidateKpiCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        const res = await fetch(`/api/workers/metrics?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) throw new Error(data?.error || "Failed to load metrics");
        const nextMetrics = normalizeCandidateKpiMetricsPayload(data?.metrics);
        setMetrics(nextMetrics);
        setKpiCards(
          Array.isArray(data?.cards) && data.cards.length
            ? (data.cards as CandidateKpiCard[])
            : buildCandidateKpiCardsFromMetrics(nextMetrics)
        );
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setMetrics(null);
        setKpiCards([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [status, enabled, nonce]);

  return {
    kpiCards,
    metrics,
    loading,
    refresh: () => setNonce((n) => n + 1),
  };
}
