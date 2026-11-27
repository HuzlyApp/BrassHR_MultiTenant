"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { CANDIDATE_BTN_NAVY, CANDIDATE_BTN_OUTLINE } from "./candidate-portal-ui";
import type { WorkerJobApplicationListItem } from "@/lib/applicant-portal/list-worker-job-applications";
import { applicationCurrentStageMeta } from "@/lib/jobs/application-status";
import { applicationPath } from "@/lib/tenant/with-tenant";

type SavedResume = { id: string; originalFileName: string; parsingStatus: string };

export function CandidateApplicationDetail({ applicationId, tenant }: { applicationId: string; tenant: string | null }) {
  const { sessionReady, authHeaders } = useApplicantPortal();
  const [application, setApplication] = useState<WorkerJobApplicationListItem | null>(null);
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resumeId, setResumeId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) throw new Error("You need to sign in again.");
    const [appsResponse, resumesResponse] = await Promise.all([
      fetch("/api/applicant-portal/applications", { headers, cache: "no-store" }),
      fetch("/api/applicant-portal/resumes", { headers, cache: "no-store" }),
    ]);
    const apps = await appsResponse.json();
    const saved = await resumesResponse.json();
    if (!appsResponse.ok || !resumesResponse.ok) throw new Error(apps.error || saved.error || "Could not load application.");
    const selected = (apps.applications as WorkerJobApplicationListItem[]).find((row) => row.id === applicationId);
    if (!selected) throw new Error("Application not found.");
    setApplication(selected);
    setResumes(saved.resumes ?? []);
  }, [applicationId, authHeaders]);

  useEffect(() => {
    if (!sessionReady) return;
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load application."))
      .finally(() => setLoading(false));
  }, [load, sessionReady]);

  async function updateResume(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const body = new FormData();
      if (file) body.set("file", file);
      else body.set("resumeId", resumeId);
      const response = await fetch(`/api/applicant-portal/applications/${encodeURIComponent(applicationId)}/resume`, { method: "POST", headers, body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update resume.");
      await load();
      setMessage(payload.parseStatus === "failed" ? "The file could not be read. Please upload a readable resume." : "Resume updated for this application.");
      setFile(null);
      setResumeId("");
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update resume.");
    } finally {
      setBusy(false);
    }
  }

  async function openResume() {
    if (!application?.resume) return;
    setError("");
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const response = await fetch(`/api/applicant-portal/resumes/${encodeURIComponent(application.resume.id)}`, { headers, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.url) throw new Error(payload.error || "Could not open resume.");
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open resume.");
    }
  }

  const stage = application ? applicationCurrentStageMeta(application.status, application.statusName) : null;
  return (
    <section className="space-y-6 rounded-xl border border-[#E5E7EB] bg-white p-6">
      <Link className={CANDIDATE_BTN_OUTLINE} href={applicationPath("/application/candidate/applications", tenant)}>Back to applications</Link>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {loading ? <p>Loading application…</p> : application && stage ? (
        <>
          <div>
            <h2 className="text-xl font-semibold">{application.jobTitle}</h2>
            <p className="text-sm text-[#64748B]">{application.companyName} · {application.location || "Location not specified"}</p>
          </div>
          <div className="rounded-lg bg-[#F9FAFB] p-4">
            <h3 className="text-sm font-medium text-[#64748B]">Current application stage</h3>
            <p className="mt-2 font-semibold">{stage.label}</p>
            {application.statusGroupName ? <p className="text-sm">{application.statusGroupName}</p> : null}
            <p className="mt-2 text-sm text-[#64748B]">{application.statusNote || application.statusGroupDescription || stage.subtitle}</p>
          </div>
          <div>
            <h3 className="font-semibold">Resume for this job</h3>
            {application.resume ? <button type="button" onClick={() => void openResume()} className="mt-2 text-sm underline">{application.resume.fileName}</button> : <p className="mt-2 text-sm">No resume attached.</p>}
            <p className="mt-2 text-sm text-[#64748B]">Upload an updated resume or choose one from your Resumes page. This change applies to this job only.</p>
          </div>
          <form onSubmit={(event) => void updateResume(event)} className="space-y-4">
            <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
              <label className="block text-sm font-medium">Upload a replacement resume
                <input type="file" accept=".pdf,.doc,.docx" className="mt-2 block w-full text-sm" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResumeId(""); setMessage(""); }} />
              </label>
              <label className="block text-sm font-medium">Or use a saved resume
                <select value={resumeId} onChange={(event) => { setResumeId(event.target.value); setFile(null); setMessage(""); const input = event.target.form?.querySelector<HTMLInputElement>('input[type="file"]'); if (input) input.value = ""; }} className="mt-2 block w-full rounded-lg border border-[#E5E7EB] p-2">
                  <option value="">Choose a saved resume</option>
                  {resumes.map((resume) => <option key={resume.id} value={resume.id} disabled={resume.parsingStatus !== "completed"}>{resume.originalFileName}{resume.parsingStatus !== "completed" ? " (not ready)" : ""}</option>)}
                </select>
              </label>
              <button type="submit" disabled={!file && !resumeId} className={CANDIDATE_BTN_NAVY}>{busy ? "Updating…" : "Update job resume"}</button>
            </fieldset>
          </form>
          {message ? <p role="status" className="text-sm">{message}</p> : null}
        </>
      ) : null}
    </section>
  );
}
