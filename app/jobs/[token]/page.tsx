import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { boldJobDescriptionSectionTitles } from "@/lib/jobs/generate-job-description/sanitize-html";
import {
  ensureJobDescriptionBulletLists,
  JobDescriptionHtml,
  stripJobDescriptionBenefitsSection,
} from "@/lib/jobs/job-description-html";
import { getPublishedJobByToken } from "@/lib/jobs/service";
import { resolvePublicTenant } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { loadTenantBrandingBySlug } from "@/lib/tenant/load-tenant-branding-server";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { resolveRequestTenantHost } from "@/lib/tenant/resolve-tenant-context";

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
  const facts = [
    relationName(job.professions),
    relationName(job.specialties),
    job.employment_type,
    job.schedule,
  ].filter(Boolean);

  const separateBenefits = benefitItems(job.benefits);
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
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--brand-primary)]">
            {tenant.name}
          </p>
          <h1 className="mt-2 text-xl font-semibold leading-snug text-slate-900 sm:text-2xl md:text-3xl">
            {job.public_title}
          </h1>
          <p className="mt-3 text-base font-medium text-slate-600">{job.location}</p>
          <p className="mt-2 text-sm text-slate-500">{facts.join(" · ")}</p>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">Job summary</h2>
            <style>{`
              .public-job-description.job-description-html > :first-child {
                margin-top: 0 !important;
              }
              .public-job-description.job-description-html h2,
              .public-job-description.job-description-html h3,
              .public-job-description.job-description-html h4 {
                margin-top: 1.75rem;
                margin-bottom: 0.5rem;
                font-size: 1rem;
                line-height: 1.5rem;
                font-weight: 600;
                color: #0f172a;
              }
              .public-job-description.job-description-html h2 strong,
              .public-job-description.job-description-html h2 b,
              .public-job-description.job-description-html h3 strong,
              .public-job-description.job-description-html h3 b,
              .public-job-description.job-description-html h4 strong,
              .public-job-description.job-description-html h4 b {
                font-weight: 600;
              }
              .public-job-description.job-description-html p,
              .public-job-description.job-description-html ul,
              .public-job-description.job-description-html ol {
                margin-top: 0;
                margin-bottom: 0;
                color: #334155;
                font-size: 0.9375rem;
                line-height: 1.75rem;
              }
              .public-job-description.job-description-html ul {
                list-style-type: disc;
                list-style-position: outside;
                padding-left: 1.25rem;
                margin-top: 0.35rem;
              }
              .public-job-description.job-description-html ol {
                list-style-type: decimal;
                list-style-position: outside;
                padding-left: 1.25rem;
                margin-top: 0.35rem;
              }
              .public-job-description.job-description-html li {
                display: list-item;
                margin-top: 0.35rem;
                margin-bottom: 0.35rem;
                color: #334155;
              }
              .public-job-description.job-description-html p + h2,
              .public-job-description.job-description-html p + h3,
              .public-job-description.job-description-html p + h4,
              .public-job-description.job-description-html ul + h2,
              .public-job-description.job-description-html ul + h3,
              .public-job-description.job-description-html ul + h4,
              .public-job-description.job-description-html ol + h2,
              .public-job-description.job-description-html ol + h3,
              .public-job-description.job-description-html ol + h4 {
                margin-top: 1.75rem;
              }
              .public-job-description.job-description-html p:has(> strong:only-child),
              .public-job-description.job-description-html p:has(> b:only-child) {
                margin-top: 1.75rem;
                margin-bottom: 0.5rem;
                font-size: 1rem;
                line-height: 1.5rem;
                font-weight: 600;
                color: #0f172a;
              }
              .public-job-description.job-description-html p:has(> strong:only-child) > strong,
              .public-job-description.job-description-html p:has(> b:only-child) > b {
                font-weight: 600;
              }
              .public-job-description.job-description-html > p:has(> strong:only-child):first-child,
              .public-job-description.job-description-html > p:has(> b:only-child):first-child {
                margin-top: 0;
              }
            `}</style>
            <JobDescriptionHtml
              html={descriptionHtml}
              className="public-job-description mt-4"
              emptyLabel=""
            />
          </section>
          {job.responsibilities ? (
            <section className="mt-7">
              <h2 className="text-lg font-semibold text-slate-900">Responsibilities</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {job.responsibilities}
              </p>
            </section>
          ) : null}
          {job.qualifications ? (
            <section className="mt-7">
              <h2 className="text-lg font-semibold text-slate-900">Qualifications</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {job.qualifications}
              </p>
            </section>
          ) : null}
          {separateBenefits.length ? (
            <section className="mt-7">
              <h2 className="text-lg font-semibold text-slate-900">Benefits</h2>
              <ul className="mt-3 list-outside list-disc space-y-1.5 pl-5 text-sm leading-7 text-slate-700">
                {separateBenefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="font-semibold text-slate-900">Ready to apply?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
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
