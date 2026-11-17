"use client";

import AccountPreferencesPanel from "@/app/admin_recruiter/account/components/AccountPreferencesPanel";
import SecurityTab from "@/app/admin_recruiter/account/components/SecurityTab";

/** Preferences → password / authenticator → 2FA + deactivate. */
export default function AccountSecurityTab() {
  return (
    <div className="space-y-6">
      <AccountPreferencesPanel variant="preferences" />
      <SecurityTab />
    </div>
  );
}
