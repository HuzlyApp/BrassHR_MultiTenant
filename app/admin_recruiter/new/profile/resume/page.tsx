"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

function ResumeViewer() {
  return (
    <div className="bg-[#2A2A2A] rounded-2xl overflow-hidden border border-black/10">
      <div className="h-12 flex items-center gap-3 px-4 text-white/85 bg-black/15">
        <button className="w-8 h-8 rounded-xl hover:bg-white/10 grid place-items-center">
          <Search className="w-4 h-4" />
        </button>
        <button className="w-8 h-8 rounded-xl hover:bg-white/10 grid place-items-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button className="w-8 h-8 rounded-xl hover:bg-white/10 grid place-items-center">
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="text-xs opacity-80">1 of 2</div>

        <div className="ml-auto flex items-center gap-1">
          <button className="w-8 h-8 rounded-xl hover:bg-white/10 grid place-items-center">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 rounded-xl hover:bg-white/10 grid place-items-center">
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="text-xs opacity-80 px-2">Automatic Zoom</div>
          <button className="w-8 h-8 rounded-xl hover:bg-white/10 grid place-items-center">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-8 grid place-items-center">
        <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden">
          <div className="p-10">
            <div className="text-2xl font-bold tracking-tight">JOHN DOE</div>
            <div className="mt-2 text-xs text-gray-600 max-w-xl">
              Summary statement and skills preview (placeholder). Replace this with the actual resume
              PDF when available.
            </div>

            <div className="mt-6 grid grid-cols-12 gap-6 text-[11px] leading-5 text-gray-600">
              <div className="col-span-4">
                <div className="font-semibold text-gray-600">CONTACT</div>
                <div className="mt-2 space-y-1 text-gray-600">
                  <div>555-555-5555</div>
                  <div>example@email.com</div>
                  <div>Seattle, WA</div>
                </div>

                <div className="mt-6 font-semibold text-gray-600">SKILLS</div>
                <ul className="mt-2 space-y-1 text-gray-600 list-disc pl-4">
                  <li>Patient care</li>
                  <li>Medication administration</li>
                  <li>Emergency response</li>
                  <li>Documentation</li>
                </ul>
              </div>

              <div className="col-span-8">
                <div className="font-semibold text-gray-600">SUMMARY</div>
                <p className="mt-2 text-gray-600">
                  Knowledgeable healthcare technician bringing strengths in interview and emergency
                  care. Skilled in routine treatments and ventilator support.
                </p>

                <div className="mt-5 font-semibold text-gray-600">PROFESSIONAL SKILLS</div>
                <ul className="mt-2 space-y-1 text-gray-600 list-disc pl-4">
                  <li>Patient preparation and monitoring</li>
                  <li>Assisted clinical operations</li>
                  <li>Collaborated with care teams</li>
                </ul>

                <div className="mt-5 font-semibold text-gray-600">WORK HISTORY</div>
                <div className="mt-2 space-y-3 text-gray-600">
                  <div>
                    <div className="font-medium text-gray-600">Health Care Technician</div>
                    <div className="text-gray-600">May 2022 – Current • Mercy Hospital</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-600">Assisted Living Aide</div>
                    <div className="text-gray-600">Jan 2020 – May 2022 • Hope Care</div>
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

export default function NewApplicantProfileResumeDemoPage() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const candidateName = "John Doe";
  const candidateRole = "Licensed Practical Nurse, LPN";
  const candidateStatus = "New Applicant";
  const candidateLocation = "Charlotte, NC 28262";

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

      {/* Main */}
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
              <div className="text-xs text-gray-600">Admin - New Applicant Detailed Page - Resume</div>
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
          <div className="relative bg-gradient-to-r from-[#F7FAFF] via-white to-[#F7FAFF] border border-[#9CC3FF]/30 rounded-3xl overflow-hidden">
            <div className="absolute inset-0 opacity-[0.25]" />

            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200 grid place-items-center text-gray-600">
                  {initials(candidateName)}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-semibold text-gray-600">{candidateName}</div>
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

            {/* Tabs */}
            <div className="px-6 py-4 border-b border-[#9CC3FF]/20 bg-white/30">
              <div className="flex flex-wrap gap-2">
                {tabLink("Checklist", "/admin_recruiter/new/checklist", false)}
                {tabLink("Profile", "/admin_recruiter/new/profile", true)}
                {tabLink("Attachments", "/admin_recruiter/new/attachments", false)}
                {tabLink("Skill Assessments", "/admin_recruiter/new/skill-assessments", false)}
                {tabLink("Authorization", "/admin_recruiter/new/authorization", false)}
                {tabLink("Activities", "/admin_recruiter/new/activities", false)}
                {tabLink("Facility Assignments", "/admin_recruiter/new/facility-assignments", false)}
                {tabLink("History", "/admin_recruiter/new/history", false)}
              </div>
            </div>

            {/* Profile subtabs */}
            <div className="px-6 py-4">
              <div className="inline-flex items-center gap-2 bg-white/70 border border-zinc-200 rounded-3xl p-1">
                {subTabLink("Details", "/admin_recruiter/new/profile", false)}
                {subTabLink("Resume", "/admin_recruiter/new/profile/resume", true)}
                {subTabLink("Notes", "/admin_recruiter/new/profile/notes", false)}
              </div>
            </div>

            <div className="px-6 pb-6">
              <ResumeViewer />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

