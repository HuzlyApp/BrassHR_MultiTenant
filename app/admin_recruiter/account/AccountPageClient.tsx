"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AccountTabNav from "@/app/admin_recruiter/account/components/AccountTabNav";
import PersonalTab from "@/app/admin_recruiter/account/components/PersonalTab";
import AccountSecurityTab from "@/app/admin_recruiter/account/components/AccountSecurityTab";
import NotificationsSettingsPanel from "@/app/admin_recruiter/settings/NotificationsSettingsPanel";
import { accountTabHref, type AccountTabSlug } from "@/app/admin_recruiter/account/account-tabs";

type AccountPageClientProps = {
  activeTab: AccountTabSlug;
};

export default function AccountPageClient({ activeTab }: AccountPageClientProps) {
  const router = useRouter();

  useEffect(() => {
    if (activeTab === "account-settings" || activeTab === "security") {
      router.replace(accountTabHref("account-security"));
    }
  }, [activeTab, router]);

  const showSecurity =
    activeTab === "account-security" ||
    activeTab === "account-settings" ||
    activeTab === "security";

  return (
    <div className="w-full min-w-0 space-y-6 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
      <AccountTabNav activeTab={activeTab} />

      {activeTab === "personal" ? <PersonalTab /> : null}
      {showSecurity ? <AccountSecurityTab /> : null}
      {activeTab === "notifications" ? <NotificationsSettingsPanel /> : null}
    </div>
  );
}
