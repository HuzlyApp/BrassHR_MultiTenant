"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import BrandedUploadIcon from "@/app/components/BrandedUploadIcon";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import {
  type AddCandidateFieldErrors,
  type AddCandidateFieldKey,
  hasAddCandidateFieldErrors,
  validateAddCandidateForm,
  validateResumeFile,
} from "@/lib/jobs/add-candidate-validation";
import { formatPhoneNumber } from "@/lib/phone";

const FIELD_LABEL_CLASS = "mb-1.5 block text-sm font-normal text-[#6B7280]";
const FIELD_INPUT_CLASS =
  "h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_12%,transparent)]";
const FIELD_INPUT_ERROR_CLASS =
  "border-[#FCA5A5] text-[#B91C1C] focus:border-[#EF4444] focus:ring-[color:color-mix(in_srgb,#EF4444_12%,transparent)]";
const FIELD_SELECT_CLASS = `${FIELD_INPUT_CLASS} cursor-pointer appearance-none bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat pr-10`;
const CARD_CLASS = "rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6";
const SECTION_TITLE_CLASS = "text-base font-semibold text-[#111827]";

const SELECT_CHEVRON = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  )}")`,
} as const;

const COUNTRY_OPTIONS = ["United States of America", "Canada", "United Kingdom", "Other"];

type JobOption = {
  id: string;
  public_title: string | null;
  status: string | null;
};

