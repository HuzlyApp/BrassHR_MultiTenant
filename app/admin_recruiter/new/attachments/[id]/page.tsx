"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCandidateDetailChromeActive } from "../../../components/CandidateDetailChrome";
import DetailedCandidateHeader from "../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../components/DetailedTabs";
import CandidateDetailLoader from "../../../components/CandidateDetailLoader";
import {
  fetchStaffDetailJson,
  workerProfileApiUrl,
} from "@/lib/admin/staff-detail-fetch-cache";
import CandidateDocumentsFilesTable, {
  type DocumentsFileRow,
} from "../../../components/CandidateDocumentsFilesTable";
import type { ProfessionDocumentKind } from "@/lib/professions/profession-documents";
import {
  Briefcase,
  Calendar,
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
import type { OnboardingStepType } from "@/lib/onboarding/types";

type WorkerProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  job_role: string | null;
  status_label?: string;
  profile_photo_url?: string | null;
};

type AttachmentRequirement = {
  id: string;
  title: string;
  url: string | null;
  filename: string;
  required_document_id?: string | null;
  submitted_document_id?: string | null;
  legacy_document_key?: string | null;
  status?: string | null;
  step_type?: OnboardingStepType;
  step_key?: string;
  phase?: "pre_hire" | "post_hire";
  step_title?: string;
  is_required?: boolean;
  document_kind?: ProfessionDocumentKind | null;
  has_expiration?: boolean;
  issued_date?: string | null;
  expiry_date?: string | null;
  uploaded_by?: string | null;
  files?: Array<{
    id: string;
    url: string | null;
    filename: string;
    status: string | null;
    uploaded_by?: string | null;
  }>;
};

type WorkerProfileResponse = {
  worker: WorkerProfile;
  attachment_requirements?: AttachmentRequirement[];
};

type SettingsDocument = {
  id: string;
  name: string;
  documentKind: ProfessionDocumentKind;
  isRequired: boolean;
  hasExpiration: boolean;
};

type SettingsProfession = {
  id: string;
  name: string;
  documents: SettingsDocument[];
};

type SettingsCatalog = {
  canManage: boolean;
  workerProfessionId: string | null;
  savedProfessionId: string | null;
  professions: SettingsProfession[];
};

type AttachmentRow = DocumentsFileRow;

function attachmentRowKey(
  row: Omit<AttachmentRow, "key">,
  index: number
): string {
  if (row.requiredDocumentId) return `req-${row.requiredDocumentId}`;
  if (row.stepKey) return `step-${row.stepKey}`;
  return `${row.id}-${index}`;
}

