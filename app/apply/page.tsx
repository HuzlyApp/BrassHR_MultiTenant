"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveTenantSlugForClient } from "@/lib/tenant/resolve-tenant-context";
import { brandingFallbackForSlug, type TenantBranding } from "@/lib/tenant/tenant-branding";
import { buildTenantBrandingApiUrl } from "@/lib/tenant/resolve-tenant-context";

type JobLanding = {
  mode: "job" | "legacy";
  tenantSlug: string;
  tenantName?: string | null;
  workflowName?: string;
  job?: {
    id: string;
    title: string;
    description: string | null;
    jobRole: string | null;
    location: string | null;
    department: string | null;
    employmentType: string;
    placementType: string;
    publicJobToken: string | null;
  };
  message?: string;
};

function ApplyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [landing, setLanding] = useState<JobLanding | null>(null);
  const [brand, setBrand] = useState<TenantBranding | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void (async () => {
      // Strip untrusted workflow override params from the visible URL.
      const cleaned = new URLSearchParams(searchParams.toString());
      ["workflow_id", "workflow_template_id", "onboarding_flow_id", "flow_id"].forEach((k) =>
        cleaned.delete(k)
      );
      if (cleaned.toString() !== searchParams.toString()) {
        router.replace(`/apply?${cleaned.toString()}`);
        return;
      }

      const resolved = resolveTenantSlugForClient(cleaned.toString(), { path: "/apply" });
      const tenant = resolved.slug;
      if (!tenant) {
        setError("This apply link is missing organization context.");
        return;
      }

      try {
        const brandingUrl = buildTenantBrandingApiUrl(resolved);
        const brandRes = await fetch(brandingUrl, { cache: "no-store" });
        if (brandRes.ok) {
          const payload = (await brandRes.json()) as { branding?: TenantBranding };
          if (payload.branding) setBrand(payload.branding);
          else setBrand(brandingFallbackForSlug(tenant));
        } else {
          setBrand(brandingFallbackForSlug(tenant));
        }
      } catch {
        setBrand(brandingFallbackForSlug(tenant));
      }

      const params = new URLSearchParams({ tenant });
      const jobId = cleaned.get("job_id");
      const jobToken = cleaned.get("job_token");
      if (jobId) params.set("job_id", jobId);
      if (jobToken) params.set("job_token", jobToken);

      const res = await fetch(`/api/public/job-application?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "This job is not available.");
        return;
      }
      setLanding(json as JobLanding);
    })();
  }, [router, searchParams]);

  async function startApplication() {
    if (!landing) return;
    setStarting(true);
    setError(null);
    const params = new URLSearchParams({ tenant: landing.tenantSlug });
    if (landing.job?.id) params.set("job_id", landing.job.id);
    if (landing.job?.publicJobToken) params.set("job_token", landing.job.publicJobToken);

    const res = await fetch(`/api/worker-onboarding/entry?${params.toString()}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? "Unable to start application.");
      setStarting(false);
      return;
    }
    router.push(json.url);
  }

  if (error && !landing) {
    return (
      <main className="mx-auto max-w-lg p-8 text-center text-sm text-red-700">
        <p className="font-medium">Unable to start application</p>
        <p className="mt-2 text-[#334155]">{error}</p>
      </main>
    );
  }

  if (!landing || !brand) {
    return <main className="min-h-screen bg-white" aria-busy="true" />;
  }

  const primary = brand.primaryColor || "#0c918a";

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-10">
      <div className="mx-auto max-w-xl rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
          {brand.companyName || landing.tenantName || "BrassHR"}
        </p>
        {landing.mode === "job" && landing.job ? (
          <>
            <h1 className="mt-2 text-2xl font-semibold text-[#0F172A]">{landing.job.title}</h1>
            <p className="mt-2 text-sm text-[#64748B]">
              {[landing.job.jobRole, landing.job.location, landing.job.employmentType]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {landing.job.placementType && landing.job.placementType !== "Internal" ? (
              <p className="mt-1 text-xs text-[#64748B]">
                Placement: {landing.job.placementType.replaceAll("_", " ")}
              </p>
            ) : null}
            {landing.job.description ? (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#334155]">
                {landing.job.description}
              </p>
            ) : (
              <p className="mt-4 text-sm text-[#64748B]">
                Complete the application to start onboarding for this role.
              </p>
            )}
            {landing.workflowName ? (
              <p className="mt-3 text-xs text-[#64748B]">
                Onboarding workflow is assigned automatically for this job.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-semibold text-[#0F172A]">Apply</h1>
            <p className="mt-2 text-sm text-[#64748B]">
              {landing.message ??
                "Continue with this organization's default onboarding application."}
            </p>
          </>
        )}

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        <button
          type="button"
          onClick={() => void startApplication()}
          disabled={starting}
          className="mt-6 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: primary }}
        >
          {starting ? "Starting…" : "Start application"}
        </button>
      </div>
    </main>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-white" aria-busy="true" />}>
      <ApplyContent />
    </Suspense>
  );
}
