import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { boldJobDescriptionSectionTitles } from "@/lib/jobs/generate-job-description/sanitize-html";
import {
  ensureJobDescriptionBulletLists,
  JobDescriptionHtml,
  stripJobDescriptionBenefitsSection,
} from "@/lib/jobs/job-description-html";
import { formatPublicJobPayRate } from "@/lib/jobs/format-public-job-pay-rate";
import { publicJobDisplayTitle } from "@/lib/jobs/public-application-routing";
import { getPublishedJobByToken } from "@/lib/jobs/service";
import { resolvePublicTenant } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { loadTenantBrandingBySlug } from "@/lib/tenant/load-tenant-branding-server";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { resolveRequestTenantHost } from "@/lib/tenant/resolve-tenant-context";
import {
  JOB_POSTING_BODY_CLASS,
  JOB_POSTING_COMPANY_CLASS,
  JOB_POSTING_DESCRIPTION_CSS,
  JOB_POSTING_HELPER_CLASS,
  JOB_POSTING_METADATA_CLASS,
  JOB_POSTING_PAGE_TITLE_CLASS,
  JOB_POSTING_SECTION_HEADING_CLASS,
} from "@/app/admin_recruiter/jobs/job-posting-typography";

function relationName(value: unknown): string {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" && "name" in row ? String(row.name ?? "") : "";
}

function formatPublicDescriptionHtml(raw: string, hasSeparateBenefits: boolean): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withoutDupBenefits = hasSeparateBenefits
    ? stripJobDescriptionBenefitsSection(trimmed)
    : trimmed;
  return ensureJobDescriptionBulletLists(boldJobDescriptionSectionTitles(withoutDupBenefits));
}

function benefitItems(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default async function PublicJobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ tenant?: string }>;
}) {
  const supabase = createServiceRoleClient();
  if (!supabase) notFound();
  const [{ token }, query, requestHeaders] = await Promise.all([params, searchParams, headers()]);
  const hostTenant = resolveRequestTenantHost(requestHeaders).subdomainLabel;
  const tenant = await resolvePublicTenant(supabase, query.tenant ?? hostTenant);
  if (!tenant) notFound();
  const job = await getPublishedJobByToken(supabase, tenant.id, token);
  if (!job) notFound();

  const branding = await loadTenantBrandingBySlug(tenant.slug);
  const brandVars = brandingToCssVars(branding);
  const secondaryColor = branding.secondaryHex || "#012352";

  const applyUrl = `/apply?tenant=${encodeURIComponent(tenant.slug)}&job_token=${encodeURIComponent(String(job.public_job_token))}`;
  const canApply = Boolean(job.workflow_id);
  const employmentType = job.employment_type?.trim() || "";
  const facts = [
    relationName(job.professions),
    relationName(job.specialties),
    job.schedule,
  ].filter(Boolean);

  const separateBenefits = benefitItems(job.benefits);
  const payRate = formatPublicJobPayRate(job);
  const descriptionHtml = formatPublicDescriptionHtml(
    String(job.public_description ?? ""),
    separateBenefits.length > 0
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900" style={brandVars}>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-5 sm:px-8">
          <Link
            href={`/jobs?tenant=${encodeURIComponent(tenant.slug)}`}
            className="inline-flex items-center gap-1 text-sm font-medium transition hover:opacity-80"
            style={{ color: secondaryColor }}
          >
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
            Back to all jobs
          </Link>
        </div>
      </div>
      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_280px]">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className={JOB_POSTING_COMPANY_CLASS}>
            {tenant.name}
          </p>
          <h1 className={`mt-2 ${JOB_POSTING_PAGE_TITLE_CLASS}`}>
            {publicJobDisplayTitle(job)}
          </h1>
          <p className={`mt-3 ${JOB_POSTING_METADATA_CLASS}`}>{job.location}</p>
          {facts.length ? (
            <p className={`mt-2 ${JOB_POSTING_METADATA_CLASS}`}>{facts.join(" · ")}</p>
          ) : null}
          {employmentType ? (
            <p className={`mt-2 ${JOB_POSTING_METADATA_CLASS}`}>{employmentType}</p>
          ) : null}
          {payRate ? (
            <p className="mt-3 text-sm text-slate-700">
              <span className="font-medium text-slate-500">Pay Rate :</span>{" "}
              <span className="font-semibold text-slate-900">{payRate}</span>
            </p>
          ) : null}

          <section className="mt-8">
            <h2 className={JOB_POSTING_SECTION_HEADING_CLASS}>Job summary</h2>
            <style>{JOB_POSTING_DESCRIPTION_CSS.replaceAll(".job-posting-description", ".public-job-description")}</style>
            <JobDescriptionHtml
              html={descriptionHtml}
              className="public-job-description mt-4"
              emptyLabel=""
            />
          </section>
          {job.responsibilities ? (
            <section className="mt-7">
              <h2 className={JOB_POSTING_SECTION_HEADING_CLASS}>Responsibilities</h2>
              <p className={`mt-3 whitespace-pre-wrap ${JOB_POSTING_BODY_CLASS}`}>
                {job.responsibilities}
              </p>
            </section>
          ) : null}
          {job.qualifications ? (
            <section className="mt-7">
              <h2 className={JOB_POSTING_SECTION_HEADING_CLASS}>Qualifications</h2>
              <p className={`mt-3 whitespace-pre-wrap ${JOB_POSTING_BODY_CLASS}`}>
                {job.qualifications}
              </p>
            </section>
          ) : null}
          {separateBenefits.length ? (
            <section className="mt-7">
              <h2 className={JOB_POSTING_SECTION_HEADING_CLASS}>Benefits</h2>
              <ul className={`mt-3 list-outside list-disc space-y-1.5 pl-5 ${JOB_POSTING_BODY_CLASS}`}>
                {separateBenefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="font-semibold text-slate-900">Ready to apply?</h2>
          <p className={`mt-2 ${JOB_POSTING_HELPER_CLASS}`}>
            {canApply
              ? "Start by uploading your resume. An account is not required."
              : "This job is posted for visibility. Online applications are not open yet."}
          </p>
          {canApply ? (
            <Link
              href={applyUrl}
              className="mt-5 flex w-full items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95"
            >
              Apply
            </Link>
          ) : (
            <span
              className="mt-5 flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500"
              title="Online applications are not available for this job yet"
            >
              Apply
            </span>
          )}
          {job.application_deadline ? (
            <p className="mt-3 text-xs text-slate-500">
              Apply by {new Date(`${job.application_deadline}T00:00:00`).toLocaleDateString()}
            </p>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
