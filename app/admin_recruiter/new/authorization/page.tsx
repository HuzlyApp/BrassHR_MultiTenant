"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

type DocFile = { name: string; size: string };

export default function NewApplicantAuthorizationFilledDemoPage() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const candidateName = "John Doe";
  const candidateRole = "Licensed Practical Nurse, LPN";

  const authorization = useMemo(
    () => ({ name: "Authorization.pdf", size: "7.23 MB", status: "Signed" as const }),
    []
  );

  const documents = useMemo(
    () => [
      {
        title: "SSN Card",
        uploaded: "2 of 2",
        files: [
          { name: "SSN-card-front.pdf", size: "7.23 MB" },
          { name: "SSN-card-back.pdf", size: "7.23 MB" },
        ] as DocFile[],
      },
      {
        title: "Drivers License",
        uploaded: "2 of 2",
        files: [
          { name: "drivers-license-front.jpg", size: "5.23 MB" },
          { name: "drivers-license-back.jpg", size: "5.23 MB" },
        ] as DocFile[],
      },
      {
        title: "Employment Agreement",
        uploaded: "1 of 1",
        files: [{ name: "Employment_agreement.pdf", size: "7.23 MB" }] as DocFile[],
        signed: true,
      },
    ],
    []
  );

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
              Admin - New Applicant Detailed Page - Authorization (filled)
            </div>

            <div className="rounded-2xl border border-[#9CC3FF] overflow-hidden shadow-sm bg-[linear-gradient(90deg,rgba(59,130,246,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(59,130,246,0.04)_1px,transparent_1px)] bg-[size:34px_34px] bg-white/70">
              {/* Top */}
              <div className="p-6 flex items-start justify-between gap-6 border-b border-[#9CC3FF]/30 bg-white/40">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold text-sm">
                    {initials(candidateName)}
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-600">{candidateName}</div>
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
              <div className="px-6 py-4 border-b border-[#9CC3FF]/20 bg-white/30">
                <div className="flex flex-wrap gap-2">
                  {tabLink("Checklist", "/admin_recruiter/new/checklist", false)}
                  {tabLink("Profile", "/admin_recruiter/new/profile", false)}
                  {tabLink("Attachments", "/admin_recruiter/new/attachments", false)}
                  {tabLink("Skill Assessments", "/admin_recruiter/new/skill-assessments", false)}
                  {tabLink("Authorization", "/admin_recruiter/new/authorization", true)}
                  {tabLink("Activities", "/admin_recruiter/new/activities", false)}
                  {tabLink(
                    "Facility Assignments",
                    "/admin_recruiter/new/facility-assignments",
                    false
                  )}
                  {tabLink("History", "/admin_recruiter/new/history", false)}
                </div>
              </div>

              <div className="p-6 grid grid-cols-12 gap-6">
                {/* Left */}
                <section className="col-span-7 space-y-6">
                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-3">Authorization</div>

                    <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs text-gray-600">1. Authorization</div>
                        <div className="text-xs text-gray-600">
                          Signed <span className="font-medium text-gray-600">1</span> of{" "}
                          <span className="font-medium text-gray-600">1</span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-teal-700 truncate">
                            {authorization.name}
                          </div>
                          <div className="text-[11px] text-gray-600">{authorization.size}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] px-3 py-1 rounded-full bg-teal-600 text-white font-medium">
                            Signed
                          </span>
                          <button className="w-9 h-9 rounded-2xl border border-zinc-200 bg-white/80 hover:bg-white transition flex items-center justify-center">
                            <Eye className="w-4 h-4 text-teal-700" />
                          </button>
                          <button className="w-9 h-9 rounded-2xl border border-zinc-200 bg-white/80 hover:bg-white transition flex items-center justify-center">
                            <Download className="w-4 h-4 text-teal-700" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-3">Documents</div>
                    <div className="space-y-4">
                      {documents.map((d, idx) => (
                        <div
                          key={d.title}
                          className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs text-gray-600">
                              {idx + 2}. {d.title}
                            </div>
                            <div className="text-xs text-gray-600">
                              Uploaded{" "}
                              <span className="font-medium text-gray-600">{d.uploaded.split(" ")[0]}</span>{" "}
                              of{" "}
                              <span className="font-medium text-gray-600">{d.uploaded.split(" ")[2]}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            {d.files.map((f) => (
                              <div
                                key={f.name}
                                className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3 flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-medium text-teal-700 truncate">
                                    {f.name}
                                  </div>
                                  <div className="text-[11px] text-gray-600">{f.size}</div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {d.signed ? (
                                    <span className="text-[11px] px-3 py-1 rounded-full bg-teal-600 text-white font-medium">
                                      Signed
                                    </span>
                                  ) : null}
                                  <button className="w-9 h-9 rounded-2xl border border-zinc-200 bg-white/80 hover:bg-white transition flex items-center justify-center">
                                    <Eye className="w-4 h-4 text-teal-700" />
                                  </button>
                                  <button className="w-9 h-9 rounded-2xl border border-zinc-200 bg-white/80 hover:bg-white transition flex items-center justify-center">
                                    <Download className="w-4 h-4 text-teal-700" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Right */}
                <section className="col-span-5">
                  <div className="bg-white/80 border border-[#9CC3FF]/30 rounded-2xl p-5">
                    <div className="text-sm font-semibold text-gray-600 mb-4">Review</div>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-xs text-gray-600">Authorization</div>
                        <div className="flex items-center gap-2">
                          <button className="text-xs px-4 py-2 rounded-2xl bg-teal-600 text-white hover:bg-teal-700 transition">
                            Approved
                          </button>
                          <button className="text-xs px-4 py-2 rounded-2xl border border-zinc-200 bg-white/70 hover:bg-white transition">
                            Reject
                          </button>
                          <button className="text-xs px-4 py-2 rounded-2xl border border-zinc-200 bg-white/70 hover:bg-white transition">
                            Request eSign
                          </button>
                        </div>
                      </div>

                      {documents.map((d) => (
                        <div key={d.title} className="flex items-center justify-between gap-4">
                          <div className="text-xs text-gray-600">{d.title}</div>
                          <div className="flex items-center gap-2">
                            <button className="text-xs px-4 py-2 rounded-2xl bg-teal-600 text-white hover:bg-teal-700 transition">
                              Approved
                            </button>
                            <button className="text-xs px-4 py-2 rounded-2xl border border-zinc-200 bg-white/70 hover:bg-white transition">
                              Reject
                            </button>
                            <button className="text-xs px-4 py-2 rounded-2xl border border-zinc-200 bg-white/70 hover:bg-white transition">
                              Request a doc
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

