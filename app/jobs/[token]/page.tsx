import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { JobDescriptionHtml } from "@/lib/jobs/job-description-html";
import { getPublishedJobByToken } from "@/lib/jobs/service";
import { resolvePublicTenant } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
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

  const applyUrl = `/apply?tenant=${encodeURIComponent(tenant.slug)}&job_token=${encodeURIComponent(String(job.public_job_token))}`;
  const facts = [
    relationName(job.professions),
    relationName(job.specialties),
    job.employment_type,
    job.schedule,
  ].filter(Boolean);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-5 sm:px-8">
          <Link href={`/jobs?tenant=${encodeURIComponent(tenant.slug)}`} className="text-sm font-medium text-teal-700 hover:underline">
            ← Back to all jobs
          </Link>
        </div>
      </div>
      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_280px]">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{tenant.name}</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">{job.public_title}</h1>
          <p className="mt-3 text-base font-medium text-slate-600">{job.location}</p>
          <p className="mt-2 text-sm text-slate-500">{facts.join(" · ")}</p>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">About this role</h2>
            <JobDescriptionHtml
              html={String(job.public_description ?? "")}
              className="mt-3 leading-7"
              emptyLabel=""
            />
          </section>
          {job.responsibilities ? <section className="mt-7"><h2 className="text-lg font-semibold text-slate-900">Responsibilities</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{job.responsibilities}</p></section> : null}
          {job.qualifications ? <section className="mt-7"><h2 className="text-lg font-semibold text-slate-900">Qualifications</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{job.qualifications}</p></section> : null}
          {job.benefits ? <section className="mt-7"><h2 className="text-lg font-semibold text-slate-900">Benefits</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{job.benefits}</p></section> : null}
        </article>
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="font-semibold text-slate-900">Ready to apply?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Start by uploading your resume. An account is not required.</p>
          <Link href={applyUrl} className="mt-5 flex w-full items-center justify-center rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800">
            Apply
          </Link>
          {job.application_deadline ? <p className="mt-3 text-xs text-slate-500">Apply by {new Date(`${job.application_deadline}T00:00:00`).toLocaleDateString()}</p> : null}
        </aside>
      </div>
    </main>
  );
}
