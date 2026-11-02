import type { ReactNode } from "react";

/**
 * Settings chrome (mini-sidebar + mobile nav) lives in AdminRecruiterShell
 * when the path is under /admin_recruiter/settings.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
