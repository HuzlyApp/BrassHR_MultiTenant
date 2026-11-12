"use client";

import AccountSettingsBillingPanel from "@/app/admin_recruiter/account/components/AccountSettingsBillingPanel";
import AccountPreferencesPanel from "@/app/admin_recruiter/account/components/AccountPreferencesPanel";
import FirmaIntegrationPanel from "@/app/admin_recruiter/account/components/FirmaIntegrationPanel";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { isLimitedStaffConsoleRole } from "@/lib/admin/staff-directory-types";

export default function AccountSettingsTab() {
  const { profile, loading } = useAccountData();
  const isLimitedStaff = isLimitedStaffConsoleRole(profile?.role, profile?.is_admin);
  const showAdminPanels = !loading && !isLimitedStaff;

  return (
    <div className="space-y-6">
      <AccountPreferencesPanel />
      {showAdminPanels ? (
        <div className="space-y-6">
          <FirmaIntegrationPanel />
          <AccountSettingsBillingPanel />
        </div>
      ) : null}
    </div>
  );
}
