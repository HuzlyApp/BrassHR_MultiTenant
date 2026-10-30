"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import SettingsSectionClient from "@/app/admin_recruiter/settings/SettingsSectionClient";
import {
  isSettingsSectionSlug,
  type SettingsSectionSlug,
} from "@/app/admin_recruiter/settings/settings-nav";

/**
 * Legacy entry for /admin_recruiter/settings and older callers that pass a section.
 * Company settings live under /settings/[section] via SettingsSectionClient.
 */
export default function SettingsPageClient({ section }: { section?: string } = {}) {
  const router = useRouter();

  useEffect(() => {
    if (!section) {
      router.replace("/admin_recruiter/settings/branding");
    }
  }, [section, router]);

  if (section && isSettingsSectionSlug(section)) {
    return <SettingsSectionClient section={section as SettingsSectionSlug} />;
  }

  return null;
}
