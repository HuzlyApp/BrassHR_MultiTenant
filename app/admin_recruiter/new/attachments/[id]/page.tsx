"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DetailedCandidateHeader from "../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../components/DetailedTabs";
import {
  Briefcase,
  Calendar,
  Download,
  Eye,
  LogOut,
  Menu,
  Plus,
  Settings,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
type WorkerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
};

type WorkerProfileResponse = {
  worker: WorkerProfile;
  requirements: {
    resume_path: string | null;
    resume_path_raw?: string | null;
    resume_url: string | null;
  } | null;
  document_urls: {
    nursing_license_url: string | null;
    tb_test_url: string | null;
    cpr_certification_url: string | null;
    authorization_document_url?: string | null;
  };
  attachment_files?: Array<{
    bucket: string;
    path: string;
    name: string;
    url?: string | null;
  }>;
};

type AttachmentRow = {
  id: string;
  title: string;
  url: string | null;
  filename: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

function basenameFromStoragePath(path: string | null | undefined): string {
  if (!path?.trim()) return "—";
  const parts = path.trim().split("/");
  return parts[parts.length - 1] || "—";
}

function fileNameFromHttpUrl(url: string | null | undefined): string {
  if (!url?.trim()) return "—";
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop();
    return seg ? decodeURIComponent(seg) : "—";
  } catch {
    return "—";
  }
}

