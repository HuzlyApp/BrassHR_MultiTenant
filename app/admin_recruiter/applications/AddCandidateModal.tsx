"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { Loader2, X } from "lucide-react";
import type { AdminResumeParsePreview } from "@/app/api/admin/add-candidate-from-resume/parse/route";
import BrandedUploadIcon from "@/app/components/BrandedUploadIcon";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import SuccessModal from "@/app/components/SuccessModal";
import ErrorModal from "@/app/components/ErrorModal";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { validateAddCandidateField } from "@/lib/jobs/add-candidate-validation";
import { validateResumeUploadFile } from "@/lib/resume/validate-resume-upload";

type ResumeTab = "files" | "paste";

type ParseState = "idle" | "parsing" | "parsed" | "failed";

const PARSE_FAILED_FALLBACK =
  "Resume parsing failed. Please upload a valid resume or fill in the required fields manually.";
const MIN_PASTED_RESUME_LENGTH = 80;

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

function ParseStatusBadge({ state }: { state: ParseState }) {
  if (state === "idle") return null;

  const styles: Record<Exclude<ParseState, "idle">, { label: string; className: string }> = {
    parsing: { label: "PARSING…", className: "border-[#CBD5E1] bg-[#F1F5F9] text-[#475569]" },
    parsed: { label: "PARSED", className: "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]" },
    failed: { label: "PARSE FAILED", className: "border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]" },
  };
  const { label, className } = styles[state];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${className}`}
    >
      {label}
    </span>
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
  const [parseState, setParseState] = useState<ParseState>("idle");
  const [parsePreview, setParsePreview] = useState<AdminResumeParsePreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Ignore responses from parses the recruiter has already superseded. */
  const parseRequestRef = useRef(0);

  const resetParse = useCallback(() => {
    parseRequestRef.current += 1;
    setParseState("idle");
    setParsePreview(null);
    setParseError(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
  }, []);

  const resetForm = useCallback(() => {
    setActiveTab("files");
    setResumeFile(null);
    setResumeTitle("");
    setResumeText("");
    setFileError(null);
    setPasteError(null);
    setDragActive(false);
    resetParse();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [resetParse]);

  const runParse = useCallback(
    async (source: { file?: File | null; text?: string; title?: string }) => {
      const requestId = parseRequestRef.current + 1;
      parseRequestRef.current = requestId;
      setParseState("parsing");
      setParsePreview(null);
      setParseError(null);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");

      try {
        const form = new FormData();
        if (source.file) {
          form.set("resume", source.file);
        } else {
          form.set("resumeText", (source.text ?? "").trim());
          if (source.title?.trim()) form.set("resumeTitle", source.title.trim());
        }

        const response = await fetch("/api/admin/add-candidate-from-resume/parse", {
          method: "POST",
          credentials: "include",
          body: form,
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          warning?: string | null;
          qualityOk?: boolean;
          parsed?: AdminResumeParsePreview;
        };
        if (parseRequestRef.current !== requestId) return;

        const preview = payload.parsed ?? null;
        if (preview) {
          setParsePreview(preview);
          setFirstName(preview.firstName ?? "");
          setLastName(preview.lastName ?? "");
          setEmail(preview.email ?? "");
          setPhone(preview.phone ?? "");
        }

        const hasIdentity = Boolean(
          preview?.firstName?.trim() && preview?.lastName?.trim() && preview?.email?.trim()
        );
        if (response.ok && hasIdentity) {
          setParseState("parsed");
          return;
        }

        setParseState("failed");
        setParseError(
          payload.warning?.trim() || payload.error?.trim() || PARSE_FAILED_FALLBACK
        );
      } catch {
        if (parseRequestRef.current !== requestId) return;
        setParseState("failed");
        setParseError("Could not parse the resume. Please check your connection and try again.");
      }
    },
    []
  );

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
    resetParse();
    if (!file) {
      setResumeFile(null);
      setFileError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
    void runParse({ file });
  }

  function handleParsePastedResume() {
    const text = resumeText.trim();
    if (!text) {
      setPasteError("Please paste resume text.");
      return;
    }
    if (text.length < MIN_PASTED_RESUME_LENGTH) {
      setPasteError(
        "Resume text is too short. Please paste the full resume with work history or contact details."
      );
      return;
    }
    setPasteError(null);
    void runParse({ text, title: resumeTitle });
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

    if (parseState === "parsing") {
      const message = "Please wait for the resume to finish parsing.";
      if (activeTab === "files") setFileError(message);
      else setPasteError(message);
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
      if (text.length < MIN_PASTED_RESUME_LENGTH) {
        setPasteError(
          "Resume text is too short. Please paste the full resume with work history or contact details."
        );
        return;
      }
    }

    const nameError = validateAddCandidateField("name", {
      name: [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(" "),
    });
    const emailError = validateAddCandidateField("email", { email });
    if (nameError || emailError) {
      const message = nameError || emailError || "Fill in the candidate name and email.";
      if (activeTab === "files") setFileError(message);
      else setPasteError(message);
      return;
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
      if (firstName.trim()) form.set("firstName", firstName.trim());
      if (lastName.trim()) form.set("lastName", lastName.trim());
      if (email.trim()) form.set("email", email.trim());
      if (phone.trim()) form.set("phone", phone.trim());

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

  const hasResumeSource =
    activeTab === "files"
      ? Boolean(resumeFile)
      : resumeText.trim().length >= MIN_PASTED_RESUME_LENGTH;
  const hasIdentity = Boolean(firstName.trim() && lastName.trim() && email.trim());
  const showIdentityFields = hasResumeSource && parseState !== "parsing";
  const canUpload = !uploading && parseState !== "parsing" && hasResumeSource && hasIdentity;

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
                  resetParse();
                }}
              />

              <div className="mt-5">
                {activeTab === "files" ? (
                  <div
                    className={`rounded-[10px] border-2 border-dashed bg-white p-4 transition ${
                      fileError || parseState === "failed"
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
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-[#64748B]">
                                {formatBytes(resumeFile.size)}
                              </p>
                              <ParseStatusBadge state={parseState} />
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="rounded-md p-1 transition hover:bg-[color:var(--brand-primary)]/10"
                          aria-label="Remove uploaded resume"
                          onClick={() => validateAndSetFile(null)}
                          disabled={uploading || parseState === "parsing"}
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
                          if (parseState !== "idle") resetParse();
                        }}
                        disabled={uploading}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleParsePastedResume}
                        disabled={uploading || parseState === "parsing" || !resumeText.trim()}
                        className="inline-flex h-9 items-center justify-center rounded-lg border bg-white px-4 text-sm font-medium transition hover:bg-[#F8FAFC] disabled:opacity-60"
                        style={{ borderColor: primaryColor, color: primaryColor }}
                      >
                        {parseState === "parsing" ? "Parsing…" : "Parse resume text"}
                      </button>
                      <ParseStatusBadge state={parseState} />
                    </div>
                  </div>
                )}

                {parseState === "parsing" ? (
                  <p className="mt-3 flex items-center gap-2 text-xs text-[#64748B]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Parsing resume to read the candidate details…
                  </p>
                ) : null}

                {parseState === "failed" && parseError ? (
                  <p className="mt-3 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]">
                    {parseError} Fill in any missing details below to continue.
                  </p>
                ) : null}

                {fileError ? <p className="mt-2 text-xs text-[#B91C1C]">{fileError}</p> : null}
                {pasteError ? <p className="mt-2 text-xs text-[#B91C1C]">{pasteError}</p> : null}
              </div>

              {showIdentityFields ? (
                <div className="mt-5 border-t border-[#E5E7EB] pt-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[#334155]">Candidate details</p>
                    {parsePreview?.jobRole ? (
                      <p className="truncate text-xs text-[#64748B]">{parsePreview.jobRole}</p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={FIELD_LABEL_CLASS} htmlFor="add-candidate-first-name">
                        First name
                      </label>
                      <input
                        id="add-candidate-first-name"
                        className={`${FIELD_INPUT_CLASS} h-10`}
                        placeholder="First name"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        disabled={uploading}
                        autoComplete="given-name"
                      />
                    </div>
                    <div>
                      <label className={FIELD_LABEL_CLASS} htmlFor="add-candidate-last-name">
                        Last name
                      </label>
                      <input
                        id="add-candidate-last-name"
                        className={`${FIELD_INPUT_CLASS} h-10`}
                        placeholder="Last name"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        disabled={uploading}
                        autoComplete="family-name"
                      />
                    </div>
                    <div>
                      <label className={FIELD_LABEL_CLASS} htmlFor="add-candidate-email">
                        Email
                      </label>
                      <input
                        id="add-candidate-email"
                        className={`${FIELD_INPUT_CLASS} h-10`}
                        placeholder="Email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        disabled={uploading}
                        autoComplete="email"
                      />
                    </div>
                    <div>
                      <label className={FIELD_LABEL_CLASS} htmlFor="add-candidate-phone">
                        Phone
                      </label>
                      <input
                        id="add-candidate-phone"
                        className={`${FIELD_INPUT_CLASS} h-10`}
                        placeholder="Phone"
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        disabled={uploading}
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
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
                disabled={!canUpload}
                title={
                  canUpload
                    ? undefined
                    : parseState === "parsing"
                      ? "Please wait for the resume to finish parsing"
                      : "Upload a resume and fill in name and email"
                }
                className="inline-flex h-10 min-w-[100px] items-center justify-center rounded-lg px-5 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
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
            Adding candidate…
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
