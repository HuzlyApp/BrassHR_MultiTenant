"use client";

import { WorkerAccountOverview } from "@/app/application/components/applicant-portal/WorkerAccountOverview";
import { useWorkerAccountOverview } from "@/app/application/components/applicant-portal/WorkerAccountContext";
import { AdminWorkerAccountShell } from "../../components/AdminWorkerAccountShell";

function AdminWorkerProfileBody({ workerId }: { workerId: string }) {
  const overview = useWorkerAccountOverview();

  async function handleDownloadDocument(source: "portal" | "required", id: string) {
    const res = await fetch(
      `/api/admin/worker-account-files?workerId=${encodeURIComponent(workerId)}&source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`
    );
    const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !payload.url) return;
    window.open(payload.url, "_blank", "noopener,noreferrer");
  }

  if (!overview) return null;

  return <WorkerAccountOverview data={overview} onDownloadDocument={handleDownloadDocument} />;
}

export function AdminWorkerProfileClient({ workerId }: { workerId: string }) {
  return (
    <AdminWorkerAccountShell workerId={workerId}>
      <AdminWorkerProfileBody workerId={workerId} />
    </AdminWorkerAccountShell>
  );
}
