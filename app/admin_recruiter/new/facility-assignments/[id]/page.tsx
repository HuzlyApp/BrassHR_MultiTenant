"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DetailedCandidateHeader from "../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../components/DetailedTabs";
import {
  Briefcase,
  Calendar,
  Circle,
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
  status_label?: string;
};

type WorkerProfileResponse = {
  worker: WorkerProfile;
};

type FacilityTab = "active" | "potential" | "recent";

type PotentialFacility = {
  id: string;
  name: string;
  primaryAddress: string;
  secondaryAddress: string;
  distance: string;
};

const potentialFacilities: PotentialFacility[] = [
  {
    id: "hca-healthcare",
    name: "HCA Healthcare",
    primaryAddress: "213 Pine Road Troy, Michigan",
    secondaryAddress: "PO Box 1244, Hanalei, Hawaii, 96714",
    distance: "2 Miles Away",
  },
  {
    id: "universal-health-services",
    name: "Universal Health Services",
    primaryAddress: "112 West Road Troy, Michigan",
    secondaryAddress: "11820 Edgewater Dr, Lakewood, Ohio, 44107",
    distance: "2.5 Miles Away",
  },
  {
    id: "kaiser-permanente",
    name: "Kaiser Permanente",
    primaryAddress: "63 Mark Street, Michigan",
    secondaryAddress: "7515 Forrester Ln, Manassas, Virginia, 20109",
    distance: "1.5 Miles Away",
  },
  {
    id: "providence-st-joseph-health",
    name: "Providence St Joseph Health",
    primaryAddress: "21 Ripple Ave, Michigan",
    secondaryAddress: "19 Johnson Dr, Dickson, North Dakota, 58601",
    distance: "3.5 Miles Away",
  },
  {
    id: "trinity-health",
    name: "Trinity Health",
    primaryAddress: "133 Rump Street, Michigan",
    secondaryAddress: "PO Box 1134, Hanalei, Hawaii, 96714",
    distance: "1.5 Miles Away",
  },
  {
    id: "ascension-health",
    name: "Ascension Health",
    primaryAddress: "95 Gandhi Street, Michigan",
    secondaryAddress: "13 Winter Ter, Mahwah, New Jersey, 07430",
    distance: "1.5 Miles Away",
  },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

export default function NewApplicantFacilityAssignmentsPage() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<WorkerProfileResponse | null>(null);
  const [activeFacilityTab, setActiveFacilityTab] = useState<FacilityTab>("potential");
  const [showAssignFacilityModal, setShowAssignFacilityModal] = useState(false);

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
        console.error("Failed to fetch applicant for facility assignments:", msg, e);
        setLoadError(msg);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }

    fetchApplicant();
  }, [applicantId]);

  const applicant = profile?.worker ?? null;

  const candidateName = useMemo(() => {
    const n = `${applicant?.first_name ?? ""} ${applicant?.last_name ?? ""}`.trim();
    return n || "Applicant";
  }, [applicant]);

  const candidateRole = applicant?.job_role || "N/A";
  const statusLabel = applicant?.status_label?.trim() || "New Applicant";
  const visibleFacilities =
    activeFacilityTab === "potential" || activeFacilityTab === "recent" ? potentialFacilities : [];

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
              Admin - New Applicant Detailed Page - Facility Assignments
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
            <DetailedTabs applicantId={applicantId} activeTab="Facility Assignments" />

            <div className="mx-auto w-full max-w-[1300px] min-h-[896px] rounded-lg border border-[#E5E7EB] bg-white p-5">
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
                    {loading ? "…" : statusLabel}
                  </span>
                  <button className="bg-white/70 border border-[#9CC3FF] text-gray-600 px-5 py-2.5 rounded-2xl hover:bg-white transition text-sm">
                    <Plus className="inline-block w-4 h-4 mr-2" />
                    New Appointment
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-[#E5E7EB] px-6 py-4 ">
                <div className="mx-auto flex w-full bg-[#F8FAFC] rounded-xl py-1 max-w-[540px] items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveFacilityTab("active")}
                    className={`h-8 flex-1 rounded-lg px-4 text-base font-medium ${
                      activeFacilityTab === "active"
                        ? "bg-[#0D9488] text-white"
                        : "bg-transparent text-[#374151]"
                    }`}
                  >
                    Active Facilities
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFacilityTab("potential")}
                    className={`h-8 flex-1 rounded-lg px-4 text-base font-medium ${
                      activeFacilityTab === "potential"
                        ? "bg-[#0D9488] text-white"
                        : "bg-transparent text-[#374151]"
                    }`}
                  >
                    Potential Facilities
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFacilityTab("recent")}
                    className={`h-8 flex-1 rounded-lg px-4 text-base font-medium ${
                      activeFacilityTab === "recent"
                        ? "bg-[#0D9488] text-white"
                        : "bg-transparent text-[#374151]"
                    }`}
                  >
                    Recent Facilities
                  </button>
                </div>
              </div>

              {visibleFacilities.length === 0 ? (
                <div className="flex min-h-[calc(896px-40px)] items-center justify-center px-6 py-10">
                  <div className="max-w-md text-center">
                    <div className="text-[18px] font-semibold leading-7 text-gray-700">
                      No facility assigned yet
                    </div>
                    <div className="mt-2 text-center text-sm font-normal leading-5 text-gray-500">
                      No facility assigned yet to the applicant.
                    </div>
                    <a
                      href="#"
                      className="mt-2 inline-block text-center text-sm font-normal leading-5 text-teal-700 underline underline-offset-4"
                    >
                      Learn more about facility recommendations
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        if (activeFacilityTab === "active") {
                          setShowAssignFacilityModal(true);
                        }
                      }}
                      className="mt-6 inline-flex h-10 w-[237px] items-center justify-center gap-2 rounded-[8px] bg-[#0D9488] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0B7F77]"
                    >
                      <Plus className="w-4 h-4" />
                      Add candidate to a facility
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-6 sm:px-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {visibleFacilities.map((facility) => (
                      <div
                        key={facility.id}
                        className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                      >
                        <div className="mb-3 flex items-center gap-3 border-b border-[#F1F5F9] pb-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg  bg-[linear-gradient(135deg,#27c8c0_0%,#16877f_100%)] ">
                            <img
                              src="/icons/admin-recruiter/pie_chart_outlined.svg"
                              alt="Facility icon"
                              className="h-5 w-5"
                            />
                          </div>
                          <div className="text-lg font-semibold leading-7 text-black ">
                            {facility.name}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-[#4B5563]">
                            <img
                              src="/icons/admin-recruiter/locationfacility.svg"
                              alt="Location"
                               className="h-5 w-5"
                            />
                            <span>{facility.primaryAddress}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[#4B5563]">
                            <img
                              src="/icons/admin-recruiter/corporate_fare.svg"
                              alt="Location"
                               className="h-5 w-5"
                            />
                            <span>{facility.secondaryAddress}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[#4B5563]">
                            <img
                              src="/icons/admin-recruiter/target.svg"
                              alt="Distance"
                              className="h-5 w-5"
                            />
                            <span>{facility.distance}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAssignFacilityModal ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[1080px] rounded-[22px] bg-white shadow-[0_18px_38px_rgba(2,8,23,0.2)]">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-8 py-6">
              <h2 className="text-2xl font-semibold leading-none text-[#1F2937]">Assign to facility</h2>
              <button
                type="button"
                onClick={() => setShowAssignFacilityModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white"
                aria-label="Close assign facility modal"
              >
                <X className="h-7 w-7" />
              </button>
            </div>

            <div className="px-8 pb-8 pt-5">
              <div className="mb-4 text-lg font-normal leading-none text-[#374151]">
                {potentialFacilities.length} Results
              </div>

              <div className="max-h-[64vh] overflow-auto pr-2">
                {potentialFacilities.map((facility) => (
                  <div
                    key={`assign-${facility.id}`}
                    className="flex items-center justify-between border-b border-[#E5E7EB] py-5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0D9488]">
                        <img
                          src="/icons/admin-recruiter/facilityicon.svg"
                          alt="Facility"
                          className="h-5 w-5"
                        />
                      </div>
                      <div>
                        <div className="text-sm font-medium leading-none text-black">
                          {facility.name}
                        </div>
                        <div className="mt-1 text-xs font-normal leading-none text-[#6B7280]">
                          {facility.primaryAddress}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="inline-flex items-center gap-5 px-2 py-1 text-[#0D9488]"
                      aria-label={`Add ${facility.name}`}
                    >
                      <Circle className="h-5 w-5 fill-current stroke-current" />
                      <Plus className="h-6 w-6" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

