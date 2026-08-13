"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { X } from "lucide-react";
import BrandedUploadIcon from "@/app/components/BrandedUploadIcon";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import SuccessModal from "@/app/components/SuccessModal";
import ErrorModal from "@/app/components/ErrorModal";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { validateResumeUploadFile } from "@/lib/resume/validate-resume-upload";

type ResumeTab = "files" | "paste";

type AddCandidateModalProps = {
  open: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle?: string | null;
  onSuccess?: () => void;
};

const FIELD_LABEL_CLASS = "mb-1.5 block text-sm font-normal text-[#6B7280]";
const FIELD_INPUT_CLASS =
  "w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_12%,transparent)]";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 10 || unitIndex === 0 ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded} ${units[unitIndex]}`;
}

function ResumeTabBar({
  activeTab,
  onChange,
}: {
  activeTab: ResumeTab;
  onChange: (tab: ResumeTab) => void;
}) {
  const tabs: { id: ResumeTab; label: string }[] = [
    { id: "files", label: "Select Files" },
    { id: "paste", label: "Paste Resume Text" },
  ];

  return (
    <div className="flex w-full rounded-lg bg-[#F1F5F9] p-1">
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              active
                ? "border border-[#E2E8F0] bg-white text-[#334155] shadow-sm"
                : "border border-transparent text-[#64748B] hover:text-[#334155]"
            }`}
            aria-selected={active}
            role="tab"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function AddCandidateModal({
  open,
  onClose,
  jobId,
  jobTitle,
  onSuccess,
}: AddCandidateModalProps) {
  const branding = useTenantBranding();
  const brandVars = brandingToCssVars(branding) as CSSProperties;
  const primaryColor = branding.primaryHex || "#BC8B41";
  const secondaryColor = branding.secondaryHex || "#012352";

  const [activeTab, setActiveTab] = useState<ResumeTab>("files");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeTitle, setResumeTitle] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successCandidateName, setSuccessCandidateName] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setActiveTab("files");
    setResumeFile(null);
    setResumeTitle("");
    setResumeText("");
    setFileError(null);
    setPasteError(null);
    setDragActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !uploading && !successOpen && !errorOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, uploading, successOpen, errorOpen, onClose]);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  function handleClose() {
    if (uploading) return;
    resetForm();
    onClose();
  }

  function validateAndSetFile(file: File | null) {
    if (!file) {
      setResumeFile(null);
      setFileError(null);
      return;
    }
    const validationError = validateResumeUploadFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (validationError) {
      setResumeFile(null);
      setFileError(validationError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".doc")) {
      setResumeFile(null);
      setFileError(
        "Legacy .doc files are not supported. Please save the resume as .docx or PDF."
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setResumeFile(file);
    setFileError(null);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    validateAndSetFile(file);
  }

  async function handleUpload() {
    if (uploading) return;
    setFileError(null);
    setPasteError(null);

    if (!jobId.trim()) {
      setErrorMessage("Select a job before adding a candidate.");
      setErrorOpen(true);
      return;
    }

    if (activeTab === "files") {
      if (!resumeFile) {
        setFileError("Please select a resume file to upload.");
        return;
      }
    } else {
      const text = resumeText.trim();
      if (!text) {
        setPasteError("Please paste resume text.");
        return;
      }
      if (text.length < 80) {
        setPasteError(
          "Resume text is too short. Please paste the full resume with work history or contact details."
        );
        return;
      }
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.set("jobId", jobId.trim());
      if (activeTab === "files" && resumeFile) {
        form.set("resume", resumeFile);
      } else {
        form.set("resumeText", resumeText.trim());
        if (resumeTitle.trim()) form.set("resumeTitle", resumeTitle.trim());
      }

      const response = await fetch("/api/admin/add-candidate-from-resume", {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Failed to add candidate"
        );
      }

      const candidateName =
        typeof payload.candidateName === "string" ? payload.candidateName.trim() : "";
      setSuccessCandidateName(candidateName);
      setSuccessOpen(true);
    } catch (uploadError) {
      setErrorMessage(
        uploadError instanceof Error ? uploadError.message : "Failed to add candidate"
      );
      setErrorOpen(true);
    } finally {
      setUploading(false);
    }
  }

  function handleSuccessClose() {
    setSuccessOpen(false);
    resetForm();
    onClose();
    onSuccess?.();
  }

  if (!open && !successOpen && !errorOpen && !uploading) return null;

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={handleClose}
          style={brandVars}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-candidates-modal-title"
            className="relative flex w-full max-w-[560px] flex-col rounded-[20px] border border-[#E5E7EB] bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] px-6 py-5">
              <h2
                id="add-candidates-modal-title"
                className="text-xl font-semibold leading-7 text-[#101828]"
              >
                Add Candidates
              </h2>
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#101828] text-white transition hover:brightness-110 disabled:opacity-60"
                aria-label="Close"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </div>

            <div className="px-6 py-5">
              {jobTitle ? (
                <p className="mb-4 text-sm text-[#64748B]">
                  Adding candidate for{" "}
                  <span className="font-medium text-[#334155]">{jobTitle}</span>
                </p>
              ) : null}

              <ResumeTabBar
                activeTab={activeTab}
                onChange={(tab) => {
                  setActiveTab(tab);
                  setFileError(null);
                  setPasteError(null);
                }}
              />

              <div className="mt-5">
                {activeTab === "files" ? (
                  <div
                    className={`rounded-[10px] border-2 border-dashed bg-white p-4 transition ${
                      fileError
                        ? "border-[#FCA5A5]"
                        : dragActive
                          ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)]"
                          : "border-[color:var(--brand-primary)]"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {resumeFile ? (
                      <div className="flex items-center justify-between gap-3 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#E2E8F0] bg-white">
                            <BrandedSvgIcon
                              src="/icons/pdf-icon.svg"
                              className="h-5 w-5"
                              color={primaryColor}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#334155]">
                              {resumeFile.name}
                            </p>
                            <p className="text-xs text-[#64748B]">{formatBytes(resumeFile.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="rounded-md p-1 transition hover:bg-[color:var(--brand-primary)]/10"
                          aria-label="Remove uploaded resume"
                          onClick={() => validateAndSetFile(null)}
                          disabled={uploading}
                        >
                          <BrandedSvgIcon
                            src="/icons/delete-icon.svg"
                            className="h-6 w-6"
                            color={primaryColor}
                          />
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="add-candidate-resume-file"
                        className="flex cursor-pointer flex-col items-center justify-center py-4 text-center"
                      >
                        <BrandedUploadIcon primaryHex={primaryColor} className="h-9 w-9" />
                        <p className="mt-4 text-center text-sm font-medium leading-5 text-[#334155] sm:text-base sm:leading-6">
                          Drag your file(s) to start uploading
                        </p>
                        <div className="my-4 flex w-full max-w-[320px] items-center gap-3">
                          <div className="h-px flex-1 bg-[#CBD5E1]" aria-hidden />
                          <span className="text-sm font-medium leading-5 text-[#64748B]">OR</span>
                          <div className="h-px flex-1 bg-[#CBD5E1]" aria-hidden />
                        </div>
                        <span
                          className="inline-flex h-8 w-fit items-center justify-center rounded-lg border bg-white px-3 text-sm font-medium leading-5 transition hover:bg-[#F8FAFC]"
                          style={{ borderColor: primaryColor, color: primaryColor }}
                        >
                          Browse files
                        </span>
                        <p className="mt-4 text-xs leading-4 text-[#6B7280]">
                          Max 10 MB files are allowed
                        </p>
                      </label>
                    )}
                    <input
                      ref={fileInputRef}
                      id="add-candidate-resume-file"
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="sr-only"
                      disabled={uploading}
                      onChange={(event) => {
                        validateAndSetFile(event.target.files?.[0] ?? null);
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className={FIELD_LABEL_CLASS} htmlFor="add-candidate-resume-title">
                        Resume Title
                      </label>
                      <input
                        id="add-candidate-resume-title"
                        className={`${FIELD_INPUT_CLASS} h-10`}
                        placeholder="Resume title"
                        value={resumeTitle}
                        onChange={(event) => setResumeTitle(event.target.value)}
                        disabled={uploading}
                      />
                    </div>
                    <div>
                      <label className={FIELD_LABEL_CLASS} htmlFor="add-candidate-resume-text">
                        Resume
                      </label>
                      <textarea
                        id="add-candidate-resume-text"
                        className={`${FIELD_INPUT_CLASS} min-h-[220px] resize-y`}
                        placeholder="Paste resume text here..."
                        value={resumeText}
                        onChange={(event) => {
                          setResumeText(event.target.value);
                          setPasteError(null);
                        }}
                        disabled={uploading}
                      />
                    </div>
                  </div>
                )}

                {fileError ? <p className="mt-2 text-xs text-[#B91C1C]">{fileError}</p> : null}
                {pasteError ? <p className="mt-2 text-xs text-[#B91C1C]">{pasteError}</p> : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="inline-flex h-10 min-w-[100px] items-center justify-center rounded-lg border border-[#CBD5E1] bg-white px-5 text-sm font-medium text-[#334155] transition hover:bg-[#F8FAFC] disabled:opacity-60"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={uploading}
                className="inline-flex h-10 min-w-[100px] items-center justify-center rounded-lg px-5 text-sm font-medium text-white transition hover:opacity-95 disabled:opacity-60"
                style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
              >
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {uploading ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
          <div className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 text-sm font-medium text-[#334155] shadow-lg">
            Parsing resume and adding candidate…
          </div>
        </div>
      ) : null}

      <SuccessModal
        open={successOpen}
        onClose={handleSuccessClose}
        title="Success!"
        message={
          successCandidateName
            ? `${successCandidateName} was added successfully.`
            : "Candidate was added successfully."
        }
        size="large"
        actionLabel="Close"
        onAction={handleSuccessClose}
      />

      <ErrorModal
        open={errorOpen}
        onClose={() => {
          setErrorOpen(false);
          setErrorMessage("");
        }}
        title="Upload failed"
        message={errorMessage || "Failed to add candidate. Please try again."}
      />
    </>
  );
}
