"use client";

import SettingsSectionHeader from "@/app/admin_recruiter/settings/SettingsSectionHeader";
import LegalDocumentsPanel from "@/app/admin_recruiter/settings/LegalDocumentsPanel";
import { useModulePermission } from "@/lib/admin/hooks/use-staff-module-access";

export default function AdminLegalDocumentsPage() {
  const { canView, canEdit, loading } = useModulePermission("settings_company");

  if (loading) {
    return (
      <div className="admin-recruiter-page-pad space-y-6 pb-8" aria-busy="true">
        <div className="h-8 w-56 rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
        <div className="h-40 rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="admin-recruiter-page-pad pb-8">
        <div className="mx-auto w-full max-w-[960px]">
          <div className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-16 text-center text-sm text-[#6B7280]">
            You do not have permission to view legal documents.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-recruiter-page-pad min-w-0 max-w-full space-y-6 overflow-x-hidden pb-8">
      <SettingsSectionHeader
        title="Legal Documents"
        description="View, update, and add privacy policies, terms, and other legal documents shown to applicants, workers, and tenant users."
      />
      <LegalDocumentsPanel canEdit={canEdit} />
    </div>
  );
}
