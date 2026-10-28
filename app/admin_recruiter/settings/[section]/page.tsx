import { notFound, redirect } from "next/navigation";
import SettingsPageClient from "@/app/admin_recruiter/settings/SettingsPageClient";
import { isSettingsSectionSlug } from "@/app/admin_recruiter/settings/settings-nav";

type PageProps = {
  params: Promise<{ section: string }>;
};

export default async function SettingsSectionPage({ params }: PageProps) {
  const { section } = await params;
  if (section === "branding") {
    redirect("/admin_recruiter/settings");
  }
  if (!isSettingsSectionSlug(section)) {
    notFound();
  }
  return <SettingsPageClient section={section} />;
}
