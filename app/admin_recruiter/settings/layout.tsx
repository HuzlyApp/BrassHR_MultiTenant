import type { ReactNode } from "react";
import { SettingsSidebar } from "@/app/admin_recruiter/settings/SettingsSidebar";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full min-w-0 flex-col lg:flex-row lg:items-start">
      <SettingsSidebar />
      {children}
    </div>
  );
}