function BrandBackIcon() {
  return (
    <span
      aria-hidden
      className="inline-block h-[14px] w-[14px] shrink-0"
      style={{
        backgroundColor: "currentColor",
        maskImage: "url(/eva_arrow-back-fill.svg)",
        WebkitMaskImage: "url(/eva_arrow-back-fill.svg)",
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

function FieldError({ message, id }: { message?: string | null; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-[#B91C1C]">
      {message}
    </p>
  );
}

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

function CollapsibleCard({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className={CARD_CLASS}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-[#64748B] transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? <div className="mt-5 space-y-4">{children}</div> : null}
    </section>
  );
}

function SuccessModal({
  open,
  onClose,
  brandStyle,
}: {
  open: boolean;
  onClose: () => void;
  brandStyle: CSSProperties;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-candidate-success-title"
        className="relative w-full max-w-[500px] rounded-[24px] bg-white px-8 pb-8 pt-10 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#101828] text-white transition hover:brightness-110"
          aria-label="Close"
        >
          <X className="h-3 w-3" strokeWidth={2.5} />
        </button>

        <div className="flex flex-col items-center text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#012352] text-white">
            <Check className="h-7 w-7" strokeWidth={2.5} aria-hidden />
          </span>
          <h2
            id="add-candidate-success-title"
            className="mt-6 text-2xl font-semibold text-black"
          >
            Success!
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 inline-flex h-11 min-w-[160px] items-center justify-center rounded-lg px-8 text-sm font-semibold text-white transition hover:opacity-95"
            style={brandStyle}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AddCandidateClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialJobId = searchParams.get("jobId")?.trim() || "";
  const branding = useTenantBranding();
  const brandVars = brandingToCssVars(branding) as CSSProperties;
  const brandStyle = {
    backgroundColor: branding.primaryHex || "var(--brand-primary)",
    borderColor: branding.primaryHex || "var(--brand-primary)",
  } as CSSProperties;
  const secondaryColor = branding.secondaryHex || "#012352";

  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [consideredFor, setConsideredFor] = useState(initialJobId);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [cityStateZip, setCityStateZip] = useState("");
  const [country, setCountry] = useState("United States of America");
  const [lastJobTitle, setLastJobTitle] = useState("");
  const [lastCompany, setLastCompany] = useState("");
  const [addressOpen, setAddressOpen] = useState(true);
  const [employmentOpen, setEmploymentOpen] = useState(true);
  const [successOpen, setSuccessOpen] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AddCandidateFieldErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const selectedJobId = consideredFor || initialJobId;
  const backHref = selectedJobId
    ? `/admin_recruiter/applications?jobId=${encodeURIComponent(selectedJobId)}`
    : "/admin_recruiter/jobs";

  useEffect(() => {
    let cancelled = false;
    setJobsLoading(true);
    void fetch("/api/admin/jobs?status=published", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof payload.error === "string" ? payload.error : "Failed to load jobs"
          );
        }
        const rows = Array.isArray(payload.jobs) ? (payload.jobs as JobOption[]) : [];
        if (cancelled) return;
        setJobs(rows);
        setConsideredFor((current) => {
          if (current && rows.some((job) => job.id === current)) return current;
          if (initialJobId && rows.some((job) => job.id === initialJobId)) return initialJobId;
          return current || "";
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load jobs");
        }
      })
      .finally(() => {
        if (!cancelled) setJobsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialJobId]);

  function clearFieldError(field: AddCandidateFieldKey) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleCancel() {
    router.push(backHref);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitAttempted(true);

    const nextFieldErrors = validateAddCandidateForm({
      consideredFor: selectedJobId,
      name,
      email,
      phone,
      resumeFile,
    });
    setFieldErrors(nextFieldErrors);
    if (hasAddCandidateFieldErrors(nextFieldErrors)) return;

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("jobId", selectedJobId);
      form.set("name", name.trim());
      form.set("email", email.trim());
      form.set("phone", phone.trim());
      form.set("streetAddress", street.trim());
      form.set("cityStateZip", cityStateZip.trim());
      form.set("country", country.trim());
      form.set("lastJobTitle", lastJobTitle.trim());
      form.set("lastCompany", lastCompany.trim());
      if (resumeFile) form.set("resume", resumeFile);

      const response = await fetch("/api/admin/job-applications", {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Failed to add candidate"
        );
      }
      setSuccessOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add candidate");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSuccessClose() {
    setSuccessOpen(false);
    router.push(backHref);
    router.refresh();
  }

  return (
    <div className="w-full px-3 pt-5 sm:px-5 lg:px-8 lg:pt-[30px]" style={brandVars}>
      <div className="mx-auto w-full max-w-full lg:max-w-[min(100%,calc(100vw/3))]">
        <Link
          href={backHref}
          className="mb-5 inline-flex items-center gap-1 text-[10px] font-semibold leading-[15px] transition hover:opacity-80"
          style={{ color: secondaryColor }}
        >
          <BrandBackIcon />
          Back to candidates
        </Link>

        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4 pb-8">
          <section className={CARD_CLASS}>
            <h1 className="text-[20px] font-semibold leading-7 text-black">Add candidate</h1>
            <div className="mt-5">
              <label className={FIELD_LABEL_CLASS} htmlFor="considered-for">
                Considered for <span className="text-[#EF4444]">*</span>
              </label>
              <select
                id="considered-for"
                className={`${FIELD_SELECT_CLASS} ${submitAttempted && fieldErrors.consideredFor ? FIELD_INPUT_ERROR_CLASS : ""}`}
                style={SELECT_CHEVRON}
                value={selectedJobId}
                onChange={(event) => {
                  setConsideredFor(event.target.value);
                  clearFieldError("consideredFor");
                }}
                disabled={jobsLoading || submitting}
                aria-invalid={Boolean(submitAttempted && fieldErrors.consideredFor)}
                aria-describedby={
                  submitAttempted && fieldErrors.consideredFor ? "considered-for-error" : undefined
                }
              >
                <option value="">
                  {jobsLoading ? "Loading jobs…" : "Select job"}
                </option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {String(job.public_title ?? "").trim() || "Untitled job"}
                  </option>
                ))}
              </select>
              {submitAttempted ? (
                <FieldError message={fieldErrors.consideredFor} id="considered-for-error" />
              ) : null}
            </div>
          </section>

          <section className={CARD_CLASS}>
            <h2 className={SECTION_TITLE_CLASS}>Personal information</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className={FIELD_LABEL_CLASS} htmlFor="candidate-name">
                  Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="candidate-name"
                  className={`${FIELD_INPUT_CLASS} ${submitAttempted && fieldErrors.name ? FIELD_INPUT_ERROR_CLASS : ""}`}
                  placeholder="Name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    clearFieldError("name");
                  }}
                  disabled={submitting}
                  aria-invalid={Boolean(submitAttempted && fieldErrors.name)}
                  aria-describedby={submitAttempted && fieldErrors.name ? "candidate-name-error" : undefined}
                />
                {submitAttempted ? (
                  <FieldError message={fieldErrors.name} id="candidate-name-error" />
                ) : null}
              </div>
              <div>
                <label className={FIELD_LABEL_CLASS} htmlFor="candidate-email">
                  Email address <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="candidate-email"
                  type="email"
                  className={`${FIELD_INPUT_CLASS} ${submitAttempted && fieldErrors.email ? FIELD_INPUT_ERROR_CLASS : ""}`}
                  placeholder="Email address *"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearFieldError("email");
                  }}
                  disabled={submitting}
                  aria-invalid={Boolean(submitAttempted && fieldErrors.email)}
                  aria-describedby={
                    submitAttempted && fieldErrors.email ? "candidate-email-error" : undefined
                  }
                />
                {submitAttempted ? (
                  <FieldError message={fieldErrors.email} id="candidate-email-error" />
                ) : null}
              </div>
              <div>
                <label className={FIELD_LABEL_CLASS} htmlFor="candidate-phone">
                  Phone <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="candidate-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className={`${FIELD_INPUT_CLASS} ${submitAttempted && fieldErrors.phone ? FIELD_INPUT_ERROR_CLASS : ""}`}
                  placeholder="Phone"
                  value={phone}
                  onChange={(event) => {
                    setPhone(formatPhoneNumber(event.target.value));
                    clearFieldError("phone");
                  }}
                  disabled={submitting}
                  aria-invalid={Boolean(submitAttempted && fieldErrors.phone)}
                  aria-describedby={
                    submitAttempted && fieldErrors.phone ? "candidate-phone-error" : undefined
                  }
                />
                {submitAttempted ? (
                  <FieldError message={fieldErrors.phone} id="candidate-phone-error" />
                ) : null}
              </div>

              <div>
                <p className={`${FIELD_LABEL_CLASS} mb-2`} id="candidate-resume-label">
                  Upload a resume
                </p>
                <div
                  className={`rounded-[10px] border-2 bg-white p-4 transition ${
                    submitAttempted && fieldErrors.resume
                      ? "border-[#FCA5A5]"
                      : "border-[#94A3B8] border-dashed"
                  }`}
                  aria-labelledby="candidate-resume-label"
                >
                  {resumeFile ? (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#E2E8F0] bg-white">
                          <BrandedSvgIcon
                            src="/icons/pdf-icon.svg"
                            className="h-5 w-5"
                            color={branding.primaryHex || "#BC8B41"}
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
                        onClick={() => {
                          setResumeFile(null);
                          clearFieldError("resume");
                          if (resumeInputRef.current) resumeInputRef.current.value = "";
                        }}
                        disabled={submitting}
                      >
                        <BrandedSvgIcon
                          src="/icons/delete-icon.svg"
                          className="h-6 w-6"
                          color={branding.primaryHex || "#BC8B41"}
                        />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="candidate-resume"
                      className="flex cursor-pointer flex-col items-center justify-center text-center"
                    >
                      <BrandedUploadIcon
                        primaryHex={branding.primaryHex || "#BC8B41"}
                        className="h-9 w-9"
                      />
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
                        style={{ borderColor: secondaryColor, color: secondaryColor }}
                      >
                        Browse files
                      </span>
                      <p className="mt-4 text-xs leading-4 text-[#6B7280]">
                        Max 10 MB files are allowed
                      </p>
                    </label>
                  )}
                  <input
                    ref={resumeInputRef}
                    id="candidate-resume"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="sr-only"
                    disabled={submitting}
                    aria-invalid={Boolean(submitAttempted && fieldErrors.resume)}
                    aria-describedby={
                      submitAttempted && fieldErrors.resume ? "candidate-resume-error" : undefined
                    }
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setResumeFile(file);
                      if (!file) {
                        clearFieldError("resume");
                        return;
                      }
                      const resumeError = validateResumeFile(file);
                      setFieldErrors((current) => {
                        const next = { ...current };
                        if (resumeError) next.resume = resumeError;
                        else delete next.resume;
                        return next;
                      });
                    }}
                  />
                </div>
                {submitAttempted || fieldErrors.resume ? (
                  <FieldError message={fieldErrors.resume} id="candidate-resume-error" />
                ) : null}
              </div>
            </div>
          </section>

          <CollapsibleCard
            title="Address"
            open={addressOpen}
            onToggle={() => setAddressOpen((value) => !value)}
          >
            <div>
              <label className={FIELD_LABEL_CLASS} htmlFor="candidate-street">
                Street address
              </label>
              <input
                id="candidate-street"
                className={FIELD_INPUT_CLASS}
                placeholder="Street address"
                value={street}
                onChange={(event) => setStreet(event.target.value)}
                disabled={submitting}
              />
            </div>
            <div>
              <label className={FIELD_LABEL_CLASS} htmlFor="candidate-city">
                City, state, or zipcode
              </label>
              <input
                id="candidate-city"
                className={FIELD_INPUT_CLASS}
                placeholder="City, state, or zipcode"
                value={cityStateZip}
                onChange={(event) => setCityStateZip(event.target.value)}
                disabled={submitting}
              />
            </div>
            <div>
              <label className={FIELD_LABEL_CLASS} htmlFor="candidate-country">
                Country
              </label>
              <select
                id="candidate-country"
                className={FIELD_SELECT_CLASS}
                style={SELECT_CHEVRON}
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                disabled={submitting}
              >
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </CollapsibleCard>

          <CollapsibleCard
            title="Employment information"
            open={employmentOpen}
            onToggle={() => setEmploymentOpen((value) => !value)}
          >
            <div>
              <label className={FIELD_LABEL_CLASS} htmlFor="candidate-last-title">
                Last job title
              </label>
              <input
                id="candidate-last-title"
                className={FIELD_INPUT_CLASS}
                placeholder="Last job title"
                value={lastJobTitle}
                onChange={(event) => setLastJobTitle(event.target.value)}
                disabled={submitting}
              />
            </div>
            <div>
              <label className={FIELD_LABEL_CLASS} htmlFor="candidate-last-company">
                Last company
              </label>
              <input
                id="candidate-last-company"
                className={FIELD_INPUT_CLASS}
                placeholder="Last company"
                value={lastCompany}
                onChange={(event) => setLastCompany(event.target.value)}
                disabled={submitting}
              />
            </div>
          </CollapsibleCard>

          {error ? (
            <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
              {error}
            </p>
          ) : null}

          <div className="flex w-full items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={submitting}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white px-5 text-sm font-medium text-[#334155] transition hover:bg-[#F8FAFC] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || jobsLoading}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg px-5 text-sm font-medium text-white transition hover:opacity-95 disabled:opacity-60"
              style={brandStyle}
            >
              {submitting ? "Adding…" : "Add candidate"}
            </button>
          </div>
        </form>
      </div>

      <SuccessModal open={successOpen} onClose={handleSuccessClose} brandStyle={brandStyle} />
    </div>
  );
}
