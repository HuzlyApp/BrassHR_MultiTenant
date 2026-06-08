"use client";

import { useEffect, useMemo, useState } from "react";

export type CandidateHeaderWorker = {
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  city?: string | null;
  state?: string | null;
};

export function useCandidateHeader(workerId: string | undefined) {
  const [worker, setWorker] = useState<CandidateHeaderWorker | null>(null);
  const [loading, setLoading] = useState(Boolean(workerId));

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!workerId) {
        setWorker(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/worker-checklist?workerId=${encodeURIComponent(workerId)}`
        );
        const json = (await res.json()) as { worker?: CandidateHeaderWorker };
        if (!cancelled) {
          setWorker(res.ok && json.worker ? json.worker : null);
        }
      } catch {
        if (!cancelled) setWorker(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [workerId]);

  const name = useMemo(() => {
    const n = `${worker?.first_name ?? ""} ${worker?.last_name ?? ""}`.trim();
    return n || "Applicant";
  }, [worker?.first_name, worker?.last_name]);

  const role = worker?.job_role?.trim() || "—";

  return { worker, name, role, loading };
}
