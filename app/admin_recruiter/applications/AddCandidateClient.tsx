"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import BrandedUploadIcon from "@/app/components/BrandedUploadIcon";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";

const FIELD_LABEL_CLASS = "mb-1.5 block text-sm font-normal text-[#6B7280]";
const FIELD_INPUT_CLASS =
  "h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#334155] outline-none transition placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_12%,transparent)]";
const FIELD_SELECT_CLASS = `${FIELD_INPUT_CLASS} cursor-pointer appearance-none bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat pr-10`;
const CARD_CLASS = "rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6";
const SECTION_TITLE_CLASS = "text-base font-semibold text-[#111827]";

const SELECT_CHEVRON = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  )}")`,
} as const;

const COUNTRY_OPTIONS = ["United States of America", "Canada", "United Kingdom", "Other"];

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-candidate-success-title"
        className="relative w-full max-w-[540px] rounded-2xl bg-white px-9 pb-9 pt-12 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1D2739] text-white transition hover:opacity-90"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>

        <div className="flex flex-col items-center text-center">
          <span className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-[#012352] text-white">
            <Check className="h-12 w-12" strokeWidth={2.5} />
          </span>
          <h2
            id="add-candidate-success-title"
            className="mt-7 text-3xl font-semibold text-black"
          >
            Success!
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="mt-8 inline-flex h-12 min-w-[180px] items-center justify-center rounded-lg px-8 text-base font-medium text-white transition hover:opacity-95"
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
  const jobId = searchParams.get("jobId")?.trim() || "";
  const branding = useTenantBranding();
  const brandVars = brandingToCssVars(branding) as CSSProperties;
  const brandStyle = {
    backgroundColor: branding.primaryHex || "var(--brand-primary)",
    borderColor: branding.primaryHex || "var(--brand-primary)",
  } as CSSProperties;
  const secondaryColor = branding.secondaryHex || "#012352";

  const [jobTitle, setJobTitle] = useState("Select job");
  const [consideredFor, setConsideredFor] = useState("");
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
  const [fileName, setFileName] = useState("");

  const backHref = jobId
    ? `/admin_recruiter/applications?jobId=${encodeURIComponent(jobId)}`
    : "/admin_recruiter/jobs";

  useEffect(() => {
    if (!jobId) return;
    void fetch(`/api/admin/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) return;
        const title = String(payload.job?.public_title ?? "").trim();
        if (title) {
          setJobTitle(title);
          setConsideredFor(title);
        }
      })
      .catch(() => undefined);
  }, [jobId]);

  function handleCancel() {
    router.push(backHref);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // UI-only for now — dynamic save comes later.
    setSuccessOpen(true);
  }

  function handleSuccessClose() {
    setSuccessOpen(false);
    router.push(backHref);
  }

  return (
    <div className="w-full px-8 pt-[30px]" style={brandVars}>
      <div className="mx-auto w-full max-w-[min(100%,calc(100vw/3))]">
        <Link
          href={backHref}
          className="mb-5 inline-flex items-center gap-1 text-[10px] font-semibold leading-[15px] transition hover:opacity-80"
          style={{ color: secondaryColor }}
        >
          <BrandBackIcon />
          Back to jobs
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
              className={FIELD_SELECT_CLASS}
              style={SELECT_CHEVRON}
              value={consideredFor}
              onChange={(event) => setConsideredFor(event.target.value)}
              required
            >
              {!consideredFor ? <option value="">Select job</option> : null}
              <option value={jobTitle || "Selected job"}>{jobTitle || "Selected job"}</option>
            </select>
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
                className={FIELD_INPUT_CLASS}
                placeholder="Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div>
              <label className={FIELD_LABEL_CLASS} htmlFor="candidate-email">
                Email address <span className="text-[#EF4444]">*</span>
              </label>
              <input
                id="candidate-email"
                type="email"
                className={FIELD_INPUT_CLASS}
                placeholder="Email address *"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div>
              <label className={FIELD_LABEL_CLASS} htmlFor="candidate-phone">
                Phone <span className="text-[#EF4444]">*</span>
              </label>
              <input
                id="candidate-phone"
                type="tel"
                className={FIELD_INPUT_CLASS}
                placeholder="Phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </div>

            <div>
              <p className={`${FIELD_LABEL_CLASS} mb-2`}>Upload a resume</p>
              <label
                htmlFor="candidate-resume"
                className="flex cursor-pointer flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-[#94A3B8] bg-white px-4 py-6 text-center transition hover:border-[#64748B] hover:bg-[#FAFAFA]"
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
                {fileName ? (
                  <p className="mt-2 text-xs font-medium text-[#334155]">{fileName}</p>
                ) : null}
                <input
                  id="candidate-resume"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setFileName(file?.name ?? "");
                  }}
                />
              </label>
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
            />
          </div>
        </CollapsibleCard>

        <div className="flex w-full items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white px-5 text-sm font-medium text-[#334155] transition hover:bg-[#F8FAFC]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex h-10 flex-1 items-center justify-center rounded-lg px-5 text-sm font-medium text-white transition hover:opacity-95"
            style={brandStyle}
          >
            Add candidate
          </button>
        </div>
      </form>
      </div>

      <SuccessModal open={successOpen} onClose={handleSuccessClose} brandStyle={brandStyle} />
    </div>
  );
}
