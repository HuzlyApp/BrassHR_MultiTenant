"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
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

type ProfileApi = {
  worker: WorkerProfile;
  document_urls: {
    nursing_license_url: string | null;
    tb_test_url: string | null;
    cpr_certification_url: string | null;
    ssn_url: string | null;
    ssn_back_url: string | null;
    drivers_license_url: string | null;
    drivers_license_back_url: string | null;
  };
  signeasy: { document_name: string | null; document_id: string | null };
  zoho_sign: {
    request_id: string | null;
    document_id: string | null;
    status: string | null;
    updated_at: string | null;
  };
};

type DocSlot = { label: string; url: string | null };

type DocSection = {
  id: string;
  title: string;
  slots: DocSlot[];
};

type ZohoAction = {
  action_id: string | null;
  action_type: string | null;
  action_status: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  signed_time: string | null;
};

type ZohoDocument = {
  document_id: string | null;
  document_name: string | null;
};

type ZohoRequestDetails = {
  request_id: string;
  request_status: string | null;
  is_completed: boolean;
  actions: ZohoAction[];
  documents: ZohoDocument[];
  documents_count: number;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function fileLabelFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop();
    return seg ? decodeURIComponent(seg) : "File";
  } catch {
    return "File";
  }
}

function FileActions({ url }: { url: string | null }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        disabled={!url}
        onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
        className="inline-flex items-center justify-center text-[#0D9488] disabled:opacity-40 disabled:pointer-events-none"
        aria-label="View file"
      >
        <Eye className="h-5 w-5" />
      </button>
      <a
        href={url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center text-[#0D9488] ${
          !url ? "pointer-events-none opacity-40" : ""
        }`}
        aria-label="Download file"
      >
        <Download className="h-5 w-5" />
      </a>
    </div>
  );
}

export default function NewApplicantAuthorizationFilledPage() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileApi | null>(null);
  const [zohoDetails, setZohoDetails] = useState<ZohoRequestDetails | null>(null);
  const [zohoError, setZohoError] = useState<string | null>(null);
  const [zohoLoading, setZohoLoading] = useState(false);

  useEffect(() => {
    async function fetchApplicant() {
      if (!applicantId) return;
      if (!isUuid(applicantId)) {
        try {
          // Recovery path: if URL has a short/invalid ID but only one worker is available,
          // redirect to the canonical worker UUID route.
          const res = await fetch("/api/workers", { cache: "no-store" });
          const json = (await res.json()) as
            | { workers?: Array<{ id?: string | null }> }
            | { error?: string };
          const workers = Array.isArray((json as { workers?: unknown[] }).workers)
            ? ((json as { workers: Array<{ id?: string | null }> }).workers ?? [])
            : [];
          const validWorkers = workers
            .map((w) => (w?.id ? String(w.id).trim() : ""))
            .filter((id) => isUuid(id));
          const unique = Array.from(new Set(validWorkers));
          if (unique.length === 1) {
            router.replace(`/admin_recruiter/new/authorization/${unique[0]}`);
            return;
          }
        } catch {
          // no-op; explicit error shown below
        }
        setLoadError("Invalid workerId in URL. Open Authorization from a specific candidate record.");
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/admin/worker-profile?workerId=${encodeURIComponent(applicantId)}`
        );
        const json = (await res.json()) as ProfileApi & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || `Failed to load profile (${res.status})`);
        }
        setProfile(json);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg !== "Invalid workerId") {
          console.error("Failed to fetch applicant for authorization:", msg, e);
        }
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

  const signeasy = profile?.signeasy;
  const zohoSign = profile?.zoho_sign;
  const du = profile?.document_urls;

  const authHasPacket = Boolean(signeasy?.document_name?.trim() || zohoSign?.request_id);
  const authSigned = Boolean(zohoDetails?.is_completed || zohoSign?.status === "completed");
  const authFileLabel =
    signeasy?.document_name?.trim() || "Authorization agreement (e-sign)";
  const requestStatus = zohoDetails?.request_status || zohoSign?.status || "unknown";
  const requestId = zohoSign?.request_id?.trim() || "";
  const defaultDocumentId = zohoDetails?.documents[0]?.document_id || zohoSign?.document_id || null;

  useEffect(() => {
    async function fetchZohoDetails() {
      if (!requestId) {
        setZohoDetails(null);
        setZohoError(null);
        return;
      }
      setZohoLoading(true);
      setZohoError(null);
      try {
        const res = await fetch(
          `/api/zoho-sign/request-details?request_id=${encodeURIComponent(requestId)}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as {
          success?: boolean;
          error?: string;
          data?: ZohoRequestDetails;
        };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error || `Failed to fetch Zoho request details (${res.status})`);
        }
        setZohoDetails(json.data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load Zoho request details";
        setZohoError(message);
        setZohoDetails(null);
      } finally {
        setZohoLoading(false);
      }
    }
    void fetchZohoDetails();
  }, [requestId]);

  const openZohoDocument = (mode: "preview" | "download", documentId?: string | null) => {
    if (!requestId) return;
    const qs = new URLSearchParams({ request_id: requestId, mode });
    if (documentId?.trim()) {
      qs.set("document_id", documentId.trim());
      qs.set("specific", "1");
    }
    const url = `/api/zoho-sign/document?${qs.toString()}`;
    if (mode === "download") {
      window.location.href = url;
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const documentSections: DocSection[] = useMemo(() => {
    if (!du) return [];
    return [
      {
        id: "ssn",
        title: "SSN Card",
        slots: [
          { label: "Front", url: du.ssn_url },
          { label: "Back", url: du.ssn_back_url },
        ],
      },
      {
        id: "dl",
        title: "Driver's License",
        slots: [
          { label: "Front", url: du.drivers_license_url },
          { label: "Back", url: du.drivers_license_back_url },
        ],
      },
      {
        id: "employment",
        title: "Employment Agreement",
        slots: [{ label: "Agreement", url: authHasPacket ? "signeasy-linked" : null }],
      },
    ];
  }, [du, authHasPacket]);

  const reviewRows = useMemo(() => {
    const rows: { id: string; title: string }[] = [
      { id: "auth", title: "Authorization" },
      { id: "ssn", title: "SSN Card" },
      { id: "dl", title: "Driver's License" },
    ];
    return rows;
  }, []);

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
            <DetailedTabs applicantId={applicantId} activeTab="Authorization" />

            <div className="mx-auto w-full max-w-[1300px]">
              <section>
                <div className="mb-3 text-[20px] font-semibold leading-7 text-[#1F2937]">Authorization</div>
                <div className="rounded-md border border-[#D1D5DB]">
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-3">
                    <div className="text-[16px] font-semibold leading-6 text-[#111827]">1. Authorization</div>
                    <div className="text-sm text-[#6B7280]">
                      {authSigned ? (
                        <>
                          Signed <span className="font-semibold text-[#111827]">1</span> of{" "}
                          <span className="font-semibold text-[#111827]">1</span>
                        </>
                      ) : (
                        <>Packet {authHasPacket ? "created" : "not linked"}</>
                      )}
                    </div>
                  </div>

                  <div className="border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#374151]">
                      <span className="font-semibold">Zoho Sign status:</span>
                      <span className="rounded-full bg-white px-2 py-1 font-medium capitalize">
                        {requestStatus.replaceAll("_", " ")}
                      </span>
                      {requestId ? <span className="text-[#6B7280]">Request ID: {requestId}</span> : null}
                      {zohoLoading ? <span className="text-[#6B7280]">Refreshing...</span> : null}
                    </div>
                    {zohoError ? (
                      <div className="mt-2 text-xs text-red-600">{zohoError}</div>
                    ) : null}
                    {!zohoError && zohoDetails?.actions?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {zohoDetails.actions.map((action, idx) => (
                          <span
                            key={`${action.action_id || "a"}-${idx}`}
                            className="rounded-md border border-[#D1D5DB] bg-white px-2 py-1 text-[11px] text-[#374151]"
                          >
                            {(action.recipient_name || action.recipient_email || "Signer")}:{" "}
                            {(action.action_status || "pending").replaceAll("_", " ")}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-4 px-5 py-3">
                    {authHasPacket ? (
                      <div className="flex h-[50px] w-[306px] min-w-[306px] max-w-[520px] items-center gap-2 rounded-[8px] border border-[#99D8D3] bg-[#F8FAFC] px-3 py-2">
                        <img src="/icons/pdf-icon.svg" alt="" className="h-6 w-6 shrink-0" />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold leading-4 tracking-[0.01em] text-[#0D9488]">
                            {authFileLabel}
                          </div>
                          <div className="text-xs font-normal leading-4 tracking-[0.01em] text-[#6B7280]">
                            7.23 MB
                          </div>
                        </div>
                        {authSigned ? (
                          <span className="ml-auto rounded-md bg-[#7BE2DB] px-2 py-1 text-[10px] font-semibold text-[#0D9488]">
                            Signed
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex h-[50px] w-[306px] items-center justify-between rounded-[8px] border border-dashed border-[#99D8D3] bg-[#F8FAFC] px-3 py-2">
                        <span className="text-xs text-[#6B7280]">No Document</span>
                        <button
                          type="button"
                          className="inline-flex h-8 items-center justify-center rounded-md border border-[#99D8D3] px-4 text-xs font-semibold text-[#0D9488]"
                        >
                          Upload
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openZohoDocument("preview", defaultDocumentId)}
                        disabled={!requestId}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#99D8D3] text-[#0D9488] disabled:opacity-40"
                        title="Preview authorization document"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openZohoDocument("download", defaultDocumentId)}
                        disabled={!requestId}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#99D8D3] text-[#0D9488] disabled:opacity-40"
                        title="Download authorization document"
                      >
                        <Download className="h-4 w-4" />
                      </button>
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
                        Request eSign
                      </button>
                    </div>
                  </div>
                  {zohoDetails?.documents_count && zohoDetails.documents_count > 1 ? (
                    <div className="border-t border-[#E5E7EB] px-5 py-3">
                      <div className="mb-2 text-xs font-semibold text-[#374151]">
                        Documents ({zohoDetails.documents_count})
                      </div>
                      <div className="space-y-2">
                        {zohoDetails.documents.map((doc, idx) => (
                          <div
                            key={`${doc.document_id || "doc"}-${idx}`}
                            className="flex items-center justify-between rounded-md border border-[#E5E7EB] px-3 py-2"
                          >
                            <div className="truncate text-xs text-[#374151]">
                              {doc.document_name || `Document ${idx + 1}`}
                            </div>
                            <button
                              type="button"
                              onClick={() => openZohoDocument("download", doc.document_id)}
                              disabled={!doc.document_id}
                              className="inline-flex items-center gap-1 rounded-md border border-[#99D8D3] px-2 py-1 text-[11px] font-semibold text-[#0D9488] disabled:opacity-40"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[20px] font-semibold leading-7 text-[#1F2937]">Documents</div>
                  {(() => {
                    const coreSections = documentSections.filter((s) => s.id !== "employment");
                    const uploaded = coreSections.reduce(
                      (n, d) => n + d.slots.filter((s) => s.url).length,
                      0
                    );
                    const total = coreSections.reduce((n, d) => n + d.slots.length, 0);
                    return (
                  <div className="text-sm text-[#6B7280]">
                    Uploaded{" "}
                    <span className="font-semibold text-[#111827]">
                      {uploaded}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-[#111827]">
                      {total}
                    </span>
                  </div>
                    );
                  })()}
                </div>

                <div className="space-y-4">
                  {documentSections.map((d, idx) => (
                    <div key={d.id} className="h-[130px] w-full rounded-md border border-[#D1D5DB]">
                      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-3">
                        <div className="text-[16px] font-semibold leading-6 text-[#111827]">
                          {idx + 2}. {d.title}
                        </div>
                        <FileActions url={d.slots[0]?.url || d.slots[1]?.url || null} />
                      </div>

                      <div className="flex items-center justify-between gap-4 px-5 py-3">
                        <div className="flex gap-3">
                          {d.id === "employment" && !authSigned ? (
                            <div className="flex h-[50px] w-[306px] min-w-[306px] items-center justify-between rounded-[8px] border border-dashed border-[#99D8D3] bg-[#F8FAFC] px-3 py-2">
                              <span className="text-xs text-[#6B7280]">No Document</span>
                              <button
                                type="button"
                                className="inline-flex h-8 items-center justify-center rounded-md border border-[#99D8D3] px-4 text-xs font-semibold text-[#0D9488]"
                              >
                                Upload
                              </button>
                            </div>
                          ) : (
                            d.slots.map((slot) =>
                              slot.url ? (
                                <div
                                  key={`${d.id}-${slot.label}`}
                                  className="flex h-[50px] w-[306px] min-w-[306px] items-center gap-2 rounded-[8px] border border-[#99D8D3] bg-[#F8FAFC] px-3 py-2"
                                >
                                  <img src="/icons/pdf-icon.svg" alt="" className="h-6 w-6 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="truncate text-xs font-semibold leading-4 tracking-[0.01em] text-[#0D9488]">
                                      {d.id === "employment" ? authFileLabel : fileLabelFromUrl(slot.url)}
                                    </div>
                                    <div className="text-xs font-normal leading-4 tracking-[0.01em] text-[#6B7280]">
                                      5.23 MB
                                    </div>
                                  </div>
                                  {d.id === "employment" && authSigned ? (
                                    <span className="ml-auto rounded-md bg-[#7BE2DB] px-2 py-1 text-[10px] font-semibold text-[#0D9488]">
                                      Signed
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <div
                                  key={`${d.id}-${slot.label}`}
                                  className="flex h-[50px] w-[306px] min-w-[306px] items-center justify-between rounded-[8px] border border-dashed border-[#99D8D3] bg-[#F8FAFC] px-3 py-2"
                                >
                                  <span className="text-xs text-[#6B7280]">
                                    {slot.label === "Front" ? "Upload card front" : "Upload card back"}
                                  </span>
                                  <button
                                    type="button"
                                    className="inline-flex h-8 items-center justify-center rounded-md border border-[#99D8D3] bg-white px-4 text-xs font-semibold text-[#0D9488]"
                                  >
                                    Upload
                                  </button>
                                </div>
                              )
                            )
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className={`inline-flex h-8 items-center justify-center rounded-md px-4 text-xs font-semibold ${
                              d.slots.some((s) => s.url)
                                ? "bg-[#0D9488] text-white"
                                : "bg-[#E5E7EB] text-[#9CA3AF]"
                            }`}
                          >
                            Approved
                          </button>
                          <button
                            type="button"
                            className={`inline-flex h-8 items-center justify-center rounded-md px-4 text-xs font-semibold ${
                              d.slots.some((s) => s.url)
                                ? "border border-[#99D8D3] text-[#0D9488]"
                                : "border border-[#E5E7EB] text-[#9CA3AF]"
                            }`}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className={`inline-flex h-8 items-center justify-center rounded-md px-4 text-xs font-semibold ${
                              d.slots.some((s) => s.url)
                                ? "border border-[#99D8D3] text-[#0D9488]"
                                : "border border-[#E5E7EB] text-[#9CA3AF]"
                            }`}
                          >
                            Request a doc
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
