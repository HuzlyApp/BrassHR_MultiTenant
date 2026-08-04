import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { JobDescriptionHtml } from "@/lib/jobs/job-description-html";
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
  const facts = [
    relationName(job.professions),
    relationName(job.specialties),
    job.employment_type,
    job.schedule,
  ].filter(Boolean);

  const descriptionHtml = String(job.public_description ?? "");
  const descriptionHasResponsibilities = /Key Responsibilities|Responsibilities/i.test(descriptionHtml);
  const descriptionHasQualifications = /Qualifications/i.test(descriptionHtml);
  const descriptionHasBenefits = /Benefits/i.test(descriptionHtml);

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
            <h2 className="text-lg font-semibold text-slate-900">About this role</h2>
            <JobDescriptionHtml
              html={descriptionHtml}
              className="mt-3 text-slate-700"
              emptyLabel=""
            />
          </section>
          {job.responsibilities && !descriptionHasResponsibilities ? (
            <section className="mt-7">
              <h2 className="text-lg font-semibold text-slate-900">Responsibilities</h2>
              <JobDescriptionHtml
                html={String(job.responsibilities)}
                asList
                className="mt-3 text-slate-700"
                emptyLabel=""
              />
            </section>
          ) : null}
          {job.qualifications && !descriptionHasQualifications ? (
            <section className="mt-7">
              <h2 className="text-lg font-semibold text-slate-900">Qualifications</h2>
              <JobDescriptionHtml
                html={String(job.qualifications)}
                asList
                className="mt-3 text-slate-700"
                emptyLabel=""
              />
            </section>
          ) : null}
          {job.benefits && !descriptionHasBenefits ? (
            <section className="mt-7">
              <h2 className="text-lg font-semibold text-slate-900">Benefits</h2>
              <JobDescriptionHtml
                html={String(job.benefits)}
                asList
                className="mt-3 text-slate-700"
                emptyLabel=""
              />
            </section>
          ) : null}
        </article>
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="font-semibold text-slate-900">Ready to apply?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Start by uploading your resume. An account is not required.</p>
          <Link
            href={applyUrl}
            className="mt-5 flex w-full items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95"
          >
            Apply
          </Link>
          {job.application_deadline ? <p className="mt-3 text-xs text-slate-500">Apply by {new Date(`${job.application_deadline}T00:00:00`).toLocaleDateString()}</p> : null}
        </aside>
      </div>
    </main>
  );
}
