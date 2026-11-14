"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import BrandingSettingsPanel from "@/app/admin_recruiter/settings/BrandingSettingsPanel";
import CallSettingsPanel from "@/app/admin_recruiter/settings/CallSettingsPanel";
import SettingsSectionHeader from "@/app/admin_recruiter/settings/SettingsSectionHeader";
import TemplatesSettingsPanel from "@/app/admin_recruiter/settings/TemplatesSettingsPanel";
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
const DepartmentsPanel = dynamic(() => import("@/app/admin_recruiter/settings/DepartmentsPanel"), {
  loading: SettingsPanelFallback,
});
const IntegrationsSettingsPanel = dynamic(
  () => import("@/app/admin_recruiter/settings/IntegrationsSettingsPanel"),
  { loading: SettingsPanelFallback }
);
const TaskSettingsPanel = dynamic(() => import("@/app/admin_recruiter/settings/TaskSettingsPanel"), {
  loading: SettingsPanelFallback,
});
const BusinessInfoTab = dynamic(
  () => import("@/app/admin_recruiter/account/components/BusinessInfoTab"),
  { loading: SettingsPanelFallback }
);
const AccountSettingsBillingPanel = dynamic(
  () => import("@/app/admin_recruiter/account/components/AccountSettingsBillingPanel"),
  { loading: SettingsPanelFallback }
);

function resourceKeyForSection(section: SettingsSectionSlug): string {
  switch (section) {
    case "company-profile":
    case "branding":
    case "call":
    case "task":
    case "hiring-theme":
    case "user-management":
    case "billing":
    case "roles":
    case "departments":
    case "integrations":
    case "profession":
    case "assessment":
    case "statuses":
      return "settings_company";
    case "templates":
      return "settings_templates";
    default:
      return "settings_company";
  }
}

export default function SettingsSectionClient({ section }: SettingsSectionClientProps) {
  const meta = SETTINGS_SECTION_META[section];
  const resourceKey = resourceKeyForSection(section);
  const { canView, canEdit, canDelete, loading } = useModulePermission(resourceKey);

  // Panels that already render their own page title.
  const showPageHeader =
    section !== "company-profile" &&
    section !== "branding" &&
    section !== "hiring-theme" &&
    section !== "departments" &&
    section !== "integrations" &&
    section !== "billing" &&
    section !== "profession";

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
    <div className="w-full min-w-0 space-y-6 ">
      {showPageHeader ? (
        <SettingsSectionHeader title={meta.title} description={meta.description} />
      ) : null}

      {section === "roles" ? (
        <RolePermissionsPanel canEdit={canEdit} canDelete={canDelete} />
      ) : section === "templates" ? (
        <TemplatesSettingsPanel />
      ) : (
        <fieldset
          disabled={
            !canEdit &&
            section !== "profession" &&
            section !== "billing" &&
            section !== "company-profile"
          }
          className="min-w-0 space-y-6 border-0 p-0 disabled:opacity-80"
        >
          {section === "company-profile" ? (
            <Suspense fallback={<SettingsPanelFallback />}>
              <BusinessInfoTab />
            </Suspense>
          ) : null}
          {section === "call" ? <CallSettingsPanel /> : null}
          {section === "task" ? <TaskSettingsPanel /> : null}
          {section === "branding" ? (
            <Suspense fallback={<SettingsPanelFallback />}>
              <BrandingSettingsPanel />
            </Suspense>
          ) : null}
          {section === "hiring-theme" ? (
            <Suspense fallback={<SettingsPanelFallback />}>
              <BrandingSettingsPanel initialMainTab="hiring-journey" />
            </Suspense>
          ) : null}
          {section === "user-management" ? <AdminConsolePanel embedInSettingsPage /> : null}
          {section === "billing" ? (
            <Suspense fallback={<SettingsPanelFallback />}>
              <AccountSettingsBillingPanel />
            </Suspense>
          ) : null}
          {section === "departments" ? <DepartmentsPanel /> : null}
          {section === "integrations" ? <IntegrationsSettingsPanel /> : null}
          {section === "assessment" ? <AssessmentSettingsPanel /> : null}
          {section === "profession" ? (
            <Suspense fallback={<SettingsPanelFallback />}>
              <ProfessionDocumentsPanel />
            </Suspense>
          ) : null}
          {section === "statuses" ? <CandidateStatusesPanel /> : null}
        </fieldset>
      )}
    </div>
  );
}
