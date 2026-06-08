"use client";

import AccountSettingsBillingPanel from "@/app/admin_recruiter/account/components/AccountSettingsBillingPanel";
import AccountPreferencesPanel from "@/app/admin_recruiter/account/components/AccountPreferencesPanel";

export default function AccountSettingsTab() {
  return (
    <div className="space-y-6">
      <AccountPreferencesPanel />
      <AccountSettingsBillingPanel />
    </div>
  );
}
