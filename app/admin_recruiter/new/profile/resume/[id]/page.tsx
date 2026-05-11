"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DetailedCandidateHeader from "../../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../../components/DetailedTabs";
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
    job_role: string | null;
    city: string | null;
    state: string | null;
  };
  requirements: {
    resume_path: string | null;
    resume_url: string | null;
  } | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

function fileLabel(path: string | null | undefined) {
  if (!path?.trim()) return "resume";
  const seg = path.split("/").pop() || path;
  return seg;
}

export default function NewApplicantProfileResumePage() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;

  const isWorkerRoute = pathname?.startsWith("/admin_recruiter/workers/") ?? false;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<WorkerProfilePayload | null>(null);

  useEffect(() => {
    async function run() {
      if (!applicantId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`
        );
        const json = (await res.json()) as WorkerProfilePayload & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load profile");
        setProfile(json);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to load");
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [applicantId]);

  const w = profile?.worker;
  const resumePath = profile?.requirements?.resume_path ?? null;
  const resumeUrl = profile?.requirements?.resume_url ?? null;

  const candidateName = useMemo(() => {
    const n = `${w?.first_name ?? ""} ${w?.last_name ?? ""}`.trim();
    return n || (isWorkerRoute ? "Worker" : "Applicant");
  }, [w?.first_name, w?.last_name, isWorkerRoute]);

  const candidateRole = w?.job_role || "N/A";
  const candidateLocation = useMemo(() => {
    const parts = [w?.city ?? "", w?.state ?? ""].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  }, [w?.city, w?.state]);

  const candidateStatus = isWorkerRoute ? "Worker" : "New Applicant";

  const isPdf =
    resumePath?.toLowerCase().endsWith(".pdf") ||
    resumeUrl?.toLowerCase().includes(".pdf");

  const tabLink = (label: string, href: string, active?: boolean) => (
    <Link
      href={href}
      className={`text-xs px-3 py-1.5 rounded-xl border transition ${
        active
          ? "border-[#7AA6FF] bg-white text-gray-600"
          : "border-zinc-200 bg-white/60 text-gray-600 hover:bg-white"
      }`}
    >
      {label}
    </Link>
  );

  const subTabLink = (label: string, href: string, active?: boolean) => (
    <Link
      href={href}
      className={`text-xs px-4 py-2 rounded-2xl transition ${
        active ? "bg-teal-700 text-white" : "text-gray-600 hover:bg-white/60"
      }`}
    >
      {label}
    </Link>
  );

  const basePrefix = isWorkerRoute ? `/admin_recruiter/workers/${applicantId}` : `/admin_recruiter/new`;
  const detailsHref = isWorkerRoute
    ? `/admin_recruiter/workers/${applicantId}/profile`
    : `/admin_recruiter/new/profile/${applicantId}`;
  const resumeHref = isWorkerRoute
    ? `/admin_recruiter/workers/${applicantId}/profile/resume`
    : `/admin_recruiter/new/profile/resume/${applicantId}`;
  const notesHref = isWorkerRoute
    ? `/admin_recruiter/workers/${applicantId}/profile/notes`
    : `/admin_recruiter/new/profile/notes/${applicantId}`;

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
    <div className="flex min-h-screen bg-zinc-50 overflow-hidden">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0A1F1C] text-white transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
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

      <div className="flex-1 flex flex-col lg:pl-72">
        <header className="h-16 border-b bg-white flex items-center px-6 justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-10 h-10 rounded-2xl border border-zinc-200 flex items-center justify-center"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="text-xs text-gray-600">
                Admin - {isWorkerRoute ? "Worker" : "New Applicant"} Detailed Page - Resume
              </div>
              <div className="text-lg font-semibold text-gray-600">Candidates</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-200 overflow-hidden" />
            <div className="text-sm">
              <div className="font-medium text-gray-600">Sean Smith</div>
              <div className="text-xs text-gray-600 -mt-0.5">Administrator</div>
            </div>
          </div>
        </header>

        <div className="p-6">
          <div className="max-w-[1320px] mx-auto mb-4">
            <DetailedCandidateHeader
              name={candidateName}
              role={candidateRole}
              loading={loading}
            />
            <DetailedTabs applicantId={applicantId} activeTab="Profile" />
            <div className="mb-4 flex justify-center">
              <div className="h-9 w-[327px] rounded-xl bg-[#F8FAFC] p-1">
                <div className="grid h-full grid-cols-3 gap-1">
                  <Link
                    href={detailsHref}
                    className="inline-flex items-center justify-center rounded-lg text-sm font-medium leading-5 text-[#374151] hover:bg-white"
                  >
                    Details
                  </Link>
                  <Link
                    href={resumeHref}
                    className="inline-flex items-center justify-center rounded-lg bg-[#0D9488] text-sm font-medium leading-5 text-white"
                  >
                    Resume
                  </Link>
                  <Link
                    href={notesHref}
                    className="inline-flex items-center justify-center rounded-lg text-sm font-medium leading-5 text-[#374151] hover:bg-white"
                  >
                    Notes
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="hidden p-6 items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200 grid place-items-center text-gray-600">
                  {initials(candidateName)}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-semibold text-gray-600">
                      {loading ? "Loading…" : candidateName}
                    </div>
                    <span className="text-[11px] px-3 py-1 rounded-full bg-white/70 border border-zinc-200 text-gray-600 font-medium">
                      {candidateStatus}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">{candidateRole}</div>
                  <div className="text-xs text-gray-600">{candidateLocation}</div>
                </div>
              </div>

              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden w-10 h-10 rounded-2xl border border-zinc-200 flex items-center justify-center"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="hidden px-6 py-4 border-b border-[#9CC3FF]/20 bg-white/30">
              <div className="flex flex-wrap gap-2">
                {tabLink("Checklist", `${basePrefix}/checklist`, false)}
                {tabLink("Profile", detailsHref, true)}
                {tabLink("Attachments", `${basePrefix}/attachments`, false)}
                {tabLink("Skill Assessments", `${basePrefix}/skill-assessments`, false)}
                {tabLink("Authorization", `${basePrefix}/authorization`, false)}
                {tabLink("Activities", `${basePrefix}/activities`, false)}
                {tabLink("Facility Assignments", `${basePrefix}/facility-assignments`, false)}
                {tabLink("History", `${basePrefix}/history`, false)}
              </div>
            </div>

            <div className="hidden py-4 justify-center">
              <div className="h-9 w-[327px] rounded-xl bg-[#F8FAFC] p-1">
                <div className="grid h-full grid-cols-3 gap-1">
                  <Link
                    href={detailsHref}
                    className="inline-flex items-center justify-center rounded-lg text-sm font-medium leading-5 text-[#374151] hover:bg-white"
                  >
                    Details
                  </Link>
                  <Link
                    href={resumeHref}
                    className="inline-flex items-center justify-center rounded-lg bg-[#0D9488] text-sm font-medium leading-5 text-white"
                  >
                    Resume
                  </Link>
                  <Link
                    href={notesHref}
                    className="inline-flex items-center justify-center rounded-lg text-sm font-medium leading-5 text-[#374151] hover:bg-white"
                  >
                    Notes
                  </Link>
                </div>
              </div>
            </div>

            <div className="px-0 pb-0">
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              ) : null}

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
                <div className="h-[852px] w-full bg-[#2A2A2A] rounded-lg overflow-hidden border border-black/10">
                  <div className="h-11 flex items-center px-4 text-white/85 bg-black/15 text-xs justify-between">
                    <span className="truncate">{fileLabel(resumePath)}</span>
                    <a
                      href={resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-teal-300 hover:text-white underline"
                    >
                      Open in new tab
                    </a>
                  </div>
                  {isPdf ? (
                    <iframe
                      title="Resume PDF"
                      src={resumeUrl}
                      className="h-[calc(852px-44px)] w-full bg-zinc-100"
                    />
                  ) : (
                    <div className="p-8 text-center text-white/90 text-sm">
                      <p className="mb-4">Preview is available for PDF files. This file is not a PDF.</p>
                      <a
                        href={resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-xl bg-teal-600 hover:bg-teal-500 px-5 py-2.5 font-medium"
                      >
                        Download {fileLabel(resumePath)}
                      </a>
                    </div>
                  )}
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-2xl border border-zinc-200 bg-white/60 px-5 py-12 text-center text-sm text-gray-600">
                  Loading resume…
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
