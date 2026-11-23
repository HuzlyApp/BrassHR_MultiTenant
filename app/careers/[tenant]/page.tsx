import { redirect, notFound } from "next/navigation";
import { isTenantApplicantPortalSlug } from "@/lib/tenant/tenant-branding";

export default async function CareersPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const slug = tenant.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,63}$/.test(slug) || !isTenantApplicantPortalSlug(slug)) notFound();
  redirect(`/jobs?tenant=${encodeURIComponent(slug)}`);
}
