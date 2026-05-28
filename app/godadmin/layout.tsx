import type { ReactNode } from "react";
import GodAdminShell from "@/app/components/godadmin/GodAdminShell";

export default function GodAdminLayout({ children }: { children: ReactNode }) {
  return <GodAdminShell>{children}</GodAdminShell>;
}
