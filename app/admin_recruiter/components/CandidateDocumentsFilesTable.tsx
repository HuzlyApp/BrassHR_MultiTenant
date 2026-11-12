"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import BrandedFileTypeIcon from "@/app/admin_recruiter/components/BrandedFileTypeIcon";
import { isPdfFile, pathOrUrlForExtension } from "@/lib/document-upload-helpers";
import type { ProfessionDocumentKind } from "@/lib/professions/profession-documents";
import { professionDocumentKindLabel } from "@/lib/professions/profession-documents";
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

function StatusBadge({ hasFile }: { hasFile: boolean }) {
  if (!hasFile) {
    return (
      <span className="inline-flex items-center rounded-md bg-[#F3F4F6] px-2.5 py-1 text-xs font-semibold text-[#6B7280]">
        Missing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-[#DBEAFE] px-2.5 py-1 text-xs font-semibold text-[#1D4ED8]">
      On file
    </span>
  );
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
  fileNameDrafts,
  onPatchDateDraft,
  onOpenUpload,
  onCommitFileName,
  onFileNameDraftChange,
}: Omit<CandidateDocumentsFilesTableProps, "onTopUploadClick" | "topUploadDisabled">) {
  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#6B7280]">
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
        const needsExpiration = row.hasExpiration;
        const issuedValue = dateDrafts[row.key]?.issuedDate ?? row.issuedDate ?? "";
        const expiryValue = dateDrafts[row.key]?.expiryDate ?? row.expiryDate ?? "";
        const primaryUrl = files.find((file) => file.url)?.url ?? row.url;
        const uploadedBy =
          files.find((file) => file.uploaded_by)?.uploaded_by || row.uploadedBy || null;

        return (
          <tr key={row.key} className="border-b border-[#F3F4F6] last:border-b-0 align-top">
            <td className="px-4 py-4">
              <div className="min-w-[140px]">
                <p className="text-sm font-semibold text-[#111827]">{row.title}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {row.phase === "post_hire" ? "Post-Hire" : "Pre-Hire"}
                  </span>
                  {row.documentKind ? (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {professionDocumentKindLabel(row.documentKind)}
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      row.isRequired
                        ? "bg-[#FEF3C7] text-[#92400E]"
                        : "bg-[#F3F4F6] text-[#4B5563]"
                    }`}
                  >
                    {row.isRequired ? "Required" : "Optional"}
                  </span>
                </div>
              </div>
            </td>
            <td className="px-4 py-4">
              <div className="space-y-2">
                {primaryUrl ? (
                  files.map((file) => {
                    const draftKey = `${row.key}:${file.id}`;
                    const icon = fileIconType(file.filename, file.url);
                    return (
                      <div key={file.id} className="flex min-w-0 items-start gap-2.5">
                        <BrandedFileTypeIcon
                          type={icon}
                          className="mt-0.5 h-7 w-7 shrink-0"
                        />
                        <div className="min-w-0">
                          {canManage &&
                          row.stepType !== "resume_upload" &&
                          row.id !== "resume" ? (
                            <input
                              value={fileNameDrafts[draftKey] ?? file.filename}
                              disabled={savingDocuments}
                              onChange={(event) =>
                                onFileNameDraftChange(draftKey, event.target.value)
                              }
                              onBlur={() => void onCommitFileName(row, file, draftKey)}
                              aria-label={`File name for ${file.filename}`}
                              className="h-7 w-full min-w-0 max-w-[240px] rounded border border-[#CBD5E1] bg-white px-2 text-sm font-semibold text-[color:var(--brand-primary)]"
                            />
                          ) : (
                            <button
                              type="button"
                              disabled={!file.url}
                              onClick={() =>
                                file.url &&
                                window.open(file.url, "_blank", "noopener,noreferrer")
                              }
                              className="block max-w-[260px] truncate text-left text-sm font-semibold text-[color:var(--brand-primary)] hover:underline disabled:cursor-default disabled:no-underline"
                            >
                              {file.filename || "Uploaded file"}
                            </button>
                          )}
                          <p className="mt-0.5 text-xs text-[#6B7280]">
                            Uploaded by{" "}
                            <span className="font-medium text-[#374151]">
                              {file.uploaded_by || uploadedBy || "—"}
                            </span>
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#9CA3AF]">No file uploaded</span>
                    <button
                      type="button"
                      disabled={uploadingKey === row.key}
                      onClick={() => onOpenUpload(row)}
                      className="text-sm font-semibold text-[color:var(--brand-primary)] hover:underline disabled:opacity-50"
                    >
                      {uploadingKey === row.key ? "Uploading…" : "Upload"}
                    </button>
                  </div>
                )}

                {needsExpiration ? (
                  <div className="grid max-w-[420px] gap-2 pt-1 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-[#64748B]">Issue date</span>
                      <input
                        type="date"
                        value={issuedValue}
                        disabled={savingDocuments || uploadingKey === row.key}
                        onChange={(event) =>
                          onPatchDateDraft(row.key, { issuedDate: event.target.value })
                        }
                        className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] disabled:bg-[#F8FAFC]"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-[#64748B]">Expiry date</span>
                      <input
                        type="date"
                        value={expiryValue}
                        disabled={savingDocuments || uploadingKey === row.key}
                        onChange={(event) =>
                          onPatchDateDraft(row.key, { expiryDate: event.target.value })
                        }
                        className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] disabled:bg-[#F8FAFC]"
                      />
                    </label>
                  </div>
                ) : null}

                {primaryUrl &&
                (row.files.length < 5 || !row.files.length) &&
                row.stepType !== "resume_upload" &&
                row.id !== "resume" ? (
                  <button
                    type="button"
                    disabled={uploadingKey === row.key}
                    onClick={() => onOpenUpload(row)}
                    className="text-xs font-semibold text-[color:var(--brand-primary)] hover:underline disabled:opacity-50"
                  >
                    {uploadingKey === row.key ? "Uploading…" : "+ Add file"}
                  </button>
                ) : null}
              </div>
            </td>
            <td className="px-4 py-4">
              <StatusBadge hasFile={Boolean(primaryUrl)} />
            </td>
            <td className="px-4 py-4 text-right">
              {primaryUrl ? (
                <a
                  href={primaryUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-[color:var(--brand-primary)] hover:underline"
                >
                  Download
                </a>
              ) : (
                <span className="text-sm font-medium text-[#CBD5E1]">Download</span>
              )}
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
  fileNameDrafts,
  onPatchDateDraft,
  onOpenUpload,
  onCommitFileName,
  onFileNameDraftChange,
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
    fileNameDrafts,
    onPatchDateDraft,
    onOpenUpload,
    onCommitFileName,
    onFileNameDraftChange,
  };

  return (
    <div className="w-full space-y-8">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold leading-7 text-[#111827]">Files</h3>
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
          <h4 className="text-sm font-semibold uppercase tracking-wide text-[#64748B]">
            {section.title}
          </h4>
          <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Type
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      File
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      Actions
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
