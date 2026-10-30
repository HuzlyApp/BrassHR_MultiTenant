"use client";

import dynamic from "next/dynamic";
import BrandingSettingsPanel from "@/app/admin_recruiter/settings/BrandingSettingsPanel";
import SettingsSectionHeader from "@/app/admin_recruiter/settings/SettingsSectionHeader";
import {
  SETTINGS_SECTION_META,
  type SettingsSectionSlug,
} from "@/app/admin_recruiter/settings/settings-nav";
import { useModulePermission } from "@/lib/admin/hooks/use-staff-module-access";

type SettingsSectionClientProps = {
  section: SettingsSectionSlug;
};

function SettingsPanelFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading section</span>
      <div className="h-5 w-40 rounded bg-[#E5E7EB] motion-safe:animate-pulse" />
      <div className="h-28 rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
      <div className="h-28 rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
    </div>
  );
}

const RolePermissionsPanel = dynamic(() => import("@/app/admin_recruiter/settings/RolePermissionsPanel"), {
  loading: SettingsPanelFallback,
});
const AdminConsolePanel = dynamic(() => import("@/app/admin_recruiter/settings/AdminConsolePanel"), {
  loading: SettingsPanelFallback,
});
const ProfessionDocumentsPanel = dynamic(() => import("@/app/admin_recruiter/settings/ProfessionDocumentsPanel"), {
  loading: SettingsPanelFallback,
});
const CandidateStatusesPanel = dynamic(() => import("@/app/admin_recruiter/settings/CandidateStatusesPanel"), {
  loading: SettingsPanelFallback,
});
const AssessmentSettingsPanel = dynamic(() => import("@/app/admin_recruiter/settings/AssessmentSettingsPanel"), {
  loading: SettingsPanelFallback,
});
const HireJourneyThemePanel = dynamic(() => import("@/app/admin_recruiter/settings/HireJourneyThemePanel"), {
  loading: SettingsPanelFallback,
});

function resourceKeyForSection(section: SettingsSectionSlug): string {
  switch (section) {
    case "branding":
    case "hiring-theme":
    case "admin-console":
    case "roles":
    case "profession":
    case "assessment":
    case "statuses":
      return "settings_company";
    default:
      return "settings_company";
  }
}

export default function SettingsSectionClient({ section }: SettingsSectionClientProps) {
  const meta = SETTINGS_SECTION_META[section];
  const resourceKey = resourceKeyForSection(section);
  const { canView, canEdit, canDelete, loading } = useModulePermission(resourceKey);

  const showPageHeader = section !== "branding" && section !== "hiring-theme";

  if (!loading && !canView) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <div className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-16 text-center text-sm text-[#6B7280]">
          You do not have permission to view this settings section.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[960px] space-y-6">
      {showPageHeader ? (
        <SettingsSectionHeader title={meta.title} description={meta.description} />
      ) : null}

      {section === "roles" ? (
        <RolePermissionsPanel canEdit={canEdit} canDelete={canDelete} />
      ) : (
        <fieldset disabled={!canEdit} className="min-w-0 space-y-6 border-0 p-0 disabled:opacity-80">
          {section === "branding" ? <BrandingSettingsPanel /> : null}
          {section === "hiring-theme" ? <HireJourneyThemePanel /> : null}
          {section === "admin-console" ? <AdminConsolePanel embedInSettingsPage /> : null}
          {section === "assessment" ? <AssessmentSettingsPanel /> : null}
          {section === "profession" ? <ProfessionDocumentsPanel /> : null}
          {section === "statuses" ? <CandidateStatusesPanel /> : null}
        </fieldset>
      )}
    </div>
  );
}
