import { redirect } from "next/navigation";

export default async function AdvancedSearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await searchParams;
  redirect("/admin_recruiter/candidates");
}
