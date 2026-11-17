"use client";

import { useMemo } from "react";
import { Download, Plus, Upload } from "lucide-react";
import BrandedDeleteIcon from "@/app/admin_recruiter/components/BrandedDeleteIcon";
import BrandedFileTypeIcon from "@/app/admin_recruiter/components/BrandedFileTypeIcon";
import { isPdfFile, pathOrUrlForExtension } from "@/lib/document-upload-helpers";
import type { ProfessionDocumentKind } from "@/lib/professions/profession-documents";
import { unifiedDocumentTypeLabel } from "@/lib/professions/profession-documents";
import { isProfessionDocumentExpired } from "@/lib/onboarding/profession-step-uploads";
import type { OnboardingStepType } from "@/lib/onboarding/types";

export type DocumentsFileRow = {
  key: string;
  id: string;
  title: string;
  url: string | null;
  filename: string;
  requiredDocumentId: string | null;
  submittedDocumentId: string | null;
  legacyDocumentKey: string | null;
  status: string | null;
  stepType: OnboardingStepType | null;
  stepKey: string | null;
  stepTitle: string;
  phase: "pre_hire" | "post_hire";
  isRequired: boolean;
  documentKind: ProfessionDocumentKind | null;
  hasExpiration: boolean;
  issuedDate: string | null;
  expiryDate: string | null;
  uploadedBy: string | null;
  files: Array<{
    id: string;
    url: string | null;
    filename: string;
    status: string | null;
    uploaded_by?: string | null;
  }>;
};

type FileIconType = "jpeg" | "pdf" | "docx";

function fileIconType(filename: string, url: string | null): FileIconType {
  if (isPdfFile(null, filename, url)) return "pdf";
  const path = pathOrUrlForExtension(filename || url || "");
  if (/\.(docx?|rtf)$/i.test(path)) return "docx";
  if (/\.(png|jpe?g|webp|gif)$/i.test(path)) return "jpeg";
  return "pdf";
}

type DocumentLifecycleStatus = "Requested" | "Active" | "Expired";

function resolveDocumentLifecycleStatus(
  hasFile: boolean,
  expiryDate: string | null | undefined
): DocumentLifecycleStatus {
  if (!hasFile) return "Requested";
  if (isProfessionDocumentExpired(expiryDate)) return "Expired";
  return "Active";
}

