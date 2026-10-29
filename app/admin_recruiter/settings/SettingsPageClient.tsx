"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import AdminConsolePanel from "@/app/admin_recruiter/settings/AdminConsolePanel";
import AssessmentSettingsPanel from "@/app/admin_recruiter/settings/AssessmentSettingsPanel";
import BrandingSettingsPanel from "@/app/admin_recruiter/settings/BrandingSettingsPanel";
import CandidateStatusesPanel from "@/app/admin_recruiter/settings/CandidateStatusesPanel";
import HireJourneyThemePanel from "@/app/admin_recruiter/settings/HireJourneyThemePanel";
import ProfessionDocumentsPanel from "@/app/admin_recruiter/settings/ProfessionDocumentsPanel";
import RolePermissionsPanel from "@/app/admin_recruiter/settings/RolePermissionsPanel";
import { SettingsSidebar } from "@/app/admin_recruiter/settings/SettingsSidebar";
import { settingsResourceKeyForSection } from "@/app/admin_recruiter/settings/settings-nav";
import { useModulePermission } from "@/lib/admin/hooks/use-staff-module-access";

function SettingsSectionIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-[30px]">
      <h1 className="text-sm font-semibold leading-5 text-black">{title}</h1>
      <p className="text-[10px] leading-[15px] text-[#6B7280]">{subtitle}</p>
    </div>
  );
}

function SettingsEmptySection({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section>
      <SettingsSectionIntro title={title} subtitle={subtitle} />
      <div className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-16 text-center text-sm text-[#6B7280]">
        This section is not set up yet.
      </div>
    </section>
  );
}

function TemplatesSection() {
  const links = [
    {
      href: "/admin_recruiter/template-builder",
      title: "Document templates",
      body: "Build offer letters and other documents.",
    },
    {
      href: "/admin_recruiter/email-templates",
      title: "Email templates",
      body: "Edit messages sent to candidates and staff.",
    },
    {
      href: "/admin_recruiter/dashboard/templates",
      title: "Onboarding templates",
      body: "Manage templates used in hiring workflows.",
    },
  ];

  return (
    <section>
      <SettingsSectionIntro title="Templates" subtitle="Document, email, and onboarding templates." />
      <div className="flex max-w-[634px] flex-col gap-5">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border border-[#E5E7EB] bg-white p-3.5 transition hover:border-[#012352]"
          >
            <p className="text-xs font-semibold leading-4 text-black">{link.title}</p>
            <p className="mt-0.5 text-[10px] leading-[15px] text-[#6B7280]">{link.body}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SettingsBody({ section, canEdit, canDelete }: { section: string; canEdit: boolean; canDelete: boolean }) {
  if (section === "roles") {
    return <RolePermissionsPanel canEdit={canEdit} canDelete={canDelete} />;
  }
  if (section === "admin-console") {
    return <AdminConsolePanel />;
  }
  if (section === "departments") {
    return (
      <SettingsEmptySection
        title="Departments"
        subtitle="Organize people and work by department."
      />
    );
  }
  if (section === "professions") return <ProfessionDocumentsPanel />;
  if (section === "statuses") return <CandidateStatusesPanel />;
  if (section === "assessment") {
    return (
      <div className="space-y-6">
        <AssessmentSettingsPanel />
        <HireJourneyThemePanel />
      </div>
    );
  }
  if (section === "templates") return <TemplatesSection />;
  if (section === "schedule") {
    return (
      <SettingsEmptySection
        title="Schedule & PTO"
        subtitle="Time off and scheduling rules for your organization."
      />
    );
  }
  if (section === "integrations") {
    return (
      <SettingsEmptySection title="Integrations" subtitle="Connect outside tools to your organization." />
    );
  }
  if (section === "billing") {
    return <SettingsEmptySection title="Plan & Billing" subtitle="Review your plan and billing details." />;
  }
  if (section === "security") {
    return <SettingsEmptySection title="Security" subtitle="Sign-in and account protection for your organization." />;
  }
  if (section === "audit-log") {
    return <SettingsEmptySection title="Audit Log" subtitle="Review changes made across your organization." />;
  }

  return <BrandingSettingsPanel />;
}

function SettingsContent({ section }: { section: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyTab = searchParams.get("tab");
  const resourceKey = settingsResourceKeyForSection(section);
  const { canView, canEdit, canDelete, loading } = useModulePermission(resourceKey);

  useEffect(() => {
    if (legacyTab) {
      router.replace("/admin_recruiter/settings");
    }
  }, [legacyTab, router]);

  if (!loading && !canView) {
    return (
      <div className="flex w-full min-w-0 flex-col lg:flex-row lg:items-start">
        <SettingsSidebar />
        <main className="min-w-0 flex-1 px-5 py-5 lg:px-8 lg:py-6">
          <div className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-16 text-center text-sm text-[#6B7280]">
            You do not have permission to view this settings section.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col lg:flex-row lg:items-start">
      <SettingsSidebar />
      <main
        className={`min-w-0 flex-1 ${
          section === "roles" || section === "admin-console" ? "bg-[#F8FAFC] p-6" : "px-5 py-5 lg:px-8 lg:py-6"
        }`}
      >
        <fieldset disabled={!canEdit} className="min-w-0 border-0 p-0 disabled:opacity-80">
          <SettingsBody section={section} canEdit={canEdit} canDelete={canDelete} />
        </fieldset>
      </main>
    </div>
  );
}

export default function SettingsPageClient({ section = "branding" }: { section?: string }) {
  return (
    <Suspense fallback={null}>
      <SettingsContent section={section} />
    </Suspense>
  );
}
