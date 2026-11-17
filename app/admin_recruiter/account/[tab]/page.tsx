import { redirect } from "next/navigation";
import AccountPageClient from "../AccountPageClient";
import { isAccountTabSlug } from "../account-tabs";

type PageProps = {
  params: Promise<{ tab: string }>;
};

export default async function AdminRecruiterAccountTabPage({ params }: PageProps) {
  const { tab } = await params;
  // Legacy Business Info tab → Settings Company Profile.
  if (tab === "business-info") {
    redirect("/admin_recruiter/settings/company-profile");
  }
  // Integrations moved to Company Settings (below Branding).
  if (tab === "integrations") {
    redirect("/admin_recruiter/settings/integrations");
  }
  if (!isAccountTabSlug(tab)) {
    redirect("/admin_recruiter/account/personal");
  }
  return <AccountPageClient activeTab={tab} />;
}
