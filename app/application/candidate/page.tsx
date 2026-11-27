import { redirect } from "next/navigation";
import { applicationPath } from "@/lib/tenant/with-tenant";

export default async function CandidatePortalIndexPage({ searchParams }: { searchParams: Promise<{ tenant?: string | string[] }> }) {
  const { tenant } = await searchParams;
  redirect(applicationPath("/application/candidate/jobs", Array.isArray(tenant) ? tenant[0] : tenant));
}
