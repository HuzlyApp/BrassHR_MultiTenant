"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AccountTabNav from "./components/AccountTabNav";
import PersonalTab from "./components/PersonalTab";
import AccountSecurityTab from "./components/AccountSecurityTab";
import { accountTabHref, type AccountTabSlug } from "./account-tabs";

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
    <div className="w-full min-w-0 space-y-6">
      <AccountTabNav activeTab={activeTab} />

      {activeTab === "personal" ? <PersonalTab /> : null}
      {showSecurity ? <AccountSecurityTab /> : null}
    </div>
  );
}
