"use client";

import AccountSettingsBillingPanel from "@/app/admin_recruiter/account/components/AccountSettingsBillingPanel";
import AccountPreferencesPanel from "@/app/admin_recruiter/account/components/AccountPreferencesPanel";
import FirmaIntegrationPanel from "@/app/admin_recruiter/account/components/FirmaIntegrationPanel";

export default function AccountSettingsTab() {
  return (
    <div className="space-y-6">
      <AccountPreferencesPanel />
      <FirmaIntegrationPanel />
      <AccountSettingsBillingPanel />
    </div>
  );
}
