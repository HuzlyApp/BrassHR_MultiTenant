"use client";

import AccountTabNav from "./components/AccountTabNav";
import PersonalTab from "./components/PersonalTab";
import BusinessInfoTab from "./components/BusinessInfoTab";
import SecurityTab from "./components/SecurityTab";
import AccountSettingsTab from "./components/AccountSettingsTab";
import type { AccountTabSlug } from "./account-tabs";

type AccountPageClientProps = {
  activeTab: AccountTabSlug;
};

export default function AccountPageClient({ activeTab }: AccountPageClientProps) {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1200px]">
        <AccountTabNav activeTab={activeTab} />

        {activeTab === "personal" ? <PersonalTab /> : null}
        {activeTab === "business-info" ? <BusinessInfoTab /> : null}
        {activeTab === "account-settings" ? <AccountSettingsTab /> : null}
        {activeTab === "security" ? <SecurityTab /> : null}
      </div>
    </main>
  );
}
