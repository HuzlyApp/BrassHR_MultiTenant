"use client";

import AccountPreferencesPanel from "@/app/admin_recruiter/account/components/AccountPreferencesPanel";
import SecurityTab from "@/app/admin_recruiter/account/components/SecurityTab";

/** Combined Account preferences + Security (password / authenticator). */
export default function AccountSecurityTab() {
  return (
    <div className="space-y-6">
      <AccountPreferencesPanel />
      <SecurityTab />
    </div>
  );
}
