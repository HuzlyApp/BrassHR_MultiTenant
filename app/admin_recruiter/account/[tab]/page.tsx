import { redirect } from "next/navigation";
import AccountPageClient from "../AccountPageClient";
import { isAccountTabSlug } from "../account-tabs";

type PageProps = {
  params: Promise<{ tab: string }>;
};

export default async function AdminRecruiterAccountTabPage({ params }: PageProps) {
  const { tab } = await params;
  if (!isAccountTabSlug(tab)) {
    redirect("/admin_recruiter/account/personal");
  }
  return <AccountPageClient activeTab={tab} />;
}
