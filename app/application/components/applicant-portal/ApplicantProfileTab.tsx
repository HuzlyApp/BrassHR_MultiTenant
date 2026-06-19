"use client";

import { useSearchParams } from "next/navigation";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { useWorkerAccountOverview } from "./WorkerAccountContext";
import { WorkerAccountEmploymentTab } from "./WorkerAccountEmploymentTab";
import { WorkerAccountOverview } from "./WorkerAccountOverview";
import { WorkerAccountPersonalForm } from "./WorkerAccountPersonalForm";
import { WorkerAccountPlaceholderTab } from "./WorkerAccountPlaceholderTab";
import { WorkerAccountShell } from "./WorkerAccountShell";
import { parseWorkerAccountTab } from "./worker-account-types";

function ApplicantProfileTabBody() {
  const searchParams = useSearchParams();
  const activeTab = parseWorkerAccountTab(searchParams.get("tab"));
  const overview = useWorkerAccountOverview();
  const { authHeaders } = useApplicantPortal();

  async function handleDownloadDocument(source: "portal" | "required", id: string) {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch(
      `/api/applicant-portal/files?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`,
      { headers }
    );
    const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !payload.url) return;
    window.open(payload.url, "_blank", "noopener,noreferrer");
  }

  if (activeTab === "overview" && overview) {
    return <WorkerAccountOverview data={overview} onDownloadDocument={handleDownloadDocument} />;
  }

  if (activeTab === "personal") {
    return <WorkerAccountPersonalForm />;
  }

  if (activeTab === "employment" && overview) {
    return <WorkerAccountEmploymentTab profile={overview.profile} />;
  }

  if (activeTab === "emergency") {
    return (
      <WorkerAccountPlaceholderTab
        title="Emergency Contact"
        description="Add a person we can call in an emergency."
      />
    );
  }

  if (activeTab === "account") {
    return (
      <WorkerAccountPlaceholderTab
        title="Account Settings"
        description="Password and sign-in settings will be available here."
      />
    );
  }

  return null;
}

function ApplicantProfileTabFrame() {
  const searchParams = useSearchParams();
  const activeTab = parseWorkerAccountTab(searchParams.get("tab"));

  return (
    <WorkerAccountShell activeTab={activeTab}>
      <ApplicantProfileTabBody />
    </WorkerAccountShell>
  );
}

export function ApplicantProfileTab() {
  return <ApplicantProfileTabFrame />;
}
