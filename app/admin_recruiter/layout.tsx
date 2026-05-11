"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminTenantBrandingProvider } from "@/app/components/tenant/AdminTenantBrandingProvider";
import { AdminRecruiterSidebar } from "./components/AdminRecruiterSidebar";
import { AdminRecruiterHeader } from "./components/AdminRecruiterHeader";
import "./layout.css";

/**
 * Default body copy color for recruiter admin; pages still set explicit colors
 * (e.g. sidebar `text-white`, links `text-teal-*`) where needed.
 */
export default function AdminRecruiterLayout({ children }: { children: ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  return (
    <AdminTenantBrandingProvider>
      <div
        className="admin-recruiter-shell min-h-screen text-gray-600"
        style={{ backgroundColor: "color-mix(in srgb, var(--brand-accent) 12%, #f3f5f5)" }}
      >
        <AdminRecruiterSidebar isMobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
        <div className="admin-recruiter-content lg:pl-[344px]">
          <AdminRecruiterHeader onMenuClick={() => setMobileSidebarOpen(true)} />
          {children}
        </div>
      </div>
    </AdminTenantBrandingProvider>
  );
}