export default function NewApplicantAttachmentsFilledPage() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<WorkerProfileResponse | null>(null);

  useEffect(() => {
    async function fetchApplicant() {
      if (!applicantId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`
        );
        const json = (await res.json()) as WorkerProfileResponse & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `Failed to load profile (${res.status})`);
        }
        setProfile(json);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Failed to fetch applicant for attachments:", msg, e);
        setLoadError(msg);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }

    fetchApplicant();
  }, [applicantId]);

  const applicant = profile?.worker ?? null;

  const attachmentRows: AttachmentRow[] = useMemo(() => {
    if (!profile) return [];
    const req = profile.requirements;
    const du = profile.document_urls;
    const resumeFileLabel = (() => {
      if (req?.resume_path?.trim()) return basenameFromStoragePath(req.resume_path);
      const raw = req?.resume_path_raw?.trim();
      if (raw?.startsWith("http://") || raw?.startsWith("https://")) {
        return fileNameFromHttpUrl(raw);
      }
      return basenameFromStoragePath(raw ?? null);
    })();
    return [
      {
        id: "resume",
        title: "Resume",
        url: req?.resume_url ?? null,
        filename: resumeFileLabel,
      },
      {
        id: "license",
        title: "Nursing License",
        url: du?.nursing_license_url ?? null,
        filename: fileNameFromHttpUrl(du?.nursing_license_url ?? null),
      },
      {
        id: "tb",
        title: "TB Test",
        url: du?.tb_test_url ?? null,
        filename: fileNameFromHttpUrl(du?.tb_test_url ?? null),
      },
      {
        id: "cpr",
        title: "CPR Certifications",
        url: du?.cpr_certification_url ?? null,
        filename: fileNameFromHttpUrl(du?.cpr_certification_url ?? null),
      },
      {
        id: "authorization",
        title: "Authorization Document",
        url: du?.authorization_document_url ?? null,
        filename: fileNameFromHttpUrl(du?.authorization_document_url ?? null),
      },
      ...((profile.attachment_files ?? [])
        .filter((f) => !["resume", "license", "tb", "cpr", "authorization"].some((k) => f.path.toLowerCase().includes(k)))
        .slice(0, 5)
        .map((f, idx) => ({
          id: `extra-${idx}`,
          title: `Other Uploaded File ${idx + 1}`,
          url: f.url ?? null,
          filename: f.name || basenameFromStoragePath(f.path),
        })) as AttachmentRow[]),
    ];
  }, [profile]);

  const uploadedCount = useMemo(
    () => attachmentRows.filter((r) => r.url).length,
    [attachmentRows]
  );
  const totalCount = attachmentRows.length;

  const candidateName = useMemo(() => {
    const n = `${applicant?.first_name ?? ""} ${applicant?.last_name ?? ""}`.trim();
    return n || "Applicant";
  }, [applicant]);

  const candidateRole = applicant?.job_role || "N/A";

  return (
    <div className="flex min-h-screen bg-zinc-50 overflow-hidden">
      {/* Sidebar */}
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
            <div className="px-4 text-xs uppercase tracking-widest text-teal-400/70 mb-4">
              PERSONAL SETTINGS
            </div>
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl"
            >
              Profile
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 rounded-2xl"
            >
              Account
            </a>

            <div className="px-4 pt-8 text-xs uppercase tracking-widest text-teal-400/70 mb-4">
              TEAM MANAGEMENT
            </div>

            {[
              { label: "Candidates", href: "/admin_recruiter/candidates", icon: Users },
              { label: "New", href: "/admin_recruiter/new", icon: UserPlus },
              { label: "Pending", href: "/admin_recruiter/pending", icon: UserCheck },
              { label: "Approved", href: "/admin_recruiter/approved", icon: UserCheck },
              { label: "Disapproved", href: "/admin_recruiter/disapproved", icon: UserX },
              { label: "Workers", href: "/admin_recruiter/workers", icon: Briefcase },
              { label: "Schedule", href: "/admin_recruiter/schedule", icon: Calendar },
            ].map((item) => {
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

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden lg:pl-72">
        <header className="h-16 border-b bg-white flex items-center px-6 justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen((v) => !v)} className="lg:hidden text-gray-600">
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="font-semibold text-2xl">New Applicant</div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Online
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-medium text-sm">Sean Smith</div>
                <div className="text-xs text-gray-600">Manager</div>
              </div>
              <img
                src="https://i.pravatar.cc/128?u=sean"
                alt="Sean Smith"
                className="w-9 h-9 rounded-full object-cover"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-[1320px] mx-auto">
            <div className="mb-5 text-xs text-gray-600">
              Admin - New Applicant Detailed Page - Attachments (filled)
            </div>

            {loadError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {loadError}
              </div>
            ) : null}

            <DetailedCandidateHeader
              name={candidateName}
              role={candidateRole}
              loading={loading}
            />
            <DetailedTabs applicantId={applicantId} activeTab="Attachments" />

            <div className="mx-auto w-full max-w-[1300px]">
              {/* Top */}
              <div className="hidden p-6 items-start justify-between gap-6 border-b border-[#9CC3FF]/30 bg-white/40">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold text-sm">
                    {initials(candidateName)}
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-600">
                      {loading ? "Loading..." : candidateName}
                    </div>
                    <div className="text-xs text-gray-600">{candidateRole}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] px-3 py-1 rounded-full bg-white/70 border border-zinc-200 text-gray-600 font-medium">
                    New Applicant
                  </span>
                  <button className="bg-white/70 border border-[#9CC3FF] text-gray-600 px-5 py-2.5 rounded-2xl hover:bg-white transition text-sm">
                    <Plus className="inline-block w-4 h-4 mr-2" />
                    New Appointment
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-[#9CC3FF]/20 bg-white/30" />

              <div className="p-5">
                <div className="flex h-[52px] w-full items-center justify-between rounded-md border border-[#D1D5DB] px-5 py-[14px]">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-[16px] font-semibold leading-6 text-[#111827]"
                  >
                    Upload Files
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center"
                    aria-label="Add upload"
                  >
                    <img src="/icons/admin-recruiter/plus-icon.svg" alt="" className="h-6 w-6" />
                  </button>
                </div>

                <div className="mt-5">
                  <div className="mb-4 flex items-center justify-between border-b border-[#E5E7EB] pb-4">
                    <h3 className="text-[20px] font-semibold leading-7 text-[#111827]">Requirements Submitted</h3>
                    <p className="text-sm font-medium text-[#6B7280]">
                      Uploaded{" "}
                      <span className="font-semibold text-[#111827]">{uploadedCount}</span> of{" "}
                      <span className="font-semibold text-[#111827]">{totalCount}</span>
                    </p>
                  </div>

                  <div className="space-y-3">
                    {loading ? (
                      <div className="px-4 py-4 text-sm text-[#6B7280]">Loading requirements...</div>
                    ) : (
                      attachmentRows.map((r, idx) => (
                        <div
                          key={r.id}
                          className="h-[128px] w-full rounded-md border border-[#D1D5DB]"
                        >
                          <div className="flex h-[44px] items-center justify-between px-5 pt-3 pb-2">
                            <div className="text-[16px] font-semibold leading-6 text-[#111827]">
                              {idx + 1}. {r.title}
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                disabled={!r.url}
                                onClick={() => r.url && window.open(r.url, "_blank", "noopener,noreferrer")}
                                className="inline-flex h-5 w-5 items-center justify-center text-[#0D9488] disabled:opacity-40 disabled:pointer-events-none"
                                aria-label={`View ${r.title}`}
                              >
                                <Eye className="h-5 w-5" />
                              </button>
                              <a
                                href={r.url ?? undefined}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex h-5 w-5 items-center justify-center text-[#0D9488] ${
                                  !r.url ? "pointer-events-none opacity-40" : ""
                                }`}
                                aria-label={`Download ${r.title}`}
                              >
                                <Download className="h-5 w-5" />
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-4 px-5 py-3">
                            {r.url ? (
                              <div className="flex h-[50px] w-[306px] min-w-[306px] max-w-[520px] items-center gap-2 rounded-[8px] border border-[#99D8D3] bg-[#F8FAFC] px-3 py-2">
                                <img src="/icons/jpeg-icon.svg" alt="" className="h-6 w-6 shrink-0" />
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-semibold leading-4 tracking-[0.01em] text-[#0D9488]">
                                    {r.filename}
                                  </div>
                                  <div className="text-xs font-normal leading-4 tracking-[0.01em] text-[#6B7280]">
                                    Uploaded file
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex h-[50px] w-[306px] min-w-[306px] max-w-[520px] items-center justify-between rounded-[8px] border border-dashed border-[#99D8D3] bg-[#F8FAFC] px-3 py-2">
                                <span className="text-xs text-[#6B7280]">No Document</span>
                                <button
                                  type="button"
                                  className="inline-flex h-8 items-center justify-center rounded-md border border-[#99D8D3] bg-white px-4 text-xs font-semibold text-[#0D9488]"
                                >
                                  Upload
                                </button>
                              </div>
                            )}

                            {r.url ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="inline-flex h-8 items-center justify-center rounded-md bg-[#0D9488] px-4 text-xs font-semibold text-white"
                                >
                                  Approved
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex h-8 items-center justify-center rounded-md border border-[#99D8D3] px-4 text-xs font-semibold text-[#0D9488]"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex h-8 items-center justify-center rounded-md border border-[#99D8D3] px-4 text-xs font-semibold text-[#0D9488]"
                                >
                                  Request More
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="inline-flex h-8 items-center justify-center rounded-md bg-[#0D9488] px-5 text-xs font-semibold text-white"
                              >
                                Upload
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