function StatusBadge({ status }: { status: DocumentLifecycleStatus }) {
  if (status === "Requested") {
    return (
      <span className="inline-flex items-center rounded-md bg-[#F3F4F6] px-2.5 py-1 text-xs font-semibold text-[#6B7280]">
        Requested
      </span>
    );
  }
  if (status === "Expired") {
    return (
      <span className="inline-flex items-center rounded-md bg-[#FEE2E2] px-2.5 py-1 text-xs font-semibold text-[#B91C1C]">
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-[#DCFCE7] px-2.5 py-1 text-xs font-semibold text-[#166534]">
      Active
    </span>
  );
}

function DocTypeTag({ label }: { label: string }) {
  const styles =
    label === "License"
      ? "bg-[#DBEAFE] text-[#1D4ED8]"
      : label === "Certification"
        ? "bg-[#EDE9FE] text-[#6D28D9]"
        : label === "Resume"
          ? "bg-[#E0F2FE] text-[#0369A1]"
          : "bg-[#F3F4F6] text-[#4B5563]";

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      {label}
    </span>
  );
}

function dash(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? text : "—";
}

type CandidateDocumentsFilesTableProps = {
  rows: DocumentsFileRow[];
  uploadingKey: string | null;
  canManage: boolean;
  savingDocuments: boolean;
  dateDrafts: Record<string, { issuedDate: string; expiryDate: string }>;
  fileNameDrafts: Record<string, string>;
  onPatchDateDraft: (
    rowKey: string,
    patch: Partial<{ issuedDate: string; expiryDate: string }>
  ) => void;
  onOpenUpload: (row: DocumentsFileRow) => void;
  onDeleteFile?: (
    row: DocumentsFileRow,
    file: { id: string; filename: string; url: string | null }
  ) => void;
  onCommitFileName: (
    row: DocumentsFileRow,
    file: { id: string; filename: string },
    draftKey: string
  ) => void;
  onFileNameDraftChange: (draftKey: string, value: string) => void;
  onTopUploadClick: () => void;
  topUploadDisabled?: boolean;
};

function DocumentRows({
  rows,
  uploadingKey,
  canManage,
  savingDocuments,
  dateDrafts,
  onOpenUpload,
  onDeleteFile,
}: Omit<
  CandidateDocumentsFilesTableProps,
  | "onTopUploadClick"
  | "topUploadDisabled"
  | "fileNameDrafts"
  | "onCommitFileName"
  | "onFileNameDraftChange"
  | "onPatchDateDraft"
> & {
  dateDrafts: Record<string, { issuedDate: string; expiryDate: string }>;
}) {
  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#6B7280]">
          No documents in this section yet.
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((row) => {
        const files =
          row.files.length > 0
            ? row.files
            : [
                {
                  id: row.submittedDocumentId || row.id,
                  url: row.url,
                  filename: row.filename,
                  status: row.status,
                  uploaded_by: row.uploadedBy,
                },
              ];
        const expiryValue = dateDrafts[row.key]?.expiryDate ?? row.expiryDate ?? "";
        const primaryFile = files.find((file) => file.url) ?? null;
        const primaryUrl = primaryFile?.url ?? row.url;
        const displayFilename =
          primaryFile?.filename ||
          (row.filename && row.filename !== "—" ? row.filename : null) ||
          null;
        const uploadedBy =
          primaryFile?.uploaded_by ||
          files.find((file) => file.uploaded_by)?.uploaded_by ||
          row.uploadedBy ||
          null;
        const isResume = row.stepType === "resume_upload" || row.id === "resume";
        const documentType = unifiedDocumentTypeLabel(
          isResume ? "resume" : row.documentKind
        );
        const lifecycleStatus = resolveDocumentLifecycleStatus(
          Boolean(primaryUrl),
          expiryValue || row.expiryDate
        );
        const canAddAnotherFile =
          Boolean(primaryUrl) &&
          !isResume &&
          (row.files.length < 5 || !row.files.length);

        return (
          <tr key={row.key} className="border-b border-[#F3F4F6] last:border-b-0">
            <td className="px-4 py-3.5">
              <DocTypeTag label={documentType} />
            </td>
            <td className="px-4 py-3.5 text-sm font-medium text-[#111827]">
              <div className="flex flex-wrap items-center gap-2">
                <span>{row.title}</span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    row.isRequired
                      ? "bg-[#FEF3C7] text-[#92400E]"
                      : "bg-[#F3F4F6] text-[#4B5563]"
                  }`}
                >
                  {row.isRequired ? "Required" : "Optional"}
                </span>
              </div>
            </td>
            <td className="px-4 py-3.5">
              {primaryUrl && displayFilename ? (
                <div className="flex min-w-0 items-center gap-2.5">
                  <BrandedFileTypeIcon
                    type={fileIconType(displayFilename, primaryUrl)}
                    className="h-7 w-7 shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      window.open(primaryUrl, "_blank", "noopener,noreferrer")
                    }
                    className="max-w-[240px] truncate text-left text-sm font-semibold text-[color:var(--brand-primary)] hover:underline"
                  >
                    {displayFilename}
                  </button>
                </div>
              ) : (
                <span className="text-sm text-[#9CA3AF]">No file uploaded</span>
              )}
            </td>
            <td className="px-4 py-3.5 text-sm text-[#374151]">
              {primaryUrl ? dash(uploadedBy) : "—"}
            </td>
            <td className="px-4 py-3.5">
              <StatusBadge status={lifecycleStatus} />
            </td>
            <td className="px-4 py-3.5 text-sm">
              {primaryUrl ? (
                <a
                  href={primaryUrl}
                  download={displayFilename || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--brand-primary)] underline-offset-2 transition hover:underline"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Download
                </a>
              ) : (
                <button
                  type="button"
                  disabled={uploadingKey === row.key}
                  onClick={() => onOpenUpload(row)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[color:var(--brand-primary)] bg-white px-3 text-xs font-semibold text-[color:var(--brand-primary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden />
                  {uploadingKey === row.key ? "Uploading…" : "Upload"}
                </button>
              )}
            </td>
            <td className="px-4 py-3.5">
              <div className="flex items-center justify-end gap-1.5">
                {canAddAnotherFile ? (
                  <button
                    type="button"
                    disabled={uploadingKey === row.key}
                    onClick={() => onOpenUpload(row)}
                    className="inline-flex h-8 items-center rounded-md px-2 text-xs font-semibold text-[color:var(--brand-primary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)] disabled:opacity-50"
                  >
                    {uploadingKey === row.key ? "Uploading…" : "+ Add file"}
                  </button>
                ) : null}
                {canManage && primaryUrl && onDeleteFile && primaryFile?.url ? (
                  <button
                    type="button"
                    disabled={savingDocuments || uploadingKey === row.key}
                    onClick={() => onDeleteFile(row, primaryFile)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#94A3B8] transition hover:bg-[#F8FAFC] hover:text-[#64748B] disabled:opacity-40"
                    aria-label={`Delete ${displayFilename || row.title}`}
                  >
                    <BrandedDeleteIcon className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

export default function CandidateDocumentsFilesTable({
  rows,
  uploadingKey,
  canManage,
  savingDocuments,
  dateDrafts,
  onOpenUpload,
  onDeleteFile,
  onTopUploadClick,
  topUploadDisabled,
}: CandidateDocumentsFilesTableProps) {
  const preHireRows = useMemo(
    () => rows.filter((row) => row.phase !== "post_hire"),
    [rows]
  );
  const postHireRows = useMemo(
    () => rows.filter((row) => row.phase === "post_hire"),
    [rows]
  );

  const rowProps = {
    uploadingKey,
    canManage,
    savingDocuments,
    dateDrafts,
    onOpenUpload,
    onDeleteFile,
  };

  return (
    <div className="w-full space-y-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[#111827]">Documents</h3>
        <button
          type="button"
          disabled={topUploadDisabled}
          onClick={onTopUploadClick}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--brand-primary)] bg-white px-3.5 text-sm font-semibold text-[color:var(--brand-primary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add document
        </button>
      </div>

      {(
        [
          { title: "Pre-Hire", rows: preHireRows },
          { title: "Post-Hire", rows: postHireRows },
        ] as const
      ).map((section) => (
        <section key={section.title} className="space-y-3">
          <h4 className="text-sm font-semibold text-[#111827]">{section.title}</h4>
          <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Doc type
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Doc name
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      File name
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Uploaded by
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Upload / Download
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <DocumentRows rows={section.rows} {...rowProps} />
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