function isResumeAttachmentRow(row: Pick<AttachmentRow, "id" | "stepType">): boolean {
  return row.stepType === "resume_upload" || row.id === "resume";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

export default function NewApplicantAttachmentsFilledPage() {
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const applicantId = params?.id;
  const chromeActive = useCandidateDetailChromeActive();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<WorkerProfileResponse | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingUploadRow, setPendingUploadRow] = useState<AttachmentRow | null>(null);
  const [settings, setSettings] = useState<SettingsCatalog | null>(null);
  const [professionId, setProfessionId] = useState("");
  const [fileNameDrafts, setFileNameDrafts] = useState<Record<string, string>>({});
  const [dateDrafts, setDateDrafts] = useState<
    Record<string, { issuedDate: string; expiryDate: string }>
  >({});
  const [savingDocuments, setSavingDocuments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchApplicant = useCallback(async (quiet = false) => {
    if (!applicantId) return;
    if (!quiet) setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchStaffDetailJson<WorkerProfileResponse & { error?: string }>(
        workerProfileApiUrl(applicantId),
        quiet ? { bust: true } : undefined
      );
      if (!result.ok) {
        throw new Error(result.payload.error || `Failed to load profile (${result.status})`);
      }
      setProfile(result.payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Failed to fetch applicant for attachments:", msg, e);
      setLoadError(msg);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [applicantId]);

  const loadSettings = useCallback(async () => {
    if (!applicantId) return;
    const response = await fetch(
      `/api/admin/profession-documents?workerId=${encodeURIComponent(applicantId)}`
    );
    const payload = (await response.json()) as SettingsCatalog & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not load document settings");
    setSettings(payload);
    setProfessionId(payload.savedProfessionId || payload.workerProfessionId || "");
  }, [applicantId]);

  useEffect(() => {
    void fetchApplicant();
    void loadSettings().catch((error: unknown) => {
      setUploadError(error instanceof Error ? error.message : "Could not load document settings");
    });
  }, [fetchApplicant, loadSettings]);

  const selectedProfession = settings?.professions.find((profession) => profession.id === professionId) ?? null;

  async function commitFileName(
    row: AttachmentRow,
    file: { id: string; filename: string },
    draftKey: string
  ) {
    if (!applicantId) return;
    const fileName = (fileNameDrafts[draftKey] ?? file.filename).trim();
    if (!fileName || fileName === file.filename || fileName === "—") return;
    setSavingDocuments(true);
    setUploadError(null);
    try {
      const response = await fetch("/api/admin/profession-documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: applicantId,
          fileName,
          professionUploadId: file.id.startsWith("legacy") ? undefined : file.id,
          professionDocumentId: row.requiredDocumentId,
          submittedDocumentId: row.submittedDocumentId,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not rename file");
      await fetchApplicant(true);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not rename file");
    } finally {
      setSavingDocuments(false);
    }
  }

  function rowNeedsExpiration(row: AttachmentRow): boolean {
    if (row.hasExpiration) return true;
    return (
      selectedProfession?.documents.find((document) => document.id === row.requiredDocumentId)
        ?.hasExpiration === true
    );
  }

  function patchDateDraft(rowKey: string, patch: Partial<{ issuedDate: string; expiryDate: string }>) {
    setDateDrafts((current) => ({
      ...current,
      [rowKey]: {
        issuedDate: patch.issuedDate ?? current[rowKey]?.issuedDate ?? "",
        expiryDate: patch.expiryDate ?? current[rowKey]?.expiryDate ?? "",
      },
    }));
  }

  const openUploadPicker = (row: AttachmentRow) => {
    setUploadError(null);
    if (rowNeedsExpiration(row)) {
      const dates = dateDrafts[row.key] ?? {
        issuedDate: row.issuedDate ?? "",
        expiryDate: row.expiryDate ?? "",
      };
      if (!dates.issuedDate.trim() || !dates.expiryDate.trim()) {
        setUploadError(`Add issued and expiry dates for ${row.title} before uploading.`);
        return;
      }
      if (dates.expiryDate < dates.issuedDate) {
        setUploadError(`Expiry date for ${row.title} must be on or after the issued date.`);
        return;
      }
    }
    setPendingUploadRow(row);
    const input = fileInputRef.current;
    if (input) {
      const settingsDoc = selectedProfession?.documents.find(
        (document) => document.id === row.requiredDocumentId
      );
      input.multiple = Boolean(settingsDoc) && !isResumeAttachmentRow(row);
    }
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (fileList: FileList | null) => {
    const row = pendingUploadRow;
    setPendingUploadRow(null);
    const files = Array.from(fileList ?? []);
    if (!files.length || !row || !applicantId) return;

    const dates = dateDrafts[row.key] ?? {
      issuedDate: row.issuedDate ?? "",
      expiryDate: row.expiryDate ?? "",
    };
    const issuedDate = dates.issuedDate.trim();
    const expiryDate = dates.expiryDate.trim();
    if (rowNeedsExpiration(row) && (!issuedDate || !expiryDate)) {
      setUploadError(`Add issued and expiry dates for ${row.title} before uploading.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingId(row.key);
    setUploadError(null);

    try {
      for (const file of files.slice(0, 5)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("workerId", applicantId);
        fd.append("documentTitle", row.title);

        if (isResumeAttachmentRow(row)) {
          fd.append("attachmentKind", "resume");
        } else if (row.requiredDocumentId) {
          fd.append("requiredDocumentId", row.requiredDocumentId);
        } else {
          throw new Error(`Upload is not configured for "${row.title}".`);
        }
        if (issuedDate) fd.append("issuedDate", issuedDate);
        if (expiryDate) fd.append("expiryDate", expiryDate);

        const res = await fetch("/api/admin/worker-attachment-upload", {
          method: "POST",
          body: fd,
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(json.error || "Upload failed");
        }
      }

      await fetchApplicant();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setUploadError(msg);
    } finally {
      setUploadingId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
        fileInputRef.current.multiple = false;
      }
    }
  };

  const applicant = profile?.worker ?? null;

  const attachmentRows: AttachmentRow[] = useMemo(() => {
    if (!profile) return [];
    const fromConfig = (profile.attachment_requirements ?? []).filter((row) => {
      const kind = row.document_kind;
      // License/certificate rows belong on the License/Certifications tab.
      return kind !== "license" && kind !== "certificate";
    });
    return fromConfig.map((row, index) => {
      const settingsDoc = selectedProfession?.documents.find(
        (document) => document.id === row.required_document_id
      );
      const mapped = {
        id: row.id,
        title: row.title,
        url: row.url,
        filename: row.filename?.trim() ? row.filename : "—",
        requiredDocumentId: row.required_document_id ?? null,
        submittedDocumentId: row.submitted_document_id ?? null,
        legacyDocumentKey: row.legacy_document_key ?? null,
        status: row.status ?? null,
        stepType: row.step_type ?? null,
        stepKey: row.step_key ?? null,
        phase: row.phase ?? "pre_hire",
        stepTitle: row.step_title ?? row.title,
        isRequired: row.is_required !== false,
        documentKind: row.document_kind ?? null,
        hasExpiration: row.has_expiration === true || settingsDoc?.hasExpiration === true,
        issuedDate: row.issued_date ?? null,
        expiryDate: row.expiry_date ?? null,
        uploadedBy: row.uploaded_by ?? null,
        files:
          row.files && row.files.length
            ? row.files
            : row.url
              ? [
                  {
                    id: row.submitted_document_id || row.id,
                    url: row.url,
                    filename: row.filename?.trim() ? row.filename : "—",
                    status: row.status ?? null,
                    uploaded_by: row.uploaded_by ?? null,
                  },
                ]
              : [],
      };
      return {
        ...mapped,
        key: attachmentRowKey(mapped, index),
      };
    });
  }, [profile, selectedProfession]);

  useEffect(() => {
    setDateDrafts((current) => {
      const next = { ...current };
      for (const row of attachmentRows) {
        if (!row.hasExpiration) continue;
        if (next[row.key]?.issuedDate || next[row.key]?.expiryDate) continue;
        if (!row.issuedDate && !row.expiryDate) continue;
        next[row.key] = {
          issuedDate: row.issuedDate ?? "",
          expiryDate: row.expiryDate ?? "",
        };
      }
      return next;
    });
  }, [attachmentRows]);

  const openTopUploadPicker = () => {
    const preferred =
      attachmentRows.find((row) => !row.url && !row.files.some((file) => file.url)) ??
      attachmentRows.find((row) => !isResumeAttachmentRow(row)) ??
      attachmentRows[0];
    if (!preferred) {
      setUploadError("Add a document type from profession settings before uploading.");
      return;
    }
    openUploadPicker(preferred);
  };

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

        <div className="flex-1 w-full min-w-0 overflow-auto admin-recruiter-page-pad">
          <div className="admin-recruiter-content-width">
            {loadError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {loadError}
              </div>
            ) : null}

            {uploadError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {uploadError}
              </div>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg"
              onChange={(e) => {
                void handleFileSelected(e.target.files);
              }}
            />

            {loading && !chromeActive ? (
              <CandidateDetailLoader label="Loading attachments..." />
            ) : (
              <>
            {!chromeActive ? (
              <>
            <DetailedCandidateHeader
              name={candidateName}
              role={candidateRole}
              profilePhotoUrl={applicant?.profile_photo_url}
              workerId={applicantId}
              candidateEmail={applicant?.email ?? null}
            />
            <DetailedTabs applicantId={applicantId} activeTab="Attachments" />
              </>
            ) : null}

            {loading ? (
              <CandidateDetailLoader label="Loading attachments..." />
            ) : (
            <div className="w-full min-w-0 admin-recruiter-content-width">
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
                <CandidateDocumentsFilesTable
                  rows={attachmentRows}
                  uploadingKey={uploadingId}
                  canManage={Boolean(settings?.canManage)}
                  savingDocuments={savingDocuments}
                  dateDrafts={dateDrafts}
                  fileNameDrafts={fileNameDrafts}
                  onPatchDateDraft={patchDateDraft}
                  onOpenUpload={openUploadPicker}
                  onCommitFileName={(row, file, draftKey) =>
                    void commitFileName(row, file, draftKey)
                  }
                  onFileNameDraftChange={(draftKey, value) =>
                    setFileNameDrafts((current) => ({
                      ...current,
                      [draftKey]: value,
                    }))
                  }
                  onTopUploadClick={openTopUploadPicker}
                  topUploadDisabled={Boolean(uploadingId) || attachmentRows.length === 0}
                />
              </div>
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

