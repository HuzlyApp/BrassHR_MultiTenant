"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCandidateDetailChromeActive } from "../../../../components/CandidateDetailChrome";
import DetailedCandidateHeader from "../../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../../components/DetailedTabs";
import CandidateDetailLoader from "../../../../components/CandidateDetailLoader";
import ResumePdfPreview from "../../../../components/ResumePdfPreview";
// import ProfileSubTabs from "../../../../components/ProfileSubTabs";
import {
  fetchStaffDetailJson,
  workerProfileApiUrl,
} from "@/lib/admin/staff-detail-fetch-cache";
import { resumeDisplayFileName } from "@/lib/resume/resume-display-file-name";
import {
  Briefcase,
  Calendar,
  LogOut,
  Menu,
  Settings,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";

type WorkerProfilePayload = {
  worker: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email?: string | null;
    job_role: string | null;
    city: string | null;
    state: string | null;
    status?: string | null;
    status_label?: string;
    profile_photo_url?: string | null;
    job_id?: string | null;
  };
  job_id?: string | null;
  job_requisition_id?: string | null;
  requirements: {
    resume_path: string | null;
    resume_url: string | null;
  } | null;
  error?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

export default function NewApplicantProfileResumePage() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;
  const chromeActive = useCandidateDetailChromeActive();

  const isWorkerRoute = pathname?.startsWith("/admin_recruiter/workers/") ?? false;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<WorkerProfilePayload | null>(null);
  const [resumePreviewError, setResumePreviewError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (!applicantId) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchStaffDetailJson<WorkerProfilePayload>(
          workerProfileApiUrl(applicantId, null, "resume")
        );
        if (!result.ok) throw new Error(result.payload.error || "Failed to load profile");
        setProfile(result.payload);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to load");
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    void run();
  }, [applicantId]);

  const w = profile?.worker;
  const resumePath = profile?.requirements?.resume_path ?? null;
  const resumeUrl = profile?.requirements?.resume_url ?? null;

  const candidateName = useMemo(() => {
    const n = `${w?.first_name ?? ""} ${w?.last_name ?? ""}`.trim();
    return n || "Applicant";
  }, [w?.first_name, w?.last_name]);
  const candidateRole = w?.job_role?.trim() || "—";
  const candidateStatus = w?.status_label;
  const pageLoading = loading;
  const candidateLocation = useMemo(() => {
    const parts = [w?.city ?? "", w?.state ?? ""].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  }, [w?.city, w?.state]);

  const lowerPath = resumePath?.toLowerCase() ?? "";
  const lowerUrl = resumeUrl?.toLowerCase() ?? "";
  const canEmbedPreview =
    lowerPath.endsWith(".pdf") ||
    lowerPath.endsWith(".docx") ||
    lowerUrl.includes(".pdf") ||
    lowerUrl.includes(".docx");
  const previewUrl = applicantId
    ? `/api/admin/worker-resume-preview?workerId=${encodeURIComponent(applicantId)}`
    : null;
  const embedUrl = previewUrl ?? resumeUrl;

  useEffect(() => {
    setResumePreviewError(null);
  }, [resumeUrl, applicantId]);

  // Mobile: embedded PDF layout is unreliable — open resume in a new tab instead.
  useEffect(() => {
    if (loading || error || !resumeUrl || !applicantId) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;

    const key = `resume-mobile-open:${applicantId}`;
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
    window.open(embedUrl || resumeUrl, "_blank", "noopener,noreferrer");
  }, [applicantId, embedUrl, error, loading, resumeUrl]);

  const sidebarItems = useMemo(
    () => [
      { label: "Candidates", href: "/admin_recruiter/candidates", icon: Users },
      { label: "New", href: "/admin_recruiter/new", icon: UserPlus },
      { label: "Pending", href: "/admin_recruiter/pending", icon: UserCheck },
      { label: "Approved", href: "/admin_recruiter/approved", icon: UserCheck },
      { label: "Disapproved", href: "/admin_recruiter/disapproved", icon: UserX },
      { label: "Workers", href: "/admin_recruiter/workers", icon: Briefcase },
      { label: "Schedule", href: "/admin_recruiter/schedule", icon: Calendar },
    ],
    []
  );

  return (
    <div className="flex min-h-screen min-w-0 overflow-x-hidden bg-zinc-50">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0A1F1C] text-white transform transition-transform lg:translate-x-0 ${
          chromeActive ? "hidden" : sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="px-6 py-8 flex items-center gap-3 border-b border-white/10">
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center">
              <span className="text-[#0A1F1C] font-bold text-3xl">N</span>
            </div>
            <div>
              <div className="font-semibold text-2xl tracking-tight">Nexus</div>
              <div className="text-xs text-teal-400 -mt-1">MedPro Staffing</div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-8 space-y-1">
            <div className="px-4 pt-8 text-xs uppercase tracking-widest text-teal-400/70 mb-4">
              TEAM MANAGEMENT
            </div>

            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm rounded-2xl transition-all ${
                    isActive ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}

            <div className="px-4 pt-10">
              <a
                href="#"
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl"
              >
                <Settings className="w-5 h-5" /> Settings
              </a>
            </div>
          </nav>

          <div className="p-6 border-t border-white/10">
            <button className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/10 rounded-2xl">
              <LogOut className="w-5 h-5" /> Sign out
            </button>
          </div>
        </div>
      </div>

      <div className={`flex min-w-0 flex-1 flex-col overflow-x-hidden ${chromeActive ? "" : "lg:pl-72"}`}>
        {!chromeActive ? (
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-2xl font-semibold">{isWorkerRoute ? "Worker" : "New Applicant"}</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-zinc-200" />
            <div className="text-sm">
              <div className="font-medium text-gray-600">Sean Smith</div>
              <div className="-mt-0.5 text-xs text-gray-600">Administrator</div>
            </div>
          </div>
        </header>
        ) : null}

        <div className="admin-recruiter-page-pad w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="admin-recruiter-content-width w-full min-w-0 max-w-full">
            {error ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            {pageLoading && !chromeActive ? (
              <CandidateDetailLoader label="Loading resume..." />
            ) : (
              <>
            {!chromeActive ? (
              <>
                <DetailedCandidateHeader
                  name={candidateName}
                  role={candidateRole}
                  profilePhotoUrl={w?.profile_photo_url}
                  workerId={applicantId}
                  candidateEmail={w?.email ?? null}
                  location={candidateLocation}
                  statusLabel={candidateStatus}
                  hasApplication={Boolean(
                    profile?.job_requisition_id?.trim() ||
                      profile?.job_id?.trim() ||
                      w?.job_id?.trim()
                  )}
                />
                <DetailedTabs
                  applicantId={applicantId}
                  activeTab="Resume"
                  workerStatus={w?.status ?? null}
                />
              </>
            ) : null}
            {/* <ProfileSubTabs applicantId={applicantId} activeTab="Resume" /> */}

            {pageLoading ? (
              <CandidateDetailLoader label="Loading resume..." />
            ) : (
            <div className="w-full min-w-0 max-w-full">
              {!loading && !error && !resumePath ? (
                <div className="rounded-2xl border border-zinc-200 bg-white/80 px-5 py-8 text-center text-sm text-gray-600">
                  No resume found in{" "}
                  <span className="font-mono text-xs text-gray-600">worker_requirements.resume_path</span>{" "}
                  for this applicant. Upload a resume during onboarding (step 1) to store it.
                </div>
              ) : null}

              {!loading && !error && resumePath && !resumeUrl ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                  A path is stored (<span className="font-mono text-xs break-all">{resumePath}</span>) but a
                  signed URL could not be created. Check that the file exists in the{" "}
                  <span className="font-mono">worker-resumes</span> bucket and service role storage access.
                </div>
              ) : null}

              {!loading && resumeUrl ? (
                <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
                  <div className="flex min-w-0 flex-col gap-2 border-b border-[#E5E7EB] px-3 py-3 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-0">
                    <span className="min-w-0 truncate text-sm font-medium text-[#374151]" title={resumeDisplayFileName(resumePath, w)}>
                      {resumeDisplayFileName(resumePath, w)}
                    </span>
                    <a
                      href={embedUrl ?? resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="inline-flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white sm:h-8 sm:w-auto"
                      style={{ backgroundColor: "var(--brand-primary)" }}
                    >
                      Download Resume
                    </a>
                  </div>
                  {canEmbedPreview ? (
                    <>
                      {/* Mobile: prefer native/new-tab PDF viewer — iframe preview clips badly */}
                      <div className="block space-y-4 bg-white px-4 py-8 text-center sm:px-5 md:hidden">
                        <p className="text-sm text-[#374151]">
                          On mobile, the resume opens in a new tab for a clearer view.
                        </p>
                        <a
                          href={embedUrl ?? resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-full max-w-xs items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white"
                        >
                          Open resume
                        </a>
                      </div>
                      <div className="hidden bg-zinc-100 md:block">
                        <div className="border-b border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                          If the embedded preview is blank, your browser may not support this document viewer. <a className="font-medium underline" href={embedUrl ?? resumeUrl} target="_blank" rel="noopener noreferrer">Open in new tab</a> or download the resume above.
                        </div>
                        {lowerPath.endsWith(".pdf") || lowerUrl.includes(".pdf") ? <ResumePdfPreview url={embedUrl ?? resumeUrl} /> : <iframe
                          title="Resume preview"
                          src={embedUrl ?? resumeUrl}
                          className="h-[calc(100dvh-220px)] min-h-[420px] w-full sm:min-h-[560px] md:min-h-[700px]"
                          onError={() =>
                            setResumePreviewError(
                              "Preview is blocked on this device. Use 'Open in new tab' to view the resume."
                            )
                          }
                        />}
                        {resumePreviewError ? (
                          <div className="border-t border-zinc-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            {resumePreviewError}
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-sm text-[#374151]">
                      <p className="mb-4">Preview is available for PDF and Word (.docx) files.</p>
                      <a
                        href={resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
                        style={{ backgroundColor: "var(--brand-primary)" }}
                      >
                        Download {resumeDisplayFileName(resumePath, w)}
                      </a>
                    </div>
                  )}
                </div>
              ) : null}

            </div>
            )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
