"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { isLimitedStaffConsoleRole } from "@/lib/admin/staff-directory-types";
import AccountTabNav from "./components/AccountTabNav";
import PersonalTab from "./components/PersonalTab";
import SecurityTab from "./components/SecurityTab";
import AccountSettingsTab from "./components/AccountSettingsTab";
import { accountTabHref, isRecruiterHiddenAccountTab, type AccountTabSlug } from "./account-tabs";

type AccountPageClientProps = {
  activeTab: AccountTabSlug;
};

export default function AccountPageClient({ activeTab }: AccountPageClientProps) {
  const router = useRouter();
  const { profile, loading } = useAccountData();
  const isLimitedStaff = isLimitedStaffConsoleRole(profile?.role, profile?.is_admin);
  // Admins keep Profile / Account / Security tabs.
  // Limited staff use the settings sidebar only (Profile + Account).
  const showTabNav = !isLimitedStaff && !loading;

  useEffect(() => {
    if (loading || !isLimitedStaff || !isRecruiterHiddenAccountTab(activeTab)) return;
    router.replace(accountTabHref("personal"));
  }, [activeTab, isLimitedStaff, loading, router]);

  return (
    <div className="w-full min-w-0 space-y-6">
      {showTabNav ? <AccountTabNav activeTab={activeTab} /> : null}

      {activeTab === "personal" ? <PersonalTab /> : null}
      {activeTab === "account-settings" ? <AccountSettingsTab /> : null}
      {activeTab === "security" ? <SecurityTab /> : null}
    </div>
  );
}
