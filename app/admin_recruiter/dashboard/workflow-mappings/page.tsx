import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function WorkflowMappingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  qs.set("tab", "mappings");
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) qs.set(key, value);
  }
  redirect(`/admin_recruiter/dashboard/onboarding-flows?${qs.toString()}`);
}
